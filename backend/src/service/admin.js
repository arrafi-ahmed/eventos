const {query} = require("../db");
const CustomError = require("../model/CustomError");
const {ifOrganizer} = require("../utils/common");

exports.getOrganizers = async ({
                                   offset = 0,
                                   limit = 10,
                                   fetchTotalCount = false,
                                   status = null,
                               }) => {
    const validStatuses = ["pending", "approved", "rejected"];
    const filters = ["role = 30"];
    const values = [];

    if (status && validStatuses.includes(status)) {
        filters.push(`verification_status = $${values.length + 1}`);
        values.push(status);
    }

    const whereClause = `WHERE ${filters.join(" AND ")}`;

    const listSql = `
        SELECT 
            id,
            full_name,
            email,
            id_document,
            verification_status,
            verified_by,
            verified_at,
            rejection_reason,
            created_at
        FROM app_user
        ${whereClause}
        ORDER BY id DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
    `;

    const listResult = await query(listSql, [...values, limit, offset]);

    if (fetchTotalCount) {
        const countSql = `
            SELECT COUNT(*) AS count
            FROM app_user
            ${whereClause}
        `;
        const countResult = await query(countSql, values);
        const total = Number(countResult.rows[0]?.count || 0);
        return {items: listResult.rows, total};
    }

    return {items: listResult.rows};
};

exports.approveOrganizer = async ({organizerId, adminId}) => {
    if (!organizerId || !adminId) {
        throw new CustomError("Organizer ID and Admin ID are required", 400);
    }

    // Verify the user is an organizer
    const checkSql = `SELECT id, role FROM app_user WHERE id = $1`;
    const checkResult = await query(checkSql, [organizerId]);

    if (checkResult.rows.length === 0) {
        throw new CustomError("Organizer not found", 404);
    }

    if (!ifOrganizer(checkResult.rows[0].role)) {
        throw new CustomError("User is not an organizer", 400);
    }

    const updateSql = `
        UPDATE app_user
        SET verification_status = 'approved',
            verified_by = $1,
            verified_at = NOW(),
            rejection_reason = NULL
        WHERE id = $2
        RETURNING *
    `;
    const result = await query(updateSql, [adminId, organizerId]);

    return result.rows[0];
};

exports.rejectOrganizer = async ({organizerId, adminId, reason}) => {
    if (!organizerId || !adminId || !reason) {
        throw new CustomError("Organizer ID, Admin ID, and rejection reason are required", 400);
    }

    // Verify the user is an organizer
    const checkSql = `SELECT id, role FROM app_user WHERE id = $1`;
    const checkResult = await query(checkSql, [organizerId]);

    if (checkResult.rows.length === 0) {
        throw new CustomError("Organizer not found", 404);
    }

    if (!ifOrganizer(checkResult.rows[0].role)) {
        throw new CustomError("User is not an organizer", 400);
    }

    const updateSql = `
        UPDATE app_user
        SET verification_status = 'rejected',
            verified_by = $1,
            verified_at = NOW(),
            rejection_reason = $2
        WHERE id = $3
        RETURNING *
    `;
    const result = await query(updateSql, [adminId, reason, organizerId]);

    return result.rows[0];
};

