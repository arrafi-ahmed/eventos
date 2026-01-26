const { query } = require("../db");
const CustomError = require("../model/CustomError");

// Store temporary registration data
exports.storeTempRegistration = async (payload) => {
    const {
        sessionId,
        attendees,
        registration,
        selectedTickets,
        selectedProducts,
        eventId,
        orders,
    } = payload;

    try {
        // Validate input data
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }
        if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
            throw new CustomError(
                "Attendees are required and must be a non-empty array",
                400,
            );
        }
        if (!registration) {
            throw new CustomError("Registration data is required", 400);
        }
        if (!selectedTickets || !Array.isArray(selectedTickets)) {
            throw new CustomError(
                "Selected tickets are required and must be an array",
                400,
            );
        }
        if (selectedProducts && !Array.isArray(selectedProducts)) {
            throw new CustomError(
                "Selected products must be an array if provided",
                400,
            );
        }
        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now

        const queryText = `
            INSERT INTO temp_registration
            (session_id, attendees, registration, selected_tickets, selected_products, orders, event_id, expires_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT (session_id) DO
            UPDATE SET
                attendees = EXCLUDED.attendees,
                registration = EXCLUDED.registration,
                selected_tickets = EXCLUDED.selected_tickets,
                selected_products = EXCLUDED.selected_products,
                orders = EXCLUDED.orders,
                event_id = EXCLUDED.event_id,
                expires_at = EXCLUDED.expires_at
        `;

        await query(queryText, [
            sessionId,
            JSON.stringify(attendees),
            JSON.stringify(registration),
            JSON.stringify(selectedTickets),
            JSON.stringify(selectedProducts || []),
            JSON.stringify(orders),
            eventId,
            expiresAt,
        ]);

        return true;
    } catch (error) {
        console.error("Error storing temporary attendee data:", error);
        throw error;
    }
};

// Get all temporary registrations
exports.getAllTempRegistrations = async () => {
    try {
        const queryText = `
            SELECT *
            FROM temp_registration
            WHERE expires_at > NOW()
        `;

        const result = await query(queryText);
        return result.rows;
    } catch (error) {
        console.error("Error retrieving all temporary registrations:", error);
        throw error;
    }
};

// Get temporary registration by Orange Money transaction ID
exports.getTempRegistrationByOmTransactionId = async (omTransactionId) => {
    try {
        const queryText = `
            SELECT *
            FROM temp_registration
            WHERE (orders ->> 'omTransactionId' = $1 OR orders ->> 'om_transaction_id' = $1)
              AND expires_at > NOW()
            LIMIT 1
        `;

        const result = await query(queryText, [omTransactionId]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        console.error("Error retrieving temporary registration by OM Transaction ID:", error);
        throw error;
    }
};

// Get temporary registration by Orange Money notification token
exports.getTempRegistrationByOmNotifToken = async (omNotifToken) => {
    try {
        const queryText = `
            SELECT *
            FROM temp_registration
            WHERE (orders ->> 'omNotifToken' = $1 OR orders ->> 'om_notif_token' = $1)
              AND expires_at > NOW()
            LIMIT 1
        `;

        const result = await query(queryText, [omNotifToken]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    } catch (error) {
        console.error("Error retrieving temporary registration by OM Notif Token:", error);
        throw error;
    }
};

// Update existing temporary registration data
exports.updateTempRegistration = async (sessionId, updates) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        // 1. Get existing data
        const current = await exports.getTempRegistration(sessionId);
        if (!current) {
            throw new CustomError("Session not found", 404);
        }

        // 2. Merge data
        const merged = {
            sessionId,
            attendees: updates.attendees || current.attendees,
            registration: updates.registration || current.registration,
            selectedTickets: updates.selectedTickets || current.selected_tickets || current.selectedTickets,
            selectedProducts: updates.selectedProducts || current.selected_products || current.selectedProducts,
            eventId: updates.eventId || current.event_id || current.eventId,
            orders: updates.orders || current.orders,
        };

        // 3. Store back using the upsert logic in storeTempRegistration
        return await exports.storeTempRegistration(merged);
    } catch (error) {
        console.error("Error updating temporary registration:", error);
        throw error;
    }
};

