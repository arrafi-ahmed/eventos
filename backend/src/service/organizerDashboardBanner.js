const {query} = require("../db");
const CustomError = require("../model/CustomError");

// Get organizer dashboard banner settings (public or admin)
exports.getOrganizerDashboardBanner = async () => {
    const sql = `
        SELECT 
            id,
            is_enabled,
            icon,
            title,
            description,
            cta_button_text,
            cta_button_url,
            created_at,
            updated_at
        FROM organizer_dashboard_banner
        ORDER BY id ASC
        LIMIT 1
    `;
    const result = await query(sql, []);

    if (result.rows.length === 0) {
        // Return default settings if none exist
        return {
            isEnabled: false,
            icon: null,
            title: null,
            description: null,
            ctaButtonText: null,
            ctaButtonUrl: null,
        };
    }

    const row = result.rows[0];
    // DB already converts to camelCase, so use camelCase directly
    return {
        id: row.id,
        isEnabled: row.isEnabled !== false, // Default to true if null
        icon: row.icon,
        title: row.title,
        description: row.description,
        ctaButtonText: row.ctaButtonText,
        ctaButtonUrl: row.ctaButtonUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

// Update organizer dashboard banner settings (admin only)
// Accepts camelCase, converts to snake_case for SQL only
exports.updateOrganizerDashboardBanner = async ({
                                                    isEnabled,
                                                    icon,
                                                    title,
                                                    description,
                                                    ctaButtonText,
                                                    ctaButtonUrl
                                                }) => {
    // Validate URL if provided
    if (ctaButtonUrl !== undefined && ctaButtonUrl && !ctaButtonUrl.match(/^https?:\/\//)) {
        throw new CustomError("CTA button URL must start with http:// or https://", 400);
    }

    // Check if settings exist
    const existing = await query("SELECT id FROM organizer_dashboard_banner LIMIT 1", []);

    let result;
    if (existing.rows.length === 0) {
        // Insert new settings
        // If enabled, all required fields must be provided
        // If disabled, we can insert with empty placeholders for required fields
        const willBeEnabled = isEnabled !== undefined ? isEnabled : false;

        if (willBeEnabled) {
            // When enabled, all required fields must be provided
            if (!icon || !title || !ctaButtonText || !ctaButtonUrl) {
                throw new CustomError("When banner is enabled, icon, title, CTA button text, and CTA button URL are required", 400);
            }
        }

        const insertSql = `
            INSERT INTO organizer_dashboard_banner (
                is_enabled,
                icon,
                title,
                description,
                cta_button_text,
                cta_button_url
            )
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `;
        result = await query(insertSql, [
            willBeEnabled,
            icon || '',
            title || '',
            description || null,
            ctaButtonText || '',
            ctaButtonUrl || ''
        ]);
    } else {
        // Update existing settings
        // If enabling, validate that all required fields will be present after update
        if (isEnabled === true) {
            const existingRow = await query("SELECT icon, title, cta_button_text, cta_button_url FROM organizer_dashboard_banner LIMIT 1", []);
            const existingData = existingRow.rows[0];

            // Determine what values will be after update
            const finalIcon = icon !== undefined ? icon : existingData.icon;
            const finalTitle = title !== undefined ? title : existingData.title;
            const finalCtaButtonText = ctaButtonText !== undefined ? ctaButtonText : existingData.ctaButtonText;
            const finalCtaButtonUrl = ctaButtonUrl !== undefined ? ctaButtonUrl : existingData.ctaButtonUrl;

            // Validate all required fields will be present
            if (!finalIcon || !finalTitle || !finalCtaButtonText || !finalCtaButtonUrl) {
                throw new CustomError("When enabling banner, icon, title, CTA button text, and CTA button URL are required", 400);
            }
        }

        const updates = [];
        const values = [];
        let paramIndex = 1;

        if (isEnabled !== undefined) {
            updates.push(`is_enabled = $${paramIndex++}`);
            values.push(isEnabled);
        }
        if (icon !== undefined) {
            updates.push(`icon = $${paramIndex++}`);
            values.push(icon);
        }
        if (title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(title);
        }
        if (description !== undefined) {
            updates.push(`description = $${paramIndex++}`);
            values.push(description);
        }
        if (ctaButtonText !== undefined) {
            updates.push(`cta_button_text = $${paramIndex++}`);
            values.push(ctaButtonText);
        }
        if (ctaButtonUrl !== undefined) {
            updates.push(`cta_button_url = $${paramIndex++}`);
            values.push(ctaButtonUrl);
        }

        if (updates.length === 0) {
            throw new CustomError("No fields to update", 400);
        }

        updates.push(`updated_at = NOW()`);
        values.push(existing.rows[0].id);

        const updateSql = `
            UPDATE organizer_dashboard_banner
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
        isEnabled: row.isEnabled,
        icon: row.icon,
        title: row.title,
        description: row.description,
        ctaButtonText: row.ctaButtonText,
        ctaButtonUrl: row.ctaButtonUrl,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};


