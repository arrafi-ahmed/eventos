const CustomError = require("../model/CustomError");
const { query } = require("../db");
const { v4: uuidv4 } = require("uuid");
const exceljs = require("exceljs");
const { formatTime, generateSessionId } = require("../utils/common");
const { formatInTimezone } = require("../utils/date");
const formService = require("../service/form");
const eventService = require("./event");
const ticketService = require("./ticket");
const attendeesService = require("./attendees");
const emailService = require("./email");
const tempRegistrationService = require("./tempRegistration");
const orderService = require("./order");
const stripeService = require("./stripe");
const eventVisitorService = require("./eventVisitor");
const { isGroupTicket } = require("../utils/ticket");
const pdfService = require("./pdf");

// Cleanup expired temporary registration data
exports.cleanupExpiredTempData = async () => {
    try {
        const result = await tempRegistrationService.cleanupExpiredTempData();
        return result;
    } catch (error) {
        console.error("Error cleaning up expired temporary data:", error);
        throw error;
    }
};

// Scheduled cleanup job (can be called by cron or manually)
exports.runCleanupJob = async () => {
    try {
        // Clean up incomplete registrations
        const incompleteCount = await exports.cleanupIncompleteRegistrations();

        // Clean up expired temporary data
        const tempCount = await exports.cleanupExpiredTempData();

        return {
            incompleteRegistrations: incompleteCount,
            expiredTempData: tempCount,
        };
    } catch (error) {
        console.error("Error running cleanup job:", error);
        throw error;
    }
};

exports.bulkImportAttendee = async ({ files, eventId, organizationId }) => {
    // Validate input parameters
    if (!files || !Array.isArray(files) || files.length === 0) {
        throw new CustomError("Excel file is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    // Validate event exists and belongs to organization
    const event = await eventService.getEventById({ eventId });
    if (!event) {
        throw new CustomError("Event not found", 404);
    }

    if (event.organizationId !== organizationId) {
        throw new CustomError("Event does not belong to this organization", 403);
    }

    const excelFile = files[0];
    if (!excelFile || !excelFile.path) {
        throw new CustomError("Invalid file format", 400);
    }

    const sheetPath = excelFile.path;
    const workbook = new exceljs.Workbook();

    try {
        await workbook.xlsx.readFile(sheetPath);
    } catch (error) {
        throw new CustomError("Invalid Excel file format", 400);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
        throw new CustomError(
            "Excel file must contain at least one worksheet",
            400,
        );
    }

    const headers = worksheet.getRow(1).values.slice(1); // ignore first undefined
    if (!headers || headers.length === 0) {
        throw new CustomError("Excel file must contain headers", 400);
    }

    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = row.values.slice(1); // 1-based index
        const rowObj = Object.fromEntries(
            headers.map((h, i) => [h, values[i] || ""]),
        );

        rows.push(rowObj);
    });

    if (rows.length === 0) {
        throw new CustomError("Excel file must contain at least one data row", 400);
    }

    const attendees = [];
    for (const row of rows) {
        // format cell with object data type to simple string
        for (const key in row) {
            const value = row[key];
            if (typeof value === "object" && value !== null && "text" in value) {
                row[key] = value.text.trim();
            }
        }

        const { name, firstName, lastName, email, phone, ...others } = row;
        // Validate required fields
        if (!email || !email.trim()) {
            throw new CustomError("Email is required for all attendees", 400);
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            throw new CustomError(`Invalid email format: ${email}`, 400);
        }

        // dynamic based on excel header availability
        const fullName =
            name?.trim() || `${firstName || ""} ${lastName || ""}`.trim();

        if (!fullName || fullName.trim() === "") {
            throw new CustomError(
                `Name is required for attendee with email: ${email}`,
                400,
            );
        }

        attendees.push({
            firstName: firstName || fullName.split(" ")[0] || "",
            lastName: lastName || fullName.slice(1).join(" ") || "",
            email: email.trim(),
            phone: phone || "",
            additionalFields: others,
            eventId,
            organizationId,
        });
    }

    // Check for duplicate emails in the same import
    const emailSet = new Set();
    for (const attendee of attendees) {
        if (emailSet.has(attendee.email)) {
            throw new CustomError(
                `Duplicate email found in import: ${attendee.email}`,
                400,
            );
        }
        emailSet.add(attendee.email);
    }

    // Check if any attendee already exists for this event
    for (const attendee of attendees) {
        const existingRegistration = await exports.getRegistrationByEmail({
            email: attendee.email,
            eventId: eventId,
        });

        if (existingRegistration) {
            throw new CustomError(
                `Registration already exists for email: ${attendee.email}`,
                400,
            );
        }
    }

    let savedRegistrations = [];
    if (attendees.length) {
        // Create registration record
        const registrationSql = `
            INSERT INTO registration (event_id, additional_fields, status)
            VALUES ($1, $2, $3) RETURNING *
        `;

        const registrationValues = [
            eventId,
            JSON.stringify(attendees[0].additionalFields),
            true,
        ];
        const registrationResult = await query(registrationSql, registrationValues);
        const registration = registrationResult.rows[0];

        // Create attendees
        const createdAttendees = await attendeesService.createAttendees({
            registrationId: registration.id,
            attendees: attendees,
        });

        savedRegistrations = [registration];
    }

    //send ticket (async, don't wait)
    savedRegistrations.forEach(async (registration) => {
        try {
            // Fire and forget - don't await
            emailService
                .sendTicketsByRegistrationId({ registrationId: registration.id })
                .catch((error) => {
                    console.error(
                        `Failed to send email for registration ${registration.id}:`,
                        error,
                    );
                });
        } catch (error) {
            console.error(
                `Failed to queue email for registration ${registration.id}:`,
                error,
            );
        }
    });

    return { insertCount: attendees.length };
};

