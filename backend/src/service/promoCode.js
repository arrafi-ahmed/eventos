const { query } = require("../db");
const CustomError = require("../model/CustomError");

exports.save = async ({ payload }) => {
    const { id, code, discountType, discountValue, organizationId, eventId, usageLimit, validFrom, validUntil, isActive } = payload;

    if (!code || !code.trim()) {
        throw new CustomError("Promo code is required", 400);
    }

    if (!discountType || !['percentage', 'fixed', 'free'].includes(discountType)) {
        throw new CustomError("Valid discount type is required", 400);
    }

    if (discountType !== 'free' && (!discountValue || discountValue <= 0)) {
        throw new CustomError("Valid discount value is required", 400);
    }

    if (!organizationId) {
        throw new CustomError("Organization ID is required", 400);
    }

    const dv = discountType === 'free' ? 0 : discountValue;

    if (id) {
        const sql = `
            UPDATE promo_code
            SET code = $1,
                discount_type = $2,
                discount_value = $3,
                usage_limit = $4,
                valid_from = $5,
                valid_until = $6,
                is_active = $7,
                event_id = $8,
                updated_at = NOW()
            WHERE id = $9 AND organization_id = $10
            RETURNING *;
        `;
        const values = [
            code.toUpperCase(),
            discountType,
            dv,
            usageLimit || null,
            validFrom || null,
            validUntil || null,
            isActive !== undefined ? isActive : true,
            eventId || null,
            id,
            organizationId
        ];
        const result = await query(sql, values);
        if (result.rows.length === 0) {
            throw new CustomError("Promo code not found or access denied", 404);
        }
        return result.rows[0];
    } else {
        const sql = `
            INSERT INTO promo_code (code, discount_type, discount_value, organization_id, event_id, usage_limit, valid_from, valid_until, is_active, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
            RETURNING *;
        `;
        const values = [
            code.toUpperCase(),
            discountType,
            dv,
            organizationId,
            eventId || null,
            usageLimit || null,
            validFrom || null,
            validUntil || null,
            isActive !== undefined ? isActive : true
        ];
        const result = await query(sql, values);
        return result.rows[0];
    }
};

exports.validatePromoCode = async ({ code, eventId }) => {
    const sql = `
        SELECT * FROM promo_code
        WHERE code = $1
        AND is_active = true
        AND (event_id = $2 OR event_id IS NULL)
        AND (valid_until > NOW() OR valid_until IS NULL)
        AND (valid_from <= NOW() OR valid_from IS NULL)
        AND (usage_count < usage_limit OR usage_limit IS NULL);
    `;
    const result = await query(sql, [code.toUpperCase(), eventId]);
    if (result.rows.length === 0) {
        throw new CustomError("Invalid or expired promo code", 400);
    }
    return result.rows[0];
};

exports.incrementUseCount = async ({ id }) => {
    const sql = `
        UPDATE promo_code
        SET usage_count = usage_count + 1
        WHERE id = $1
        RETURNING *;
    `;
    const result = await query(sql, [id]);
    return result.rows[0];
};

exports.getPromoCodesByOrganizationId = async ({ organizationId }) => {
    const sql = `
        SELECT p.*, e.name as event_name
        FROM promo_code p
        LEFT JOIN event e ON p.event_id = e.id
        WHERE p.organization_id = $1
        ORDER BY p.created_at DESC;
    `;
    const result = await query(sql, [organizationId]);
    return result.rows;
};

exports.deletePromoCode = async ({ id, organizationId }) => {
    const sql = `
        DELETE FROM promo_code
        WHERE id = $1 AND organization_id = $2
        RETURNING *;
    `;
    const result = await query(sql, [id, organizationId]);
    if (result.rows.length === 0) {
        throw new CustomError("Promo code not found or access denied", 404);
    }
    return result.rows[0];
};
