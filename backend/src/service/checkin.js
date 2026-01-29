const { query } = require("../db");
const CustomError = require("../model/CustomError");
const fs = require("fs");
const path = require("path");
const handlebars = require("handlebars");
const { generateQrCode, getApiPublicImgUrl } = require("../utils/common");
const { getBrandingData } = require("../utils/branding");
const attendeesService = require("./attendees");
const eventService = require("./event");

exports.save = async ({ newCheckin }) => {
    if (!newCheckin) {
        throw new CustomError("Checkin data is required", 400);
    }

    if (!newCheckin.attendeeId) {
        throw new CustomError("Attendee ID is required", 400);
    }

    if (!newCheckin.registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    if (!newCheckin.checkedInBy) {
        throw new CustomError("Checked in by user ID is required", 400);
    }

    const sql = `
        INSERT INTO checkin (attendee_id, registration_id, checked_in_by)
        VALUES ($1, $2, $3) RETURNING *
    `;
    const values = [
        newCheckin.attendeeId,
        newCheckin.registrationId,
        newCheckin.checkedInBy,
    ];
    const result = await query(sql, values);

    if (!result.rows[0]) {
        throw new CustomError("Failed to create checkin record", 500);
    }

    return result.rows[0];
};

exports.delete = async ({ attendeeId, eventId }) => {
    if (!attendeeId) {
        throw new CustomError("Attendee ID is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    // First verify the attendee belongs to the specified event
    const verifySql = `
        SELECT c.id
        FROM checkin c
                 JOIN attendees a ON c.attendee_id = a.id
                 JOIN registration r ON a.registration_id = r.id
        WHERE c.attendee_id = $1
          AND r.event_id = $2
    `;

    const verifyResult = await query(verifySql, [attendeeId, eventId]);

    if (verifyResult.rows.length === 0) {
        throw new CustomError(
            "Checkin record not found for this attendee and event",
            404,
        );
    }

    // Delete the checkin record
    const deleteSql = `
        DELETE
        FROM checkin
        WHERE attendee_id = $1
    `;

    const deleteResult = await query(deleteSql, [attendeeId]);

    if (deleteResult.rowCount === 0) {
        throw new CustomError("Failed to delete checkin record", 500);
    }

    return { message: "Checkin record deleted successfully" };
};

exports.getCheckinByRegistrationId = async ({ registrationId }) => {
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM checkin
        WHERE registration_id = $1
    `;
    const result = await query(sql, [registrationId]);
    return result.rows;
};

exports.getStatistics = async ({ eventId }) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT COUNT(DISTINCT a.id)          as "totalAttendees",
               COUNT(DISTINCT c.attendee_id) as "checkedInCount"
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
                 LEFT JOIN checkin c ON a.id = c.attendee_id
        WHERE r.event_id = $1
          AND r.status = true
    `;

    const result = await query(sql, [eventId]);

    return {
        totalRegistrations: result.rows[0].totalAttendees || 0,
        totalCheckins: result.rows[0].checkedInCount || 0,
        successfulCheckins: result.rows[0].checkedInCount || 0,
        totalAttendees: result.rows[0].totalAttendees || 0,
        totalCheckedInAttendees: result.rows[0].checkedInCount || 0,
    };
};

// Minimal single-query validation: verifies event match, registration active, QR match, and not already checked-in
exports.validateQrCode = async ({ registrationId, attendeeId, qrUuid, eventId }) => {
    if (!registrationId || !attendeeId || !qrUuid || !eventId) {
        throw new CustomError("Invalid QR Code", 400);
    }

    const sql = `
        SELECT a.id                                                AS attendee_id,
               a.first_name,
               a.last_name,
               a.email,
               a.phone,
               a.ticket->>'title'                                  AS ticket_title,
               (a.ticket->>'id')::int                              AS ticket_id,
               r.id                                                AS registration_id,
               a.qr_uuid,
               r.status                                            AS registration_status,
               r.event_id,
               a.order_id,
               o.order_number,
               o.payment_status,
               (CASE WHEN c.attendee_id IS NULL THEN 0 ELSE 1 END) AS is_checked_in
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
                 LEFT JOIN orders o ON a.order_id = o.id
                 LEFT JOIN checkin c ON c.attendee_id = a.id
        WHERE r.id = $1
          AND r.event_id = $2
          AND r.status = true
          AND a.id = $3
          AND a.qr_uuid = $4 LIMIT 1
    `;

    const result = await query(sql, [registrationId, eventId, attendeeId, qrUuid]);
    const row = result.rows?.[0];

    if (!row) {
        throw new CustomError("Invalid QR Code", 401);
    }

    if (Number(row.isCheckedIn) > 0) {
        throw new CustomError("Already checked-in", 401);
    }

    return {
        id: row.attendeeId,
        registrationId: row.registrationId,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        ticketTitle: row.ticketTitle,
        ticketId: row.ticketId,
        qrUuid: row.qrUuid,
        registrationStatus: row.registrationStatus,
        orderId: row.orderId,
        orderNumber: row.orderNumber,
        paymentStatus: row.paymentStatus,
    };
};

const badgeTemplatePath = path.join(
    __dirname,
    "../templates/badgeTemplate.html",
);
const badgeTemplateSource = fs.readFileSync(badgeTemplatePath, "utf8");

exports.scanByRegistrationId = async ({ qrCodeData, eventId, userId }) => {
    if (!qrCodeData) {
        throw new CustomError("QR code data is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    let qrData;
    try {
        qrData = JSON.parse(qrCodeData);
    } catch (error) {
        throw new CustomError("Invalid QR code data format", 400);
    }

    const { r: registrationId, a: attendeeId, q: qrUuid } = qrData;

    if (!registrationId || !attendeeId || !qrUuid) {
        throw new CustomError("Invalid QR code", 400);
    }

    // Minimal single validation query (includes event match and check-in status)
    const attendee = await exports.validateQrCode({
        registrationId,
        attendeeId,
        qrUuid,
        eventId,
    });

    // Create a check-in record (idempotent: if already has checkin id we would have thrown above)
    const newCheckin = {
        attendeeId: attendee.id,
        registrationId: attendee.registrationId,
        checkedInBy: userId,
    };
    const checkinRecord = await exports.save({ newCheckin });

    // Get event config to check saveAllAttendeesDetails
    const event = await eventService.getEventById({ eventId });
    const saveAllAttendees = event?.config?.saveAllAttendeesDetails;

    // Compute total attendees for this ORDER (more accurate than registration-wide)
    const totalSql = `
        SELECT COALESCE(SUM((item ->>'quantity')::int), 0) AS total_attendees
        FROM orders o
                 CROSS JOIN LATERAL jsonb_array_elements(o.items_ticket) AS item
        WHERE o.id = $1
    `;
    const totalResult = await query(totalSql, [attendee.orderId]);
    const totalAttendees = totalResult.rows?.[0]?.totalAttendees || 0;

    // Get order items for display (tickets and products)
    const itemsSql = `
        SELECT items_ticket, items_product
        FROM orders
        WHERE id = $1
    `;
    const itemsResult = await query(itemsSql, [attendee.orderId]);
    const itemsTicket = itemsResult.rows?.[0]?.itemsTicket || [];
    const itemsProduct = itemsResult.rows?.[0]?.itemsProduct || [];
    const items = [...itemsTicket, ...itemsProduct];

    return {
        ...attendee,
        checkinTime: checkinRecord.createdAt,
        totalAttendees,
        items
    };
};

const compileBadgeTemplate = handlebars.compile(badgeTemplateSource);

exports.getBadgeHtml = async ({ registration, event }) => {
    if (!registration) {
        throw new CustomError("Registration data is required", 400);
    }

    if (!event) {
        throw new CustomError("Event data is required", 400);
    }

    const qrCode = await generateQrCode({
        id: registration.id,
        qrUuid: registration.qrUuid,
    });

    const header = await getBrandingData();

    const html = compileBadgeTemplate({
        header,
        event,
        eventBanner: event.banner
            ? getApiPublicImgUrl(event.banner, "event-banner")
            : null,
        registration,
        qrCode,
    });

    return html;
};

// Scan by registration ID with badge generation
exports.scanWithBadge = async ({
    eventId,
    userId,
    attendeeIndex = 0,
    ...otherData
}) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }
    if (!userId) {
        throw new CustomError("User ID is required", 400);
    }

    const checkinResult = await exports.scanByRegistrationId({
        ...otherData,
        eventId: eventId,
        userId: userId,
        attendeeIndex: attendeeIndex,
    });

    const event = await eventService.getEventById({ eventId: eventId });

    if (!event) {
        throw new CustomError("Event not found", 404);
    }

    // Use attendee info from the validated attendee
    const attendeeInfo = checkinResult.attendee;

    const badgeHtml = await exports.getBadgeHtml({
        registration: {
            id: checkinResult.id,
            qrUuid: checkinResult.qrUuid,
            name: `${attendeeInfo.firstName} ${attendeeInfo.lastName}`,
            email: attendeeInfo.email,
            ticketTitle: attendeeInfo.ticketTitle,
        },
        event: {
            name: event.name,
            banner: event.banner,
        },
    });

    return {
        checkinResult,
        badgeHtml,
    };
};