exports.defaultSave = async ({ payload }) => {
    // Check if event has any paid tickets, set 'status = unpaid' by default, after stripe purchase set 'status = paid' thru webhook
    const tickets = await ticketService.getTicketsByEventId({
        eventId: payload.eventId,
    });
    const hasPaidTickets = tickets.some((ticket) => ticket.price > 0);

    // For free events (no paid tickets), set status to true
    // For paid events, set status to false initially (will be updated after payment)
    payload.status = !hasPaidTickets;

    // Handle old single attendee registration structure
    if (payload.registrationData) {
        // Convert old structure to new structure
        const attendee = {
            firstName: payload.registrationData.name?.split(" ")[0] || "",
            lastName:
                payload.registrationData.name?.split(" ").slice(1).join(" ") || "",
            email: payload.registrationData.email || "",
            phone: payload.registrationData.phone || "",
            organization: payload.registrationData.organization || "",
            sector: payload.registrationData.sector || "",
            expectation: payload.registrationData.expectation || "",
            isPrimary: true,
        };

        payload.attendees = [attendee];
        payload.additionalFields = {
            organization: attendee.organization,
            sector: attendee.sector,
            expectation: attendee.expectation,
        };
    }

    // Ensure attendees data is properly structured
    if (payload.attendees && Array.isArray(payload.attendees)) {
        payload.attendees = payload.attendees.map((attendee) => ({
            firstName: attendee.firstName || "",
            lastName: attendee.lastName || "",
            email: attendee.email || "",
            phone: attendee.phone || "",
            isPrimary: attendee.isPrimary || false,
            ticketId: attendee.ticket?.id || attendee.ticketId || null,
            ticketTitle: attendee.ticket?.title || attendee.ticketTitle || null,
        }));
    }

    const result = await exports.save({
        eventId: payload.eventId,
        additionalFields: payload.additionalFields,
        status: payload.status,
        userTimezone: payload.userTimezone,
        timezoneOffset: payload.timezoneOffset,
    });

    return result;
};

exports.save = async ({ eventId, additionalFields, status = false, userTimezone, timezoneOffset }) => {
    const sql = `
        INSERT INTO registration (event_id, additional_fields, user_timezone, timezone_offset, status)
        VALUES ($1, $2, $3, $4, $5) RETURNING *;`;
    const result = await query(sql, [
        eventId,
        JSON.stringify(additionalFields || {}),
        userTimezone || 'UTC',
        timezoneOffset || 0,
        status,
    ]);
    return result.rows[0];
};

exports.getRegistrationById = async ({ registrationId }) => {
    const sql = `
        SELECT r.*,
               e.name     as event_name,
               e.organization_id,
               org.name     as organization_name,
               org.location as organization_location
        FROM registration r
                 JOIN event e ON r.event_id = e.id
                 JOIN organization org ON e.organization_id = org.id
        WHERE r.id = $1;`;
    const result = await query(sql, [registrationId]);
    return result.rows[0];
};

exports.updateStatus = async ({ payload: { id, status } }) => {
    const sql = `
        UPDATE registration
        SET status     = $1,
            updated_at = NOW()
        WHERE id = $2 RETURNING *
    `;
    const result = await query(sql, [status, id]);
    return result.rows[0];
};

exports.getRegistration = async ({ registrationId, qrUuid, isLoggedIn }) => {
    let sql, values;

    if (qrUuid) {
        // For users with QR UUID, validate against attendees table
        sql = `
            SELECT r.*,
                   COALESCE((SELECT SUM((item ->>'quantity')::int)
                             FROM orders o
                                      CROSS JOIN LATERAL jsonb_array_elements(o.items_ticket) AS item
                            WHERE o.registration_id = r.id ), 0) as total_attendees,
                   jsonb_agg(
                           jsonb_build_object(
                                   'id', a.id,
                                   'firstName', a.first_name,
                                   'lastName', a.last_name,
                                   'email', a.email,
                                   'phone', a.phone,
                                   'ticket', a.ticket,
                                   'ticketTitle', a.ticket->>'title',
                                   'qrUuid', a.qr_uuid,
                                   'isPrimary', a.is_primary,
                                   'createdAt', a.created_at,
                                   'updatedAt', a.updated_at
                           )
                   )                                             as attendees
            FROM registration r
                     LEFT JOIN attendees a ON r.id = a.registration_id
            WHERE r.id = $1
              AND a.qr_uuid = $2
            GROUP BY r.id
        `;
        values = [registrationId, qrUuid];
    } else {
        // For logged in users or without QR UUID, just get registration
        sql = `
            SELECT r.*,
                   COALESCE((SELECT SUM((item ->>'quantity')::int)
                             FROM orders o
                                      CROSS JOIN LATERAL jsonb_array_elements(o.items_ticket) AS item
                            WHERE o.registration_id = r.id ), 0) as total_attendees,
                   jsonb_agg(
                           jsonb_build_object(
                                   'id', a.id,
                                   'firstName', a.first_name,
                                   'lastName', a.last_name,
                                   'email', a.email,
                                   'phone', a.phone,
                                   'ticket', a.ticket,
                                   'ticketTitle', a.ticket->>'title',
                                   'qrUuid', a.qr_uuid,
                                   'isPrimary', a.is_primary,
                                   'createdAt', a.created_at,
                                   'updatedAt', a.updated_at
                           )
                   )                                             as attendees
            FROM registration r
                     LEFT JOIN attendees a ON r.id = a.registration_id
            WHERE r.id = $1
            GROUP BY r.id
        `;
        values = [registrationId];
    }

    const result = await query(sql, values);
    return result.rows[0];
};

