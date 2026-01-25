const { query } = require("../db");
const CustomError = require("../model/CustomError");

exports.save = async ({ payload, files, currentUser }) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    const { id, ...organizationData } = payload;

    // Validate required fields (only NOT NULL columns from DB schema)
    if (!organizationData.name || !organizationData.name.trim()) {
        throw new CustomError("Organization name is required", 400);
    }

    // Handle file uploads if provided
    if (files && files.length > 0) {
        organizationData.logo = files[0].filename;
    }

    if (id) {
        // Update existing organization
        const sql = `
            INSERT INTO organization (id, name, location, logo)
            VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO
            UPDATE SET
                name = EXCLUDED.name,
                location = EXCLUDED.location,
                logo = EXCLUDED.logo
                RETURNING *
        `;
        const values = [id, organizationData.name, organizationData.location, organizationData.logo];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to update organization", 500);
        }

        return result.rows[0];
    } else {
        // Create new organization
        const sql = `
            INSERT INTO organization (name, location, logo)
            VALUES ($1, $2, $3) RETURNING *
        `;
        const values = [organizationData.name, organizationData.location, organizationData.logo];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to create organization", 500);
        }

        return result.rows[0];
    }
};

exports.getAllOrganizations = async ({ page = 1, itemsPerPage = 10 } = {}) => {
    const offset = (page - 1) * itemsPerPage;

    // Get total count
    const countSql = `
        SELECT COUNT(*) as total
        FROM organization
    `;
    const countResult = await query(countSql);
    const total = parseInt(countResult.rows[0].total) || 0;

    // Get paginated organizations
    const sql = `
        SELECT *
        FROM organization
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
    `;
    const result = await query(sql, [itemsPerPage, offset]);

    return {
        organizations: result.rows,
        total,
        page,
        itemsPerPage,
        totalPages: Math.ceil(total / itemsPerPage),
    };
};

exports.getOrganizationById = async ({ organizationId }) => {
    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM organization
        WHERE id = $1
    `;
    const result = await query(sql, [organizationId]);

    if (!result.rows[0]) {
        throw new CustomError("Organization not found", 404);
    }

    return result.rows[0];
};

exports.deleteOrganization = async ({ organizationId }) => {
    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    const sql = `
        DELETE
        FROM organization
        WHERE id = $1 RETURNING *
    `;
    const result = await query(sql, [organizationId]);

    if (!result.rows[0]) {
        throw new CustomError("Organization not found", 404);
    }

    return result.rows[0];
};
