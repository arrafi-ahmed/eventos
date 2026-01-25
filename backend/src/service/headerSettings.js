const { query } = require("../db");
const CustomError = require("../model/CustomError");
const path = require("path");
const fs = require("fs");

const VALID_POSITIONS = ["left", "center", "right"];

// Get header settings (public or admin)
exports.getHeaderSettings = async () => {
    const sql = `
        SELECT 
            id,
            logo_image,
            logo_image_dark,
            logo_position,
            menu_position,
            logo_width_left,
            logo_width_center,
            logo_width_mobile,
            created_at,
            updated_at
        FROM header_settings
        ORDER BY id ASC
        LIMIT 1
    `;
    const result = await query(sql, []);

    if (result.rows.length === 0) {
        // Return default settings if none exist
        return {
            logoImage: null,
            logoImageDark: null,
            logoPosition: "left",
            menuPosition: "right",
            logoWidthLeft: 300,
            logoWidthCenter: 180,
            logoWidthMobile: 120
        };
    }

    const row = result.rows[0];
    // DB already converts to camelCase, so use camelCase directly
    return {
        id: row.id,
        logoImage: row.logoImage ?? null,
        logoImageDark: row.logoImageDark ?? null,
        logoPosition: row.logoPosition || 'left',
        menuPosition: row.menuPosition || 'right',
        logoWidthLeft: row.logoWidthLeft ?? 300,
        logoWidthCenter: row.logoWidthCenter ?? 180,
        logoWidthMobile: row.logoWidthMobile ?? 120,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

// Update header settings (admin only)
// Accepts camelCase, converts to snake_case for SQL only
exports.updateHeaderSettings = async ({
    logoImage,
    logoImageDark,
    logoPosition,
    menuPosition,
    logoWidthLeft,
    logoWidthCenter,
    logoWidthMobile
}) => {
    // Validate positions
    if (logoPosition && !VALID_POSITIONS.includes(logoPosition)) {
        throw new CustomError(`Invalid logo position. Must be one of: ${VALID_POSITIONS.join(", ")}`, 400);
    }
    if (menuPosition && !VALID_POSITIONS.includes(menuPosition)) {
        throw new CustomError(`Invalid menu position. Must be one of: ${VALID_POSITIONS.join(", ")}`, 400);
    }

    // Check if settings exist
    const existing = await query("SELECT id, logo_image, logo_image_dark FROM header_settings LIMIT 1", []);

    let result;
    if (existing.rows.length === 0) {
        // Insert new settings
        const insertSql = `
            INSERT INTO header_settings (
                logo_image,
                logo_image_dark,
                logo_position,
                menu_position,
                logo_width_left,
                logo_width_center,
                logo_width_mobile
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;
        result = await query(insertSql, [
            logoImage || null,
            logoImageDark || null,
            logoPosition || "left",
            menuPosition || "right",
            logoWidthLeft !== undefined ? logoWidthLeft : 300,
            logoWidthCenter !== undefined ? logoWidthCenter : 180,
            logoWidthMobile !== undefined ? logoWidthMobile : 120
        ]);
    } else {
        // Update existing settings
        const updates = [];
        const values = [];
        let paramIndex = 1;

        // Handle logo image update - delete old image if new one is provided
        if (logoImage !== undefined) {
            const oldLogo = existing.rows[0].logoImage;
            if (oldLogo && oldLogo !== logoImage && logoImage) {
                const oldLogoPath = path.join(__dirname, '../../public/header-logo', oldLogo);
                if (fs.existsSync(oldLogoPath)) {
                    try {
                        fs.unlinkSync(oldLogoPath);
                    } catch (error) {
                        console.error("Error deleting old header logo:", error);
                    }
                }
            }
            updates.push(`logo_image = $${paramIndex++}`);
            values.push(logoImage || null);
        }

        if (logoImageDark !== undefined) {
            const oldLogoDark = existing.rows[0].logoImageDark;
            if (oldLogoDark && oldLogoDark !== logoImageDark && logoImageDark) {
                const oldLogoPath = path.join(__dirname, '../../public/header-logo', oldLogoDark);
                if (fs.existsSync(oldLogoPath)) {
                    try {
                        fs.unlinkSync(oldLogoPath);
                    } catch (error) {
                        console.error("Error deleting old header logo dark:", error);
                    }
                }
            }
            updates.push(`logo_image_dark = $${paramIndex++}`);
            values.push(logoImageDark || null);
        }

        if (logoPosition !== undefined) {
            updates.push(`logo_position = $${paramIndex++}`);
            values.push(logoPosition);
        }
        if (menuPosition !== undefined) {
            updates.push(`menu_position = $${paramIndex++}`);
            values.push(menuPosition);
        }
        if (logoWidthLeft !== undefined) {
            updates.push(`logo_width_left = $${paramIndex++}`);
            values.push(logoWidthLeft);
        }
        if (logoWidthCenter !== undefined) {
            updates.push(`logo_width_center = $${paramIndex++}`);
            values.push(logoWidthCenter);
        }
        if (logoWidthMobile !== undefined) {
            updates.push(`logo_width_mobile = $${paramIndex++}`);
            values.push(logoWidthMobile);
        }

        if (updates.length === 0) {
            throw new CustomError("No fields to update", 400);
        }

        updates.push(`updated_at = NOW()`);
        values.push(existing.rows[0].id);

        const updateSql = `
            UPDATE header_settings
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
        logoImage: row.logoImage ?? null,
        logoPosition: row.logoPosition || 'left',
        menuPosition: row.menuPosition || 'right',
        logoWidthLeft: row.logoWidthLeft ?? 300,
        logoWidthCenter: row.logoWidthCenter ?? 180,
        logoWidthMobile: row.logoWidthMobile ?? 120,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
};

exports.VALID_POSITIONS = VALID_POSITIONS;