// Get registration by email and event ID
exports.getRegistrationByEmail = async ({ email, eventId }) => {
    // Validate eventId
    if (!eventId || eventId === "unknown" || isNaN(parseInt(eventId))) {
        throw new CustomError("Invalid event ID", 400);
    }

    const sql = `
        SELECT r.*,
               jsonb_agg(
                       jsonb_build_object(
                               'id', a.id,
                               'firstName', a.first_name,
                               'lastName', a.last_name,
                               'email', a.email,
                               'phone', a.phone,
                               'ticket', a.ticket,
                               'ticketTitle', a.ticket->>'title',
                               'qrUuid', a.qr_uuid,
                               'isPrimary', a.is_primary,
                               'createdAt', a.created_at,
                               'updatedAt', a.updated_at
                       )
               ) as attendees
        FROM registration r
                 LEFT JOIN attendees a ON r.id = a.registration_id
        WHERE a.email = $1
          AND r.event_id = $2
        GROUP BY r.id
        ORDER BY r.created_at DESC LIMIT 1
    `;
    const values = [email, parseInt(eventId)];

    const result = await query(sql, values);
    return result.rows[0];
};

exports.getRegistrationWEventWExtrasPurchase = async ({ registrationId }) => {
    const sql = `
        SELECT jsonb_build_object(
                       'id', r.id,
                       'eventId', r.event_id,
                       'additionalFields', r.additional_fields,
                       'userTimezone', r.user_timezone,
                       'timezoneOffset', r.timezone_offset,
                       'status', r.status,
                       'createdAt', r.created_at,
                       'updatedAt', r.updated_at,
                       'attendees', COALESCE(
                               (SELECT jsonb_agg(
                                               jsonb_build_object(
                                                       'id', a.id,
                                                       'firstName', a.first_name,
                                                       'lastName', a.last_name,
                                                       'email', a.email,
                                                       'phone', a.phone,
                                                       'ticket', a.ticket,
                                                       'ticketTitle', a.ticket->>'title',
                                                       'qrUuid', a.qr_uuid,
                                                       'isPrimary', a.is_primary,
                                                       'createdAt', a.created_at,
                                                       'updatedAt', a.updated_at
                                               )
                                       )
                                FROM attendees a
                                WHERE a.registration_id = r.id), '[]' ::jsonb
                                    )
               )                 AS registration,
               jsonb_build_object(
                       'id', e.id,
                       'name', e.name,
                       'startDate', e.start_datetime,
                       'endDate', e.end_datetime,
                       'location', e.location,
                       'currency', e.currency,
                       'config', e.config
               )                 AS event,
               COALESCE(jsonb_build_object(
                                'id', ep.id,
                                'qrUuid', ep.qr_uuid,
                                'extrasData', ep.extras_data,
                                'status', ep.status,
                                'scannedAt', ep.scanned_at
                        ), NULL) AS extrasPurchase

        FROM registration r
                 JOIN event e ON r.event_id = e.id
                 LEFT JOIN extras_purchase ep ON ep.registration_id = r.id
        WHERE r.id = $1 LIMIT 1
    `;
    const result = await query(sql, [registrationId]);
    return result.rows[0];
};

exports.getRegistrationWithAttendees = async ({ registrationId }) => {
    // Get registration with event and organization info
    const registrationSql = `
        SELECT r.*,
               e.name     as event_name,
               e.organization_id,
               org.name     as organization_name,
               org.location as organization_location
        FROM registration r
                 JOIN event e ON r.event_id = e.id
                 JOIN organization org ON e.organization_id = org.id
        WHERE r.id = $1;`;
    const registrationResult = await query(registrationSql, [registrationId]);

    if (!registrationResult.rows[0]) {
        return null;
    }

    // Get attendees with ticket info
    const attendeesSql = `
        SELECT a.*, a.ticket->>'title' as ticket_title
        FROM attendees a
        WHERE a.registration_id = $1
        ORDER BY a.is_primary DESC, a.id ASC;`;
    const attendeesResult = await query(attendeesSql, [registrationId]);

    const registration = registrationResult.rows[0];
    registration.attendees = attendeesResult.rows;

    return registration;
};