// Retrieve temporary registration data
exports.getTempRegistration = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        const queryText = `
            SELECT *
            FROM temp_registration
            WHERE session_id = $1
              AND expires_at > NOW()
        `;

        const result = await query(queryText, [sessionId]);

        if (result.rows.length === 0) {
            throw new CustomError(
                "Temporary registration data not found or expired",
                404,
            );
        }

        const row = result.rows[0];

        const tempRegistration = {
            ...row,
        };

        return tempRegistration;
    } catch (error) {
        // Only log critical errors, ignore expected 404s
        if (error.statusCode !== 404) {
            console.error("Error retrieving temporary registration data:", error);
        }
        throw error;
    }
};

exports.getTempRegistrationWAttendees = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        const queryText = `
            SELECT tr.*,
                   jsonb_build_object(
                           'id', e.id,
                           'name', e.name,
                           'currency', e.currency,
                           'startDate', e.start_datetime,
                           'endDate', e.end_datetime,
                           'location', e.location,
                           'banner', e.banner,
                           'slug', e.slug,
                           'config', e.config
                   ) AS event,
                   COALESCE(
                       jsonb_agg(
                           jsonb_build_object(
                               'id', a.id,
                               'registrationId', a.registration_id,
                               'isPrimary', a.is_primary,
                               'firstName', a.first_name,
                               'lastName', a.last_name,
                               'email', a.email,
                               'phone', a.phone,
                               'ticket', a.ticket,
                               'qrUuid', a.qr_uuid,
                               'createdAt', a.created_at,
                               'updatedAt', a.updated_at
                           )
                       ) FILTER (WHERE a.id IS NOT NULL),
                       tr.attendees -- Fallback to session blueprint if permanent records not ready
                   ) AS attendees
            FROM temp_registration tr
                     JOIN event e ON tr.event_id = e.id
                     LEFT JOIN attendees a
                               ON tr.session_id = a.session_id
            WHERE tr.session_id = $1
              AND tr.expires_at > NOW()
            GROUP BY tr.session_id, tr.attendees, tr.registration, tr.selected_tickets, tr.selected_products, tr.orders, tr.event_id, tr.created_at, tr.expires_at, tr.reminder_email_sent_at, e.id;
        `;

        const result = await query(queryText, [sessionId]);

        if (result.rows.length === 0) {
            throw new CustomError(
                "Temporary registration data not found or expired",
                404,
            );
        }

        // Read-only logic: return the row as is
        const row = result.rows[0];

        return {
            ...row,
        };
    } catch (error) {
        console.error("Error retrieving temporary registration data:", error);
        throw error;
    }
};

// Update session activity and extend expiration
exports.updateSessionActivity = async (sessionId, extendHours = 24) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        // First get the current session to validate it exists
        const currentSession = await exports.getTempRegistration(sessionId);
        if (!currentSession) {
            throw new CustomError("Session not found or expired", 404);
        }

        // Calculate new expiration time
        const newExpiresAt = new Date(Date.now() + extendHours * 60 * 60 * 1000);

        const queryText = `
            UPDATE temp_registration
            SET expires_at = $1
            WHERE session_id = $2
        `;

        await query(queryText, [newExpiresAt, sessionId]);

        return {
            sessionId,
            newExpiresAt,
            extended: true,
        };
    } catch (error) {
        console.error("Error updating session activity:", error);
        throw error;
    }
};

// Get session status without returning full data
exports.getSessionStatus = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        const queryText = `
            SELECT session_id, event_id, expires_at, created_at
            FROM temp_registration
            WHERE session_id = $1
              AND expires_at > NOW()
        `;

        const result = await query(queryText, [sessionId]);

        if (result.rows.length === 0) {
            return {
                sessionId,
                valid: false,
                exists: false,
            };
        }

        const row = result.rows[0];
        return {
            sessionId: row.sessionId,
            valid: true,
            exists: true,
            eventId: row.eventId,
            expiresAt: row.expiresAt,
            createdAt: row.createdAt,
        };
    } catch (error) {
        console.error("Error getting session status:", error);
        throw error;
    }
};

