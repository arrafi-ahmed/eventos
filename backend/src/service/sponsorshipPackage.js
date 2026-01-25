const { query } = require("../db");
const CustomError = require("../model/CustomError");
const { defaultCurrency } = require("../utils/common");

exports.save = async ({ payload }) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    // For new packages, remove id to let database auto-generate it
    const { id, ...packageData } = payload;

    // Validate required fields (only NOT NULL columns from DB schema)
    if (!packageData.name || !packageData.name.trim()) {
        throw new CustomError("Name is required", 400);
    }

    if (!packageData.price || packageData.price <= 0) {
        throw new CustomError("Valid price is required", 400);
    }

    if (!packageData.eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!packageData.organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    if (id) {
        // Update existing package
        const sql = `
            INSERT INTO sponsorship_package (id, name, description, price, currency, available_count, features,
                                             event_id, organization_id,
                                             is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) ON CONFLICT (id) DO
            UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                price = EXCLUDED.price,
                currency = EXCLUDED.currency,
                available_count = EXCLUDED.available_count,
                features = EXCLUDED.features,
                event_id = EXCLUDED.event_id,
                organization_id = EXCLUDED.organization_id,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
                RETURNING *
        `;
        const values = [
            id,
            packageData.name,
            packageData.description,
            packageData.price,
            packageData.currency || defaultCurrency.code,
            packageData.availableCount,
            JSON.stringify(packageData.features),
            packageData.eventId,
            packageData.organizationId,
            packageData.isActive !== undefined ? packageData.isActive : true,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to update sponsorship package", 500);
        }

        return result.rows[0];
    } else {
        // Create new package
        const sql = `
            INSERT INTO sponsorship_package (name, description, price, currency, available_count, features, event_id,
                                             organization_id, is_active,
                                             created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()) RETURNING *
        `;
        const values = [
            packageData.name,
            packageData.description,
            packageData.price,
            packageData.currency || defaultCurrency.code,
            packageData.availableCount,
            JSON.stringify(packageData.features),
            packageData.eventId,
            packageData.organizationId,
            packageData.isActive !== undefined ? packageData.isActive : true,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to create sponsorship package", 500);
        }

        return result.rows[0];
    }
};

exports.getPackagesByEventId = async ({ eventId }) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM sponsorship_package
        WHERE event_id = $1
          AND is_active = true
        ORDER BY price DESC
    `;
    const result = await query(sql, [eventId]);
    return result.rows;
};

exports.getPackageById = async ({ packageId }) => {
    if (!packageId) {
        throw new CustomError("Package ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM sponsorship_package
        WHERE id = $1
    `;
    const result = await query(sql, [packageId]);

    if (!result.rows[0]) {
        throw new CustomError("Sponsorship package not found", 404);
    }

    return result.rows[0];
};

exports.deletePackage = async ({ packageId, eventId, organizationId }) => {
    if (!packageId) {
        throw new CustomError("Package ID is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    const sql = `
        DELETE
        FROM sponsorship_package
        WHERE id = $1
          AND event_id = $2
          AND organization_id = $3 RETURNING *
    `;
    const result = await query(sql, [packageId, eventId, organizationId]);

    if (!result.rows[0]) {
        throw new CustomError(
            "Sponsorship package not found or access denied",
            404,
        );
    }

    return result.rows[0];
};

exports.updatePackageStatus = async ({ packageId, isActive }) => {
    if (!packageId) {
        throw new CustomError("Package ID is required", 400);
    }

    if (isActive === undefined || isActive === null) {
        throw new CustomError("Active status is required", 400);
    }

    const sql = `
        UPDATE sponsorship_package
        SET is_active  = $1,
            updated_at = NOW()
        WHERE id = $2 RETURNING *
    `;
    const result = await query(sql, [isActive, packageId]);

    if (!result.rows[0]) {
        throw new CustomError("Sponsorship package not found", 404);
    }

    return result.rows[0];
};