// Get all attendees for an event (flattened structure - one row per attendee)
exports.getAttendees = async ({
    event,
    sortBy = "registration",
    page = 1,
    itemsPerPage = 10,
    offset = 0,
    fetchTotalCount = false
}) => {
    const config = event.config || {};
    const saveAllAttendees = config.saveAllAttendeesDetails === undefined ? true :
        (typeof config.saveAllAttendeesDetails === 'string' ?
            JSON.parse(config.saveAllAttendeesDetails) :
            config.saveAllAttendeesDetails);

    // Get total count if requested
    let totalCount = 0;
    if (fetchTotalCount) {
        const countSql = `
            SELECT COUNT(*) as total
            FROM registration r
                     INNER JOIN attendees a ON r.id = a.registration_id
            WHERE r.event_id = $1
              AND r.status = true
        `;
        const countResult = await query(countSql, [event.id]);
        totalCount = parseInt(countResult.rows[0].total);
    }

    //@formatter:off
    const sql = `
        SELECT r.id         as registration_id,
               r.event_id   as event_id,
               r.additional_fields,
               r.status     as registration_status,
               r.created_at as registration_created_at,
               r.updated_at as registration_updated_at,
               a.id         as attendee_id,
               a.first_name,
               a.last_name,
                a.email,
               a.phone,
               a.ticket->>'title' as ticket_title,
               a.qr_uuid,
               a.is_primary,
               a.created_at as attendee_created_at,
               a.updated_at as attendee_updated_at,
               c.id         as checkin_id,
               c.created_at as checkin_time,
               CASE 
                   WHEN (a.ticket->>'id') IS NOT NULL THEN 
                       jsonb_build_array(
                           jsonb_build_object(
                               'ticketId', (a.ticket->>'id')::int,
                               'title', a.ticket->>'title',
                               'price', (a.ticket->>'price')::numeric,
                               'quantity', 1
                           )
                       )
                   ELSE o.items_ticket
               END as items
        FROM registration r
                 INNER JOIN attendees a ON r.id = a.registration_id
                 LEFT JOIN checkin c ON a.id = c.attendee_id
                 LEFT JOIN orders o ON r.id = o.registration_id
        WHERE r.event_id = $1
          AND r.status = true
        ORDER BY 
          CASE WHEN $2 = 'checkin' THEN 
            c.created_at 
          END DESC NULLS LAST,
          CASE WHEN $2 = 'registration' OR $2 IS NULL THEN r.created_at END DESC
        LIMIT $3 OFFSET $4
    `;

    //@formatter:on
    const result = await query(sql, [event.id, sortBy, itemsPerPage, offset]);

    return {
        items: result.rows,
        totalItems: totalCount,
        page,
        itemsPerPage,
        totalPages: Math.ceil(totalCount / itemsPerPage)
    };
};

// Search attendees by keyword (flattened structure - one row per attendee)
exports.searchAttendees = async ({
    event,
    searchKeyword,
    sortBy = "registration",
    page = 1,
    itemsPerPage = 10,
    offset = 0,
    fetchTotalCount = false
}) => {
    const config = event.config || {};
    const saveAllAttendees = config.saveAllAttendeesDetails === undefined ? true :
        (typeof config.saveAllAttendeesDetails === 'string' ?
            JSON.parse(config.saveAllAttendeesDetails) :
            config.saveAllAttendeesDetails);

    if (!searchKeyword || searchKeyword.trim() === "") {
        // If no search keyword, fall back to getAttendees
        return await exports.getAttendees({
            event,
            sortBy,
            page,
            itemsPerPage,
            offset,
            fetchTotalCount
        });
    }

    const keyword = `%${searchKeyword.trim()}%`;

    // Get total count if requested
    let totalCount = 0;
    if (fetchTotalCount) {
        const countSql = `
            SELECT COUNT(*) as total
            FROM registration r
                     INNER JOIN attendees a ON r.id = a.registration_id
            WHERE r.event_id = $1
              AND r.status = true
              AND (
                a.first_name ILIKE $2 OR
                    a.last_name ILIKE $2 OR
                    a.email ILIKE $2 OR
                    a.phone ILIKE $2
                )
        `;
        const countResult = await query(countSql, [event.id, keyword]);
        totalCount = parseInt(countResult.rows[0].total);
    }

    const sql = `
        SELECT r.id         as registration_id,
               r.event_id   as event_id,
               r.additional_fields,
               r.status     as registration_status,
               r.created_at as registration_created_at,
               r.updated_at as registration_updated_at,
               a.id         as attendee_id,
               a.first_name,
               a.last_name,
               a.email,
               a.phone,
               a.ticket->>'title' as ticket_title,
               a.qr_uuid,
               a.is_primary,
               a.created_at as attendee_created_at,
               a.updated_at as attendee_updated_at,
               c.id         as checkin_id,
               c.created_at as checkin_time,
               CASE 
                   WHEN (a.ticket->>'id') IS NOT NULL THEN 
                       jsonb_build_array(
                           jsonb_build_object(
                               'ticketId', (a.ticket->>'id')::int,
                               'title', a.ticket->>'title',
                               'price', (a.ticket->>'price')::numeric,
                               'quantity', 1
                           )
                       )
                   ELSE o.items_ticket
               END as items
        FROM registration r
                 INNER JOIN attendees a ON r.id = a.registration_id
                 LEFT JOIN checkin c ON a.id = c.attendee_id
                 LEFT JOIN orders o ON r.id = o.registration_id
        WHERE r.event_id = $1
          AND r.status = true
          AND (
            a.first_name ILIKE $2 OR
            a.last_name ILIKE $2 OR
            a.email ILIKE $2 OR
            a.phone ILIKE $2
            )
        ORDER BY CASE
                     WHEN $3 = 'checkin' THEN
                         CASE WHEN c.created_at IS NOT NULL THEN 0 ELSE 1 END
                     END,
                 CASE WHEN $3 = 'registration' OR $3 IS NULL THEN r.created_at END DESC
            LIMIT $4
        OFFSET $5
    `;

    const result = await query(sql, [event.id, keyword, sortBy, itemsPerPage, offset]);

    return {
        items: result.rows,
        totalItems: totalCount,
        page,
        itemsPerPage,
        totalPages: Math.ceil(totalCount / itemsPerPage)
    };
};

