const {query} = require("../db");
const CustomError = require("../model/CustomError");

/**
 * Save visitor data when they fill out the landing page form
 * @param {Object} payload
 * @param {number} payload.eventId - Event ID
 * @param {string} payload.firstName - Visitor first name
 * @param {string} payload.lastName - Visitor last name
 * @param {string} payload.email - Visitor email
 * @param {string} payload.phone - Visitor phone (optional)
 */
exports.saveVisitor = async ({eventId, firstName, lastName, email, phone}) => {
    try {
        // Validate required fields
        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }
        if (!firstName || !lastName) {
            throw new CustomError("First name and last name are required", 400);
        }
        if (!email) {
            throw new CustomError("Email is required", 400);
        }

        // Check if visitor already exists for this event (by email)
        // We'll allow multiple entries but track them separately
        const sql = `
            INSERT INTO event_visitor (event_id, first_name, last_name, email, phone, visited_at)
            VALUES ($1, $2, $3, $4, $5, NOW())
            RETURNING *
        `;

        const result = await query(sql, [
            eventId,
            firstName.trim(),
            lastName.trim(),
            email.trim().toLowerCase(),
            phone ? phone.trim() : null,
        ]);

        return result.rows[0];
    } catch (error) {
        console.error("Error saving event visitor:", error);
        throw error;
    }
};

/**
 * Get all visitors for an event
 * @param {Object} params
 * @param {number} params.eventId - Event ID
 * @param {Object} params.pagination - Pagination options
 * @param {number} params.pagination.page - Page number (default: 1)
 * @param {number} params.pagination.itemsPerPage - Items per page (default: 50)
 * @param {boolean} params.includeConverted - Include converted visitors (default: true)
 */
exports.getEventVisitors = async ({eventId, pagination = {}, includeConverted = true}) => {
    try {
        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        const page = parseInt(pagination.page) || 1;
        const itemsPerPage = parseInt(pagination.itemsPerPage) || 50;
        const offset = (page - 1) * itemsPerPage;

        let whereClause = "WHERE event_id = $1";
        const queryParams = [eventId];

        if (!includeConverted) {
            whereClause += " AND converted = false";
        }

        // Get total count
        const countSql = `
            SELECT COUNT(*) as total
            FROM event_visitor
            ${whereClause}
        `;
        const countResult = await query(countSql, queryParams);
        const total = parseInt(countResult.rows[0].total) || 0;

        // Get visitors
        const sql = `
            SELECT 
                id,
                event_id,
                first_name,
                last_name,
                email,
                phone,
                visited_at,
                converted,
                converted_at,
                created_at,
                updated_at
            FROM event_visitor
            ${whereClause}
            ORDER BY visited_at DESC
            LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
        `;

        const result = await query(sql, [...queryParams, itemsPerPage, offset]);

        return {
            visitors: result.rows,
            pagination: {
                page,
                itemsPerPage,
                total,
                totalPages: Math.ceil(total / itemsPerPage),
            },
        };
    } catch (error) {
        console.error("Error getting event visitors:", error);
        // Check if table doesn't exist
        if (error.message && error.message.includes('does not exist')) {
            throw new CustomError("event_visitor table does not exist. Please run the migration: backend/migration/add-event-visitor-table.sql", 500);
        }
        throw error;
    }
};

/**
 * Mark visitor as converted (completed purchase)
 * @param {Object} params
 * @param {number} params.eventId - Event ID
 * @param {string} params.email - Visitor email
 */
exports.markVisitorConverted = async ({eventId, email}) => {
    try {
        if (!eventId || !email) {
            throw new CustomError("Event ID and email are required", 400);
        }

        const sql = `
            UPDATE event_visitor
            SET converted = true,
                converted_at = NOW(),
                updated_at = NOW()
            WHERE event_id = $1
                AND email = $2
                AND converted = false
            RETURNING *
        `;

        const result = await query(sql, [eventId, email.trim().toLowerCase()]);
        return result.rows;
    } catch (error) {
        console.error("Error marking visitor as converted:", error);
        throw error;
    }
};

/**
 * Delete a visitor by ID
 * @param {Object} params
 * @param {number} params.visitorId - Visitor ID
 * @param {number} params.eventId - Event ID (for validation)
 */
exports.deleteVisitor = async ({visitorId, eventId}) => {
    try {
        if (!visitorId) {
            throw new CustomError("Visitor ID is required", 400);
        }
        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        // First verify the visitor exists and belongs to the event
        const verifySql = `
            SELECT id, event_id, converted
            FROM event_visitor
            WHERE id = $1 AND event_id = $2
        `;
        const verifyResult = await query(verifySql, [visitorId, eventId]);

        if (verifyResult.rows.length === 0) {
            throw new CustomError("Visitor not found for this event", 404);
        }

        // Delete the visitor
        const deleteSql = `
            DELETE FROM event_visitor
            WHERE id = $1 AND event_id = $2
            RETURNING *
        `;
        const deleteResult = await query(deleteSql, [visitorId, eventId]);

        if (deleteResult.rowCount === 0) {
            throw new CustomError("Failed to delete visitor", 500);
        }

        return {
            message: "Visitor deleted successfully",
            deletedVisitor: deleteResult.rows[0],
        };
    } catch (error) {
        console.error("Error deleting visitor:", error);
        throw error;
    }
};

/**
 * Get visitor statistics for an event
 * @param {number} eventId - Event ID
 */
exports.getVisitorStats = async (eventId) => {
    try {
        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        const sql = `
            SELECT 
                COUNT(*) as total_visitors,
                COUNT(*) FILTER (WHERE converted = true) as converted_visitors,
                COUNT(*) FILTER (WHERE converted = false) as unconverted_visitors,
                COUNT(DISTINCT email) as unique_emails,
                ROUND(
                    (COUNT(*) FILTER (WHERE converted = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
                    2
                ) as conversion_rate
            FROM event_visitor
            WHERE event_id = $1
        `;

        const result = await query(sql, [eventId]);
        return result.rows[0] || {};
    } catch (error) {
        console.error("Error getting visitor stats:", error);
        // Check if table doesn't exist
        if (error.message && error.message.includes('does not exist')) {
            throw new CustomError("event_visitor table does not exist. Please run the migration: backend/migration/add-event-visitor-table.sql", 500);
        }
        throw error;
    }
};

