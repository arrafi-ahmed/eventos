const {query} = require("../db");
const CustomError = require("../model/CustomError");

const VALID_STYLES = ["oneline", "expanded"];

// Get footer settings (public or admin)
exports.getFooterSettings = async () => {
    const sql = `
        SELECT 
            id,
            style,
            company_name,
            company_address,
            company_email,
            company_phone,
            quick_links,
            social_links,
            copyright_text,
            created_at,
            updated_at
        FROM footer_settings
        ORDER BY id ASC
        LIMIT 1
    `;
    const result = await query(sql, []);

    if (result.rows.length === 0) {
        // Return default settings if none exist
        return {
            style: "expanded",
            companyName: null,
            companyAddress: null,
            companyEmail: null,
            companyPhone: null,
            quickLinks: [],
            socialLinks: {},
            copyrightText: null
        };
    }

    const row = result.rows[0];
    // DB already converts to camelCase, so use camelCase directly
    return {
        id: row.id,
        style: row.style || 'expanded',
        companyName: row.companyName ?? null,
        companyAddress: row.companyAddress ?? null,
        companyEmail: row.companyEmail ?? null,
        companyPhone: row.companyPhone ?? null,
        quickLinks: row.quickLinks || [],
        socialLinks: row.socialLinks || {},
        copyrightText: row.copyrightText ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

// Update footer settings (admin only)
// Accepts camelCase, converts to snake_case for SQL only
exports.updateFooterSettings = async ({
                                          style,
                                          companyName,
                                          companyAddress,
                                          companyEmail,
                                          companyPhone,
                                          quickLinks,
                                          socialLinks,
                                          copyrightText
                                      }) => {
    // Validate style
    if (style && !VALID_STYLES.includes(style)) {
        throw new CustomError(`Invalid style. Must be one of: ${VALID_STYLES.join(", ")}`, 400);
    }

    // Check if settings exist
    const existing = await query("SELECT id FROM footer_settings LIMIT 1", []);

    let result;
    if (existing.rows.length === 0) {
        // Insert new settings
        const insertSql = `
            INSERT INTO footer_settings (
                style,
                company_name,
                company_address,
                company_email,
                company_phone,
                quick_links,
                social_links,
                copyright_text
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        result = await query(insertSql, [
            style || "expanded",
            companyName || null,
            companyAddress || null,
            companyEmail || null,
            companyPhone || null,
            quickLinks ? JSON.stringify(quickLinks) : JSON.stringify([]),
            socialLinks ? JSON.stringify(socialLinks) : JSON.stringify({}),
            copyrightText || null
        ]);
    } else {
        // Update existing settings
        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (style !== undefined) {
            updates.push(`style = $${paramIndex++}`);
            values.push(style);
        }
        if (companyName !== undefined) {
            updates.push(`company_name = $${paramIndex++}`);
            values.push(companyName || null);
        }
        if (companyAddress !== undefined) {
            updates.push(`company_address = $${paramIndex++}`);
            values.push(companyAddress || null);
        }
        if (companyEmail !== undefined) {
            updates.push(`company_email = $${paramIndex++}`);
            values.push(companyEmail || null);
        }
        if (companyPhone !== undefined) {
            updates.push(`company_phone = $${paramIndex++}`);
            values.push(companyPhone || null);
        }
        if (quickLinks !== undefined) {
            updates.push(`quick_links = $${paramIndex++}`);
            values.push(JSON.stringify(quickLinks));
        }
        if (socialLinks !== undefined) {
            updates.push(`social_links = $${paramIndex++}`);
            values.push(JSON.stringify(socialLinks));
        }
        if (copyrightText !== undefined) {
            updates.push(`copyright_text = $${paramIndex++}`);
            values.push(copyrightText || null);
        }

        if (updates.length === 0) {
            throw new CustomError("No fields to update", 400);
        }

        updates.push(`updated_at = NOW()`);
        values.push(existing.rows[0].id);

        const updateSql = `
            UPDATE footer_settings
            SET ${updates.join(", ")}
            WHERE id = $${paramIndex}
            RETURNING *
        `;
        result = await query(updateSql, values);
    }

    const row = result.rows[0];
    // DB already converts to camelCase, so use camelCase directly
    return {
        id: row.id,
        style: row.style || 'expanded',
        companyName: row.companyName ?? null,
        companyAddress: row.companyAddress ?? null,
        companyEmail: row.companyEmail ?? null,
        companyPhone: row.companyPhone ?? null,
        quickLinks: row.quickLinks || [],
        socialLinks: row.socialLinks || {},
        copyrightText: row.copyrightText ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

exports.VALID_STYLES = VALID_STYLES;