exports.removeRegistration = async ({ eventId, registrationId }) => {
    const sql = `
        DELETE
        FROM registration
        WHERE id = $1
          AND event_id = $2 RETURNING *
    `;
    const result = await query(sql, [registrationId, eventId]);
    return result.rows[0];
};

exports.validateExtrasQrCode = async ({ id, qrUuid, eventId }) => {
    const sql = `
        SELECT *, r.id as r_id, ep.id as id
        FROM registration r
                 LEFT JOIN extras_purchase ep ON r.id = ep.registration_id
        WHERE ep.id = $1
          AND r.event_id = $2
          AND r.status = true
    `;
    const result = await query(sql, [id, eventId]);
    const extrasPurchase = result.rows[0];

    if (!extrasPurchase || extrasPurchase.qrUuid != qrUuid) {
        throw new CustomError("Invalid QR Code", 401, extrasPurchase);
    } else if (extrasPurchase.status === true) {
        throw new CustomError("Already Redeemed", 401, extrasPurchase);
    }
    return extrasPurchase;
};

exports.scanByExtrasPurchaseId = async ({ qrCodeData, eventId }) => {
    const { id, qrUuid } = JSON.parse(qrCodeData);
    const extrasPurchase = await exports.validateExtrasQrCode({
        id,
        qrUuid,
        eventId,
    });
    const payload = { id: extrasPurchase.id, status: true };
    const updatedExtrasPurchase = await eventService.updateExtrasPurchaseStatus({
        payload,
    });
    return updatedExtrasPurchase;
};

exports.downloadAttendees = async ({ eventId, timezone = 'UTC' }) => {
    // For download, we need all attendees without pagination
    // First get the event to pass to getAttendees
    const event = await eventService.getEventById({ eventId });

    // Fetch all attendees by using a very large itemsPerPage value
    // This ensures we get all attendees without pagination limits
    const attendeesResult = await exports.getAttendees({
        event,
        fetchTotalCount: false,
        itemsPerPage: 999999, // Very large number to fetch all attendees
        page: 1,
        offset: 0,
        sortBy: 'registration' // Default sort for download
    });
    const attendees = attendeesResult.items;
    const formQuestions = await formService.getFormQuestions({ eventId });

    if (attendees.length === 0)
        throw new CustomError("No data available for report!", 404);

    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet("Attendee Report");

    const sheet_columns = [
        { header: "Registration ID", key: "registration_id", width: 15 },
        { header: "Name", key: "name", width: 25 },
        { header: "Email", key: "email", width: 25 },
        { header: "Phone", key: "phone", width: 20 },
        { header: "Registration Time", key: "registration_time", width: 25 },
        { header: "Checkin Time", key: "checkin_time", width: 25 },
        { header: "Checkin Status", key: "checkin_status", width: 20 },
        { header: "Registration Status", key: "registration_status", width: 20 },
        { header: "Ticket Title", key: "ticket_title", width: 25 },
    ];

    if (formQuestions.length > 0) {
        formQuestions.forEach((q) => {
            sheet_columns.push({
                header: q.text,
                key: `qId_${q.id}`,
                width: 30,
            });
        });
    }

    worksheet.columns = sheet_columns;

    attendees.forEach((item) => {
        const rowData = {
            registration_id: item.registrationId,
            name: `${item.firstName || ""} ${item.lastName || ""}`.trim(),
            email: item.email || "",
            phone: item.phone || "",
            registration_time: item.registrationCreatedAt
                ? formatInTimezone(item.registrationCreatedAt, timezone)
                : "",
            checkin_time: item.checkinTime ? formatInTimezone(item.checkinTime, timezone) : "",
            checkin_status: item.checkinId ? "Checked-in" : "Pending",
            registration_status: item.registrationStatus ? "Active" : "Inactive",
            ticket_title: item.ticketTitle || "N/A",
        };

        // Handle dynamic form questions from additional_fields
        const additionalFields = item.additionalFields || {};

        // Map questions by text to match additionalFields keys if they were saved by text
        if (formQuestions.length > 0) {
            formQuestions.forEach((q) => {
                // Try to find the answer in additionalFields by question text or ID
                const value = additionalFields[q.text] || additionalFields[q.id] || additionalFields[`qId_${q.id}`];
                if (value) {
                    rowData[`qId_${q.id}`] = value;
                }
            });
        }

        // Also include any other fields that might be in additionalFields but not in formQuestions
        Object.keys(additionalFields).forEach((key) => {
            // Skip if already processed via formQuestions
            const isFormQuestion = formQuestions.some(q => q.text === key || q.id.toString() === key || `qId_${q.id}` === key);
            if (!isFormQuestion) {
                const value = additionalFields[key];
                if (value && (typeof value === "string" || typeof value === "number")) {
                    // Check if column already exists
                    const colKey = `additional_${key}`;
                    if (!worksheet.getColumn(colKey).header) {
                        const currentCols = worksheet.columns;
                        currentCols.push({ header: key, key: colKey, width: 25 });
                        worksheet.columns = currentCols;
                    }
                    rowData[colKey] = value;
                }
            }
        });

        worksheet.addRow(rowData);
    });

    return workbook;
};