// Get temporary registration data by session ID (for success page)
exports.getTempRegistrationBySessionId = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        // Get temp registration data
        const tempQuery = `
            SELECT *
            FROM temp_registration
            WHERE session_id = $1
              AND expires_at > NOW()
        `;

        const tempResult = await query(tempQuery, [sessionId]);

        if (tempResult.rows.length === 0) {
            throw new CustomError(
                "Temporary registration data not found or expired",
                404,
            );
        }

        const tempRow = tempResult.rows[0];
        const tempRegistration = {
            ...tempRow,
        };

        // Get actual registration data for all attendees with this email and event
        const attendeeQuery = `
            SELECT r.id         as registration_id,
                   r.event_id,
                   r.status     as registration_status,
                   r.additional_fields,
                   r.created_at as registration_created_at,
                   r.updated_at as registration_updated_at,
                   a.id         as attendee_id,
                   a.first_name,
                   a.last_name,
                   a.email,
                   a.phone,
                   a.ticket,
                   a.qr_uuid,
                   a.is_primary,
                   a.created_at as attendee_created_at,
                   a.updated_at as attendee_updated_at,
                   a.ticket->>'title' as ticket_title,
                   (a.ticket->>'price')::numeric as ticket_price
            FROM registration r
                     INNER JOIN attendees a ON r.id = a.registration_id
            WHERE a.email = $1
              AND r.event_id = $2
            ORDER BY r.created_at DESC, a.is_primary DESC
        `;

        const attendeeResult = await query(attendeeQuery, [
            tempRow.attendees[0]?.email,
            tempRow.eventId,
        ]);

        // Group attendees by registration
        const registrations = {};
        attendeeResult.rows.forEach((row) => {
            const regId = row.registrationId;
            if (!registrations[regId]) {
                registrations[regId] = {
                    id: row.registrationId,
                    eventId: row.eventId,
                    status: row.registrationStatus,
                    additionalFields: row.additionalFields || {},
                    createdAt: row.registrationCreatedAt,
                    updatedAt: row.registrationUpdatedAt,
                    attendees: [],
                };
            }

            registrations[regId].attendees.push({
                id: row.attendeeId,
                firstName: row.firstName,
                lastName: row.lastName,
                email: row.email,
                phone: row.phone,
                ticketTitle: row.ticketTitle,
                ticketPrice: row.ticketPrice,
                ticket: row.ticket,
                qrUuid: row.qrUuid,
                isPrimary: row.isPrimary,
                createdAt: row.attendeeCreatedAt,
                updatedAt: row.attendeeUpdatedAt,
            });
        });

        return {
            tempRegistration,
            registrations: Object.values(registrations),
        };
    } catch (error) {
        console.error(
            "Error retrieving temporary registration data by session ID:",
            error,
        );
        throw error;
    }
};

// Cleanup expired temporary registration data
exports.cleanupExpiredTempData = async () => {
    try {
        const queryText = `
            DELETE FROM temp_registration
            WHERE expires_at < NOW()
        `;

        const result = await query(queryText);

        return {
            deletedCount: result.rowCount || 0,
            message: `Cleaned up ${result.rowCount || 0} expired temporary registrations`
        };
    } catch (error) {
        console.error("Error cleaning up expired temporary data:", error);
        throw error;
    }
};

// Delete specific temporary registration by session ID
exports.deleteTempRegistration = async (sessionId) => {
    try {
        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        // First, clear the session_id from attendees to avoid foreign key constraint violation
        const clearSessionIdQuery = `
            UPDATE attendees 
            SET session_id = NULL 
            WHERE session_id = $1
        `;

        const clearResult = await query(clearSessionIdQuery, [sessionId]);

        // Now safely delete the temp_registration
        const queryText = `
            DELETE FROM temp_registration
            WHERE session_id = $1
        `;

        const result = await query(queryText, [sessionId]);

        return {
            deletedCount: result.rowCount || 0,
            attendeesCleared: clearResult.rowCount || 0,
            sessionId: sessionId,
            message: `Deleted temporary registration for session ${sessionId} and cleared session_id from ${clearResult.rowCount || 0} attendees`
        };
    } catch (error) {
        console.error("Error deleting temporary registration:", error);
        throw error;
    }
};
