const { query } = require("../db");
const { v4: uuidv4 } = require("uuid");
const CustomError = require("../model/CustomError");

exports.createAttendees = async ({ registrationId, attendees }) => {
    if (!attendees || attendees.length === 0) {
        return [];
    }

    // Generate QR UUIDs if not already provided
    const attendeesWithQr = attendees.map((attendee, index) => ({
        ...attendee,
        qrUuid: attendee.qrUuid || uuidv4(),
    }));

    // Build batch insert query
    const values = attendeesWithQr
        .map((attendee, index) => {
            const offset = index * 9; // 8 columns per attendee
            return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`;
        })
        .join(", ");

    const sql = `
        INSERT INTO attendees (registration_id, is_primary, first_name, last_name, email, phone, ticket_id, qr_uuid,
                               session_id)
        VALUES ${values} RETURNING *;`;

    // Flatten the values array for the query
    const queryValues = attendeesWithQr.flatMap((attendee) => [
        registrationId,
        attendee.isPrimary,
        attendee.firstName,
        attendee.lastName,
        attendee.email,
        attendee.phone,
        attendee.ticketId,
        attendee.qrUuid,
        attendee.sessionId,
    ]);

    const result = await query(sql, queryValues);
    return result.rows;
};

exports.getAttendeeByQrUuid = async ({ qrUuid }) => {
    const sql = `
        SELECT a.*, r.event_id, e.organization_id, r.status as registration_status
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
                 JOIN event e ON r.event_id = e.id
        WHERE a.qr_uuid = $1
    `;
    const result = await query(sql, [qrUuid]);
    return result.rows[0];
};

// Enhanced validation using both attendeeId and qrUuid for security
exports.getAttendeeByIdAndQrUuid = async ({ attendeeId, qrUuid }) => {
    const sql = `
        SELECT a.*,
               r.event_id,
               e.organization_id,
               r.status as registration_status,
               r.user_timezone,
               t.title  as ticket_title
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
                 JOIN event e ON r.event_id = e.id
                 LEFT JOIN ticket t ON a.ticket_id = t.id
        WHERE a.id = $1
          AND a.qr_uuid = $2
    `;
    const result = await query(sql, [attendeeId, qrUuid]);
    return result.rows[0];
};

// Triple validation using registrationId, attendeeId, and qrUuid for maximum security
exports.getAttendeeByIdRegistrationAndQrUuid = async ({
    registrationId,
    attendeeId,
    qrUuid,
}) => {
    const sql = `
        SELECT a.*,
               r.event_id,
               r.status     as registration_status,
               t.title      as ticket_title,
               r.created_at as registration_date
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
                 LEFT JOIN ticket t ON a.ticket_id = t.id
        WHERE a.registration_id = $1
          AND a.id = $2
          AND a.qr_uuid = $3
    `;
    const result = await query(sql, [registrationId, attendeeId, qrUuid]);
    return result.rows[0];
};

exports.getAttendeesByRegistrationId = async ({ registrationId }) => {
    const sql = `
        SELECT a.*, t.title as ticket_title
        FROM attendees a
                 LEFT JOIN ticket t ON a.ticket_id = t.id
        WHERE a.registration_id = $1
        ORDER BY a.is_primary DESC, a.id ASC;`;
    const result = await query(sql, [registrationId]);
    return result.rows;
};

exports.getRegistrationWithAttendees = async ({ registrationId }) => {
    const sql = `
        SELECT r.*,
               COALESCE(
                       json_agg(
                               json_build_object(
                                       'id', a.id,
                                       'isPrimary', a.is_primary,
                                       'firstName', a.first_name,
                                       'lastName', a.last_name,
                                       'email', a.email,
                                       'phone', a.phone,
                                       'ticketId', a.ticket_id,
                                       'qrUuid', a.qr_uuid,
                                       'isCheckedIn', CASE WHEN c.id IS NOT NULL THEN true ELSE false END,
                                       'checkedInAt', c.created_at
                               ) ORDER BY a.is_primary DESC, a.created_at ASC
                       ) FILTER(WHERE a.id IS NOT NULL),
                       '[]' ::json
               ) as attendees
        FROM registration r
                 LEFT JOIN attendees a ON r.id = a.registration_id
                 LEFT JOIN checkin c ON a.id = c.attendee_id
        WHERE r.id = $1
        GROUP BY r.id
    `;

    const result = await query(sql, [registrationId]);
    return result.rows[0];
};

exports.getAttendeeById = async ({ attendeeId }) => {
    if (!attendeeId) {
        throw new CustomError("Attendee ID is required", 400);
    }

    const sql = `
        SELECT a.*, r.event_id, r.status as registration_status
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
        WHERE a.id = $1
    `;
    const result = await query(sql, [attendeeId]);
    if (result.rows.length === 0) {
        throw new CustomError("Attendee not found", 404);
    }
    return result.rows[0];
};

exports.deleteAttendee = async ({ attendeeId, eventId }) => {
    if (!attendeeId) {
        throw new CustomError("Attendee ID is required", 400);
    }
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    // First verify the attendee exists and belongs to the event
    const verifySql = `
        SELECT a.id, a.registration_id, r.event_id, r.status as registration_status
        FROM attendees a
                 JOIN registration r ON a.registration_id = r.id
        WHERE a.id = $1
          AND r.event_id = $2
    `;
    const verifyResult = await query(verifySql, [attendeeId, eventId]);
    if (verifyResult.rows.length === 0) {
        throw new CustomError("Attendee not found for this event", 404);
    }

    const attendee = verifyResult.rows[0];

    // Check if this is the last attendee in the registration
    const countSql = `
        SELECT COUNT(*) as attendee_count
        FROM attendees
        WHERE registration_id = $1
    `;
    const countResult = await query(countSql, [attendee.registrationId]);
    const attendeeCount = parseInt(countResult.rows[0].attendeeCount);

    if (attendeeCount === 1) {
        // If this is the last attendee, delete the entire registration
        const deleteRegistrationSql = `DELETE
                                       FROM registration
                                       WHERE id = $1`;
        await query(deleteRegistrationSql, [attendee.registrationId]);
        return {
            message: "Registration deleted (last attendee removed)",
            deletedRegistration: true,
        };
    } else {
        // If there are other attendees, just delete this attendee
        const deleteAttendeeSql = `DELETE
                                   FROM attendees
                                   WHERE id = $1`;
        const deleteResult = await query(deleteAttendeeSql, [attendeeId]);
        if (deleteResult.rowCount === 0) {
            throw new CustomError("Failed to delete attendee", 500);
        }
        return {
            message: "Attendee deleted successfully",
            deletedRegistration: false,
        };
    }
};

exports.getAttendeesBySessionId = async (sessionId) => {
    if (!sessionId) {
        return [];
    }
    const sql = `SELECT * FROM attendees WHERE session_id = $1`;
    const result = await query(sql, [sessionId]);
    return result.rows;
};