// Initialize registration with extras and payment intent
exports.initRegistration = async (payload) => {
    const { newRegistration, extrasIds } = payload;

    if (!newRegistration) {
        throw new CustomError("New registration data is required", 400);
    }

    const savedRegistration = await exports.defaultSave({
        payload: newRegistration,
    });

    let savedExtrasPurchase = null;
    if (extrasIds?.length) {
        savedExtrasPurchase = await eventService.saveExtrasPurchase({
            extrasIds: extrasIds,
            registrationId: savedRegistration.id,
        });
    }

    const { clientSecret } = await stripeService.createPaymentIntent({
        payload: {
            savedRegistration,
            savedExtrasPurchase,
            extrasIds: extrasIds,
        },
    });

    let responseMsg = null;
    if (clientSecret === "no-stripe") {
        // For free events, we'll handle email sending after payment success
        // increase registration_count in event
        await eventService.increaseRegistrationCount({
            eventId: savedRegistration.eventId,
        });
    }

    return {
        savedRegistration,
        clientSecret,
    };
};

// Complete free registration (no payment required)
exports.completeFreeRegistration = async ({ payload }) => {
    const { attendees, selectedTickets, selectedProducts, registration, eventId, sessionId: providedSessionId } = payload;

    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        throw new CustomError("Attendees are required", 400);
    }

    if (
        !selectedTickets ||
        !Array.isArray(selectedTickets) ||
        selectedTickets.length === 0
    ) {
        throw new CustomError("Selected tickets are required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    let sessionData = null;
    if (providedSessionId) {
        const tempRegistrationService = require("./tempRegistration");
        sessionData = await tempRegistrationService.getTempRegistration(providedSessionId);
    }

    // Verify all tickets are free, OR it's a promo-discounted free order
    const hasPaidTickets = selectedTickets.some((ticket) => ticket.price > 0);
    const isPromoFree = sessionData?.orders?.total_amount === 0;

    if (hasPaidTickets && !isPromoFree) {
        throw new CustomError(
            "Cannot process free registration with paid tickets",
            400,
        );
    }

    // Check for duplicate email registrations for this event
    for (const attendee of attendees) {
        const existingRegistration = await exports.getRegistrationByEmail({
            email: attendee.email,
            eventId,
        });

        if (existingRegistration) {
            throw new CustomError(
                `Registration already exists for email: ${attendee.email}`,
                400,
            );
        }
    }

    try {
        // Note: temp_registration should already be saved on checkout page mount
        const sessionId = providedSessionId || generateSessionId();

        // 1. Create registration record
        const savedRegistration = await exports.save({
            eventId,
            status: true, // Free registrations are immediately active
            additionalFields: registration?.additionalFields || {},
            userTimezone: registration?.userTimezone,
            timezoneOffset: registration?.timezoneOffset,
        });

        // 2. Create attendees
        const attendeesWithRegistrationId = attendees.map((attendee) => ({
            ...attendee,
            registrationId: savedRegistration.id,
        }));

        const savedAttendees = await attendeesService.createAttendees({
            registrationId: savedRegistration.id,
            attendees: attendeesWithRegistrationId,
        });

        // 3. Create order record for free registration
        const totalAmount = isPromoFree ? 0 : selectedTickets.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
        );

        // Get event data to access currency
        const event = await eventService.getEventById({ eventId });
        if (!event) {
            throw new CustomError("Event not found", 404);
        }

        const savedOrder = await orderService.save({
            payload: {
                ...(sessionData?.orders || {}),
                orderNumber: sessionData?.orders?.order_number || orderService.generateOrderNumber(),
                totalAmount: totalAmount,
                currency: event.currency,
                paymentStatus: "paid", // Free orders are immediately paid (using 'paid' instead of 'free' for consistency with orders table status if needed, or stick to 'free' if it doesn't matter. The check in schema said: pending, paid, failed, refunded)
                // Wait, checkout.vue uses 'paid' or 'free'. Schema says: pending, paid, failed, refunded.
                // Actually let's use 'paid' because it's technically settled.
                itemsTicket: selectedTickets,
                itemsProduct: selectedProducts || [],
                registrationId: savedRegistration.id,
                eventId,
                itemsProduct: selectedProducts || [],
                registrationId: savedRegistration.id,
                eventId,
                paymentMethod: isPromoFree ? "free" : "free", // Logic: if promo made it free, it's still free.
            },
        });

        // 4. Reduce ticket stock
        for (const item of selectedTickets) {
            await ticketService.updateStock({
                ticketId: item.ticketId,
                quantity: item.quantity,
                salesChannel: "online"
            });
        }

        // 5. Increase registration count in event
        await eventService.increaseRegistrationCount({
            eventId: eventId,
        });

        // 6. Mark visitor as converted (if they were a visitor)
        // Use primary attendee email to mark visitor as converted
        if (savedAttendees && savedAttendees.length > 0) {
            const primaryAttendee = savedAttendees.find(a => a.is_primary) || savedAttendees[0];
            if (primaryAttendee && primaryAttendee.email) {
                try {
                    await eventVisitorService.markVisitorConverted({
                        eventId: eventId,
                        email: primaryAttendee.email,
                    });
                } catch (error) {
                    // Don't fail registration if visitor marking fails
                    console.warn(`Failed to mark visitor as converted:`, error);
                }
            }
        }

        // 7. Send confirmation emails (async, don't wait)
        // sendTicketsByRegistrationId handles all attendees based on event config
        // Only call it ONCE per registration, not once per attendee
        try {
            emailService
                .sendTicketsByRegistrationId({
                    registrationId: savedRegistration.id,
                })
                .catch((error) => {
                    console.error(`Failed to send confirmation emails:`, error);
                    // Don't fail the registration if email fails
                });
        } catch (error) {
            console.error(`Failed to queue confirmation emails:`, error);
            // Don't fail the registration if email fails
        }

        // Enrich attendees with ticket details for the frontend success page state
        const enrichedAttendees = savedAttendees.map(attendee => {
            return {
                ...attendee,
                ticketTitle: attendee.ticket?.title || 'Unknown Ticket',
                price: attendee.ticket?.price || 0,
                // Ensure field names match what success.vue expects
            };
        });

        return {
            registrationId: savedRegistration.id,
            orderId: savedOrder.id,
            attendees: enrichedAttendees,
            order: savedOrder,
            event: event, // Include full event data
            registration: savedRegistration,
            status: true,
        };
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        throw new CustomError("Failed to complete free registration", 500);
    }
};

