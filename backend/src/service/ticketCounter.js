const { query } = require("../db");
const CustomError = require("../model/CustomError");

exports.save = async ({ payload }) => {
    const { id, name, organizationId, status } = payload;

    if (!name || !name.trim()) {
        throw new CustomError("Name is required", 400);
    }

    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    if (id) {
        const sql = `
            UPDATE ticket_counter
            SET name = $1,
                is_active = $2
            WHERE id = $3 AND organization_id = $4
            RETURNING *;
        `;
        const result = await query(sql, [name, status !== undefined ? status : true, id, organizationId]);
        if (result.rows.length === 0) {
            throw new CustomError("Ticket Counter not found or access denied", 404);
        }
        return result.rows[0];
    } else {
        const sql = `
            INSERT INTO ticket_counter (name, organization_id, is_active, created_at)
            VALUES ($1, $2, $3, NOW())
            RETURNING *;
        `;
        const result = await query(sql, [name, organizationId, status !== undefined ? status : true]);
        return result.rows[0];
    }
};

exports.getTicketCountersByOrganizationId = async ({ organizationId, search = '' }) => {
    let params = [];
    let whereClauses = [];

    if (organizationId) {
        params.push(organizationId);
        whereClauses.push(`organization_id = $${params.length}`);
    }

    if (search) {
        params.push(`%${search}%`);
        whereClauses.push(`name ILIKE $${params.length}`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const sql = `
        SELECT * FROM ticket_counter
        ${whereSql}
        ORDER BY created_at DESC;
    `;
    const result = await query(sql, params);
    return result.rows;
};

exports.getTicketCounterById = async ({ id, organizationId }) => {
    const sql = `
        SELECT * FROM ticket_counter
        WHERE id = $1 AND organization_id = $2;
    `;
    const result = await query(sql, [id, organizationId]);
    return result.rows[0];
};

exports.deleteTicketCounter = async ({ id, organizationId }) => {
    const sql = `
        DELETE FROM ticket_counter
        WHERE id = $1 AND organization_id = $2
        RETURNING *;
    `;
    const result = await query(sql, [id, organizationId]);
    if (result.rows.length === 0) {
        throw new CustomError("Ticket Counter not found or access denied", 404);
    }
    return result.rows[0];
};
