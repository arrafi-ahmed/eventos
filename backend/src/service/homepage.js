const {query} = require("../db");
const CustomError = require("../model/CustomError");
const path = require("path");
const fs = require("fs");

// Helper function to transform section to banner format (for backward compatibility)
function sectionToBanner(section) {
    // Handle config - it might be a string (from JSONB) or already an object
    let config = section.config || {};
    if (typeof config === 'string') {
        try {
            config = JSON.parse(config);
        } catch (e) {
            console.error('Error parsing config JSON:', e);
            config = {};
        }
    }

    return {
        id: section.id,
        imageUrl: config.image || null,
        link: config.link || null,
        startDate: config.startDate || null,
        endDate: config.endDate || null,
        displayOrder: section.displayOrder || 0,
        isActive: section.isActive !== false,
        createdAt: section.createdAt,
        updatedAt: section.updatedAt,
        createdBy: section.createdBy
    };
}

// Get all active banners (for public homepage)
exports.getActiveBanners = async () => {
    const now = new Date();
    // Format as YYYY-MM-DD for date comparison
    const nowDateStr = now.toISOString().split('T')[0];
    const sql = `
        SELECT 
            id,
            display_order,
            is_active,
            is_published,
            config,
            created_at
        FROM homepage_section
        WHERE section_type = 'banner'
            AND is_active = true
            AND is_published = true
            AND (config->>'startDate')::date <= $1::date
            AND (config->>'endDate')::date >= $1::date
        ORDER BY display_order ASC, created_at DESC
    `;
    const result = await query(sql, [nowDateStr]);

    // Log all banners for debugging
    const allBannersSql = `
        SELECT 
            id,
            is_active,
            is_published,
            config->>'startDate' as start_date,
            config->>'endDate' as end_date
        FROM homepage_section
        WHERE section_type = 'banner'
        ORDER BY id
    `;
    const allBanners = await query(allBannersSql, []);

    return result.rows.map(sectionToBanner);
};

// Get all banners (for admin)
exports.getAllBanners = async () => {
    const sql = `
        SELECT 
            id,
            display_order,
            is_active,
            is_published,
            config,
            created_at,
            updated_at,
            created_by
        FROM homepage_section
        WHERE section_type = 'banner'
        ORDER BY display_order ASC, created_at DESC
    `;
    const result = await query(sql, []);
    return result.rows.map(sectionToBanner);
};

// Get single banner by ID
exports.getBannerById = async ({bannerId}) => {
    const sql = `
        SELECT *
        FROM homepage_section
        WHERE id = $1 AND section_type = 'banner'
    `;
    const result = await query(sql, [bannerId]);
    if (result.rows.length === 0) {
        throw new CustomError("Homepage banner not found", 404);
    }
    return sectionToBanner(result.rows[0]);
};

// Create banner
exports.createBanner = async ({imageUrl, link, startDate, endDate, displayOrder, isActive, userId}) => {
    if (!imageUrl) {
        throw new CustomError("Image URL is required", 400);
    }
    if (!startDate || !endDate) {
        throw new CustomError("Start date and end date are required", 400);
    }
    if (new Date(startDate) >= new Date(endDate)) {
        throw new CustomError("End date must be after start date", 400);
    }

    // Get max display_order if not provided
    let order = displayOrder;
    if (order === undefined || order === null) {
        const maxOrderResult = await query(
            "SELECT COALESCE(MAX(display_order), -1) + 1 as next_order FROM homepage_section WHERE section_type = 'banner'"
        );
        order = maxOrderResult.rows[0].next_order;
    }

    // Build config JSONB
    const config = {
        image: imageUrl,
        link: link || null,
        startDate: startDate,
        endDate: endDate
    };

    const sql = `
        INSERT INTO homepage_section (
            section_type,
            display_order,
            is_active,
            is_published,
            config,
            created_by
        )
        VALUES ('banner', $1, $2, true, $3, $4)
        RETURNING *
    `;
    const active = isActive !== undefined ? (isActive === true || isActive === 'true') : true;
    const result = await query(sql, [order, active, JSON.stringify(config), userId]);
    return sectionToBanner(result.rows[0]);
};

// Update banner
exports.updateBanner = async ({bannerId, imageUrl, link, startDate, endDate, displayOrder, isActive}) => {
    const section = await query(
        "SELECT * FROM homepage_section WHERE id = $1 AND section_type = 'banner'",
        [bannerId]
    );

    if (section.rows.length === 0) {
        throw new CustomError("Homepage banner not found", 404);
    }

    const currentSection = section.rows[0];
    const currentConfig = currentSection.config || {};

    if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
        throw new CustomError("End date must be after start date", 400);
    }

    // Build updated config
    const updatedConfig = {
        image: imageUrl !== undefined ? imageUrl : currentConfig.image,
        link: link !== undefined ? (link || null) : currentConfig.link,
        startDate: startDate !== undefined ? startDate : currentConfig.startDate,
        endDate: endDate !== undefined ? endDate : currentConfig.endDate
    };

    // Delete old image if new one is provided
    if (imageUrl !== undefined && currentConfig.image && currentConfig.image !== imageUrl) {
        const oldImagePath = path.join(__dirname, '../../public/homepage-banner', currentConfig.image);
        if (fs.existsSync(oldImagePath)) {
            try {
                fs.unlinkSync(oldImagePath);
            } catch (error) {
                console.error("Error deleting old homepage banner image:", error);
            }
        }
    }

    const updates = [];
    const values = [];
    let paramIndex = 1;

    // Always update config
    updates.push(`config = $${paramIndex++}`);
    values.push(JSON.stringify(updatedConfig));

    if (displayOrder !== undefined) {
        updates.push(`display_order = $${paramIndex++}`);
        values.push(displayOrder);
    }

    if (isActive !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(isActive);
        // Automatically set is_published = true when is_active = true
        // This ensures active banners are always published and visible on homepage
        if (isActive === true || isActive === 'true') {
            updates.push(`is_published = true`);
        }
    }

    // Update updated_at timestamp
    updates.push(`updated_at = NOW()`);

    values.push(bannerId);
    const sql = `
        UPDATE homepage_section
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex} AND section_type = 'banner'
        RETURNING *
    `;
    const result = await query(sql, values);
    return sectionToBanner(result.rows[0]);
};

// Delete banner
exports.deleteBanner = async ({bannerId}) => {
    const section = await query(
        "SELECT * FROM homepage_section WHERE id = $1 AND section_type = 'banner'",
        [bannerId]
    );

    if (section.rows.length === 0) {
        throw new CustomError("Homepage banner not found", 404);
    }

    const config = section.rows[0].config || {};

    // Delete image file
    if (config.image) {
        const imagePath = path.join(__dirname, '../../public/homepage-banner', config.image);
        if (fs.existsSync(imagePath)) {
            try {
                fs.unlinkSync(imagePath);
            } catch (error) {
                console.error("Error deleting homepage banner image:", error);
            }
        }
    }

    const sql = `
        DELETE FROM homepage_section
        WHERE id = $1 AND section_type = 'banner'
        RETURNING id
    `;
    const result = await query(sql, [bannerId]);
    return result.rows[0];
};

// Update display order (for reordering)
exports.updateDisplayOrder = async ({bannerOrders}) => {
    // bannerOrders is an array of {id, display_order}
    const {pool} = require("../db");
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        for (const {id, display_order} of bannerOrders) {
            await client.query(
                "UPDATE homepage_section SET display_order = $1, updated_at = NOW() WHERE id = $2 AND section_type = 'banner'",
                [display_order, id]
            );
        }

        await client.query("COMMIT");
        return {success: true};
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