// Get complete free registration confirmation data including order details
exports.getFreeRegistrationConfirmation = async ({ registrationId }) => {
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    try {
        // 1. Get registration with attendees
        const registration = await exports.getRegistration({
            registrationId,
            isLoggedIn: false,
        });
        if (!registration) {
            throw new CustomError("Registration not found", 404);
        }

        // 2. Get order data for this registration
        const order = await orderService.getOrderByRegistrationId({
            registrationId,
        });
        if (!order) {
            throw new CustomError("Order not found for this registration", 404);
        }

        // 3. Get event data to include config
        const event = await eventService.getEventById({ eventId: registration.eventId });
        if (!event) {
            throw new CustomError("Event not found", 404);
        }

        // 4. Get ticket details for attendees
        const attendeesWithTickets = registration.attendees.map((attendee) => {
            if (attendee.ticket) {
                return {
                    ...attendee,
                    ticketTitle: attendee.ticket.title || "Unknown Ticket",
                    price: attendee.ticket.price || 0,
                };
            }
            return attendee;
        });

        // 5. Return complete data structure
        return {
            registration: {
                id: registration.id,
                eventId: registration.eventId,
                status: registration.status,
                additionalFields: registration.additionalFields,
                createdAt: registration.createdAt,
                updatedAt: registration.updatedAt,
            },
            event: {
                id: event.id,
                name: event.name,
                config: event.config,
            },
            attendees: attendeesWithTickets,
            order: {
                id: order.id,
                orderNumber: order.orderNumber,
                totalAmount: order.totalAmount,
                currency: order.currency,
                paymentStatus: order.paymentStatus,
                items: order.items_ticket || order.items, // Map snake_case to camelCase
                itemsTicket: order.items_ticket,
                itemsProduct: order.items_product,
                productStatus: order.product_status,
                registrationId: order.registrationId,
                eventId: order.eventId,
                createdAt: order.createdAt,
                updatedAt: order.updatedAt,
            },
        };
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }
        throw new CustomError(
            "Failed to retrieve free registration confirmation data",
            500,
        );
    }
};

// Complete Counter sale (cash/card/etc at physical counter)
exports.completeCounterSale = async ({ payload, currentUser }) => {
    const {
        attendees,
        selectedTickets,
        selectedProducts,
        registration,
        eventId,
        cashSessionId,
        ticketCounterId,
        paymentMethod,
        promoCode
    } = payload;

    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        throw new CustomError("Attendees are required", 400);
    }

    if ((!selectedTickets || !Array.isArray(selectedTickets) || selectedTickets.length === 0) &&
        (!selectedProducts || !Array.isArray(selectedProducts) || selectedProducts.length === 0)) {
        throw new CustomError("Selected items (tickets or products) are required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!cashSessionId) {
        throw new CustomError("Active cash session is required for Counter sales", 400);
    }

    // 1. Validate promo code if provided
    let discountAmount = 0;
    let validatedPromo = null;
    if (promoCode) {
        const promoCodeService = require("./promoCode");
        validatedPromo = await promoCodeService.validatePromoCode({ code: promoCode, eventId });
        // Calculate discount - this is a simplified version, should be applied to total
    }

    try {
        // 1. Create registration record
        const savedRegistration = await exports.save({
            eventId,
            status: true,
            additionalFields: registration?.additionalFields || {},
            userTimezone: registration?.userTimezone,
            timezoneOffset: registration?.timezoneOffset,
        });

        // 2. Create attendees
        const attendeesWithRegistrationId = attendees.map((attendee, index) => {
            const attendeeData = {
                ...attendee,
                registrationId: savedRegistration.id,
            };

            // For counter sales, if attendee has no ticket snapshot, assign from selectedTickets
            if (!attendeeData.ticket && selectedTickets && selectedTickets.length > 0) {
                // Map to the corresponding ticket in selectedTickets if possible, else take the first one
                const ticketSnapshot = selectedTickets[index] || selectedTickets[0];
                attendeeData.ticket = {
                    id: ticketSnapshot.ticketId,
                    title: ticketSnapshot.title,
                    price: ticketSnapshot.price
                };
            }
            return attendeeData;
        });

        const savedAttendees = await attendeesService.createAttendees({
            registrationId: savedRegistration.id,
            attendees: attendeesWithRegistrationId,
        });

        // 3. Create order record
        let totalTicketsAmount = (selectedTickets || []).reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
        );
        let totalProductsAmount = (selectedProducts || []).reduce(
            (sum, item) => sum + item.price * item.quantity,
            0,
        );
        let totalAmount = totalTicketsAmount + totalProductsAmount;

        // Apply promo discount if any
        if (validatedPromo) {
            if (validatedPromo.discount_type === 'percentage') {
                discountAmount = (totalAmount * validatedPromo.discount_value) / 100;
            } else {
                discountAmount = validatedPromo.discount_value;
            }
            totalAmount = Math.max(0, totalAmount - discountAmount);
        }

        const event = await eventService.getEventById({ eventId });
        const savedOrder = await orderService.save({
            payload: {
                orderNumber: orderService.generateOrderNumber(),
                totalAmount: totalAmount,
                currency: event.currency,
                paymentStatus: "paid", // Counter sales are immediately paid
                itemsTicket: selectedTickets || [],
                itemsProduct: selectedProducts || [],
                registrationId: savedRegistration.id,
                eventId,
                salesChannel: "counter",
                cashierId: currentUser.id,
                ticketCounterId,
                cashSessionId,
                paymentMethod: paymentMethod || "cash",
                promoCode: promoCode || null,
                discountAmount: discountAmount || 0,
            },
        });

        // 4. Reduce ticket stock
        // 4. Reduce ticket stock
        const ticketService = require("./ticket");

        for (const item of selectedTickets) {
            await ticketService.updateStock({
                ticketId: item.ticketId,
                quantity: item.quantity,
                salesChannel: "counter"
            });
        }

        // 5. Update promo code use count
        if (validatedPromo) {
            const promoCodeService = require("./promoCode");
            await promoCodeService.incrementUseCount({ id: validatedPromo.id });
        }

        // 6. Increase registration count
        await eventService.increaseRegistrationCount({ eventId });

        // 7. Send confirmation emails
        emailService.sendTicketsByRegistrationId({
            registrationId: savedRegistration.id,
        }).catch(err => console.error("Email failed:", err));

        // 8. Fetch attendees with ticket titles for display
        const attendeesWithTitles = await attendeesService.getAttendeesByRegistrationId({
            registrationId: savedRegistration.id
        });

        return {
            registrationId: savedRegistration.id,
            orderId: savedOrder.id,
            attendees: attendeesWithTitles,
            status: true,
        };
    } catch (error) {
        throw error instanceof CustomError ? error : new CustomError("Failed to process Counter sale", 500);
    }
};
exports.downloadTicketPdf = async ({ attendeeId, qrUuid }) => {
    // 1. Get attendee details with event and organization
    const attendee = await attendeesService.getAttendeeByIdAndQrUuid({
        attendeeId,
        qrUuid
    });

    if (!attendee) {
        throw new CustomError("Ticket not found or invalid", 404);
    }

    // 2. Get full event details
    const event = await eventService.getEventById({ eventId: attendee.event_id || attendee.eventId });
    if (!event) {
        throw new CustomError("Event not found", 404);
    }

    // 3. Get organization details
    const organization = await query(
        "SELECT * FROM organization WHERE id = $1",
        [attendee.organization_id || attendee.organizationId]
    ).then(res => res.rows[0]);

    if (!organization) {
        throw new CustomError("Organization not found", 404);
    }

    return await pdfService.generateTicketPdf({
        attendee: {
            ...attendee,
            id: attendee.id || attendeeId,
            firstName: attendee.first_name || attendee.firstName,
            lastName: attendee.last_name || attendee.lastName,
            qrUuid: attendee.qr_uuid || attendee.qrUuid || qrUuid,
            registrationId: attendee.registration_id || attendee.registrationId,
            ticketTitle: attendee.ticket_title || attendee.ticketTitle || 'General Admission',
            userTimezone: attendee.user_timezone || attendee.userTimezone
        },
        event: {
            ...event,
            startDate: event.startDatetime || event.startDate || event.start_datetime || event.start_date,
            location: event.location || 'Online'
        },
        organization: {
            ...organization,
            name: organization.name || 'Ticketi Organization'
        }
    });
};
