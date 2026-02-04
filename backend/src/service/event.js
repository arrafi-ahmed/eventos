const CustomError = require("../model/CustomError");
const { query } = require("../db");
const systemSettingsService = require('./systemSettings');
const { removeImages, ifAdmin } = require("../utils/common");

const { v4: uuidv4 } = require("uuid");

// Helper function to generate slug from event name
const generateSlug = (name) => {
    if (!name) return "";

    return (
        name
            .toLowerCase()
            .trim()
            // Replace spaces and special characters with hyphens
            .replace(/[^a-z0-9\s-]/g, "")
            .replace(/\s+/g, "-")
            // Remove multiple consecutive hyphens
            .replace(/-+/g, "-")
            // Remove leading and trailing hyphens
            .replace(/^-+|-+$/g, "")
    );
};

// Helper function to check if slug is unique
const isSlugUnique = async (slug, excludeId = null) => {
    let sql = "SELECT id FROM event WHERE slug = $1";
    let values = [slug];

    if (excludeId) {
        sql += " AND id != $2";
        values.push(excludeId);
    }

    const result = await query(sql, values);
    return result.rows.length === 0;
};

// Helper function to generate unique slug
const generateUniqueSlug = async (name, excludeId = null) => {
    let baseSlug = generateSlug(name);
    let slug = baseSlug;
    let counter = 1;

    while (!(await isSlugUnique(slug, excludeId))) {
        slug = `${baseSlug}-${counter}`;
        counter++;
    }

    return slug;
};

exports.save = async ({ payload, files, currentUser }) => {
    const newEvent = {
        ...payload,
        organizationId: currentUser.organizationId,
        createdBy: currentUser.id,
    };
    const shouldCreate = !newEvent.id;

    // create event
    if (shouldCreate) {
        newEvent.registrationCount = 0;
        if (!newEvent.config) {
            newEvent.config = {
                maxTicketsPerRegistration: 10,
                allowMultipleRegistrations: true,
                saveAllAttendeesDetails: true,
                isSingleDayEvent: false,
                enableAbandonedCartEmails: false,
                enableMerchandiseShop: false
            };
        }
    }

    // update event - check authorization
    else if (!ifAdmin(currentUser.role)) {
        const sql = `
            SELECT *
            FROM event
            WHERE id = $1
              AND organization_id = $2
        `;
        const result = await query(sql, [newEvent.id, currentUser.organizationId]);
        const existingEvent = result.rows[0];
        if (!existingEvent || !existingEvent.id) {
            throw new CustomError("Access denied", 401);
        }
    }

    // add banner
    if (files && files.length > 0) {
        newEvent.banner = files[0].filename;
    }

    // remove banner
    if (payload.rmImage) {
        await removeImages([payload.rmImage]);
        delete newEvent.rmImage;

        if (!newEvent.banner) newEvent.banner = null;
    }

    // handle slug generation
    if (shouldCreate || (payload.slug && payload.slug !== newEvent.slug)) {
        if (payload.slug && payload.slug.trim()) {
            // User provided a custom slug
            const isUnique = await isSlugUnique(payload.slug, newEvent.id);
            if (!isUnique) {
                throw new CustomError(
                    "Slug already exists. Please choose a different one.",
                    400,
                );
            }
            newEvent.slug = payload.slug;
        } else {
            // Generate slug from name
            newEvent.slug = await generateUniqueSlug(newEvent.name, newEvent.id);
        }
    }
    if (shouldCreate) {
        const sql = `
            INSERT INTO event (name, description, start_datetime, end_datetime, location, banner, slug, currency,
                               tax_type, tax_amount, organization_id,
                               created_by, registration_count, config)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *
        `;
        const systemSettings = await systemSettingsService.getSystemSettings();
        const appearance = systemSettings.appearance;
        const finalCurrency = newEvent.currency || appearance.defaultCurrency || 'USD';
        const values = [
            newEvent.name,
            newEvent.description,
            newEvent.startDatetime,
            newEvent.endDatetime && newEvent.endDatetime !== '' ? newEvent.endDatetime : null, // Allow null for single day events
            newEvent.location,
            newEvent.banner,
            newEvent.slug,
            finalCurrency,
            newEvent.taxType,
            newEvent.taxAmount,
            newEvent.organizationId,
            newEvent.createdBy,
            newEvent.registrationCount,
            newEvent.config
        ];
        const result = await query(sql, values);
        return result.rows[0];
    } else {
        const sql = `
            UPDATE event
            SET name           = $1,
                description    = $2,
                start_datetime = $3,
                end_datetime   = $4,
                location       = $5,
                banner         = $6,
                landing_config = $7,
                slug           = $8,
                currency       = $9,
                tax_type       = $10,
                tax_amount     = $11,
                config         = $12
            WHERE id = $13 RETURNING *
        `;
        const systemSettings = await systemSettingsService.getSystemSettings();
        const appearance = systemSettings.appearance;
        const finalCurrency = newEvent.currency || systemSettings.localization?.defaultCurrency || 'USD';
        const values = [
            newEvent.name,
            newEvent.description,
            newEvent.startDatetime,
            newEvent.endDatetime && newEvent.endDatetime !== '' ? newEvent.endDatetime : null, // Allow null for single day events
            newEvent.location,
            newEvent.banner,
            newEvent.landingConfig,
            newEvent.slug,
            finalCurrency,
            newEvent.taxType,
            newEvent.taxAmount,
            newEvent.config,
            newEvent.id,
        ];
        const result = await query(sql, values);
        return result.rows[0];
    }
};


exports.removeEvent = async ({ eventId, organizationId }) => {
    const sql = `
        DELETE
        FROM event
        WHERE id = $1
          AND organization_id = $2 RETURNING *;`;

    const deletedEvent = await query(sql, [eventId, organizationId]);

    if (deletedEvent.rows[0]?.banner) {
        await removeImages([deletedEvent.rows[0].banner]);
    }
    return deletedEvent.rows[0];
};


exports.getEventById = async ({ eventId }) => {
    const sql = `
        SELECT *
        FROM event
        WHERE id = $1`;
    const event = await query(sql, [eventId]);
    return event.rows[0];
};

exports.getEventBySlug = async ({ slug }) => {
    const sql = `
        SELECT *
        FROM event
        WHERE slug = $1`;
    const event = await query(sql, [slug]);
    return event.rows[0];
};

exports.getEventByEventIdnOrganizationId = async ({ organizationId, eventId, currentUser }) => {
    if (!eventId || !organizationId || !currentUser) {
        throw new CustomError("Access denied", 403);
    }

    const sql = `
        SELECT *
        FROM event
        WHERE id = $1
          AND organization_id = $2`;
    const result = await query(sql, [eventId, organizationId]);

    if (!result.rows[0]) {
        throw new CustomError("Event not found", 404);
    }

    return result.rows[0];
};

exports.getAllEvents = async ({
    organizationId,
    search = '',
    page = 1,
    itemsPerPage = 10,
    offset = 0,
    fetchTotalCount = false
} = {}) => {
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

    // Get total count if requested
    let totalCount = 0;
    if (fetchTotalCount) {
        const countSql = `
            SELECT COUNT(*) as total
            FROM event
            ${whereSql}
        `;
        const countResult = await query(countSql, params);
        totalCount = parseInt(countResult.rows[0].total);
    }

    const limitOffsetParams = [...params];
    limitOffsetParams.push(itemsPerPage);
    limitOffsetParams.push(offset);

    const sql = `
        SELECT *
        FROM event
        ${whereSql}
        ORDER BY start_datetime ASC
        LIMIT $${limitOffsetParams.length - 1}
        OFFSET $${limitOffsetParams.length}`;

    const result = await query(sql, limitOffsetParams);

    return {
        items: result.rows,
        totalItems: totalCount,
        page,
        itemsPerPage,
        totalPages: Math.ceil(totalCount / itemsPerPage)
    };
};

// Get only published events (for public access)
exports.getPublishedEvents = async ({ organizationId }) => {
    const sql = `
        SELECT *
        FROM event
        WHERE organization_id = $1
          AND status = 'published'
        ORDER BY start_datetime ASC`;
    const result = await query(sql, [organizationId]);
    return result.rows;
};

exports.increaseRegistrationCount = async ({ eventId }) => {
    const sql = `
        UPDATE event
        SET registration_count = registration_count + 1
        WHERE id = $1 RETURNING *;`;
    const updatedEvent = await query(sql, [eventId]);
    return updatedEvent.rows[0];
};

exports.getAllActiveEvents = async ({ organizationId, currentDate }) => {
    // const currentDate = new Date().toISOString().split("T")[0]; // Format the date as YYYY-MM-DD
    const sql = `
        SELECT *
        FROM event
        WHERE organization_id = $1
          AND (
            (end_datetime IS NOT NULL AND $2::date < end_datetime) OR
            (end_datetime IS NULL AND $2::date >= start_datetime::date)
            )
        ORDER BY start_datetime ASC;
    `;
    const results = await query(sql, [organizationId, currentDate]);
    return results.rows;
};

exports.getFirstEvent = async () => {
    const sql = `
        SELECT e.*, org.name as organization_name, org.location as organization_location, org.logo as organization_logo
        FROM event e
                 JOIN organization org ON e.organization_id = org.id
        WHERE e.start_datetime >= CURRENT_DATE
        ORDER BY e.start_datetime ASC LIMIT 1
    `;
    const result = await query(sql);
    return result.rows[0];
};

// Search published events across all organizations
exports.searchPublishedEvents = async ({ searchTerm, page = 1, itemsPerPage = 12 }) => {
    const offset = (page - 1) * itemsPerPage;

    // Ensure search term is properly formatted and trimmed
    const cleanSearchTerm = searchTerm ? searchTerm.trim() : '';
    const searchPattern = `%${cleanSearchTerm}%`;

    // Get total count
    const countSql = `
        SELECT COUNT(*) as total
        FROM event e
                 JOIN organization org ON e.organization_id = org.id
        WHERE e.status = 'published'
          AND (
            LOWER(e.name) LIKE LOWER($1) OR
            LOWER(e.description) LIKE LOWER($1) OR
            LOWER(e.location) LIKE LOWER($1) OR
            LOWER(org.name) LIKE LOWER($1)
            )
          AND (
            (e.end_datetime IS NOT NULL AND e.end_datetime >= CURRENT_DATE) OR
            (e.end_datetime IS NULL AND e.start_datetime >= CURRENT_DATE)
            )
    `;
    const countResult = await query(countSql, [searchPattern]);
    const totalCount = parseInt(countResult.rows[0].total);

    // Get search results
    const sql = `
        SELECT e.*, org.name as organization_name, org.location as organization_location, org.logo as organization_logo
        FROM event e
                 JOIN organization org ON e.organization_id = org.id
        WHERE e.status = 'published'
          AND (
            LOWER(e.name) LIKE LOWER($1) OR
            LOWER(e.description) LIKE LOWER($1) OR
            LOWER(e.location) LIKE LOWER($1) OR
            LOWER(org.name) LIKE LOWER($1)
            )
          AND (
            (e.end_datetime IS NOT NULL AND e.end_datetime >= CURRENT_DATE) OR
            (e.end_datetime IS NULL AND e.start_datetime >= CURRENT_DATE)
            )
        ORDER BY e.start_datetime ASC
            LIMIT $2
        OFFSET $3
    `;
    const result = await query(sql, [searchPattern, itemsPerPage, offset]);

    return {
        items: result.rows,
        totalItems: totalCount,
        page,
        itemsPerPage,
        totalPages: Math.ceil(totalCount / itemsPerPage)
    };
};

exports.saveConfig = async ({ payload, currentUser }) => {
    // const eventId = payload.id;

    // // Check authorization
    // if (!ifAdmin(currentUser.role)) {
    //     const sql = `
    //         SELECT *
    //         FROM event
    //         WHERE id = $1
    //           AND organization_id = $2
    //     `;
    //     const result = await query(sql, [eventId, currentUser.organizationId]);
    //     const existingEvent = result.rows[0];
    //     if (!existingEvent || !existingEvent.id) {
    //         throw new CustomError("Access denied", 401);
    //     }
    // }

    // // Prepare configuration object
    // const config = {
    //     maxTicketsPerRegistration: parseInt(payload.maxTicketsPerRegistration) || 10,
    //     allowMultipleRegistrations: payload.allowMultipleRegistrations === 'true',
    //     saveAllAttendeesDetails: payload.saveAllAttendeesDetails === 'true',
    //     isSingleDayEvent: payload.isSingleDayEvent === 'true',
    // };

    // Update event with configuration
    const sql = `
        UPDATE event
        SET config = $1
        WHERE id = $2 RETURNING *
    `;

    const values = [
        JSON.stringify(payload.config),
        payload.eventId
    ];

    const result = await query(sql, values);
    return result.rows[0];
};

exports.saveLandingConfig = async ({ payload, currentUser }) => {
    const eventId = payload.id;

    // Check authorization
    if (!ifAdmin(currentUser.role)) {
        const sql = `
            SELECT *
            FROM event
            WHERE id = $1
              AND organization_id = $2
        `;
        const result = await query(sql, [eventId, currentUser.organizationId]);
        const existingEvent = result.rows[0];
        if (!existingEvent || !existingEvent.id) {
            throw new CustomError("Access denied", 401);
        }
    }

    // Prepare landing configuration object
    const landingConfig = {
        enableLandingPage: payload.enableLandingPage === 'true',
        heroTitle: payload.heroTitle || '',
        heroSubtitle: payload.heroSubtitle || '',
        overviewTitle: payload.overviewTitle || '',
        overviewDescription: payload.overviewDescription || '',
        customCSS: payload.customCSS || '',
        customJS: payload.customJS || '',
    };

    // Update event with landing configuration
    const sql = `
        UPDATE event
        SET landing_config = $1
        WHERE id = $2 RETURNING *
    `;

    const values = [
        JSON.stringify(landingConfig),
        eventId
    ];

    const result = await query(sql, values);
    return result.rows[0];
};

// Publish an event (make it public)
// Authorization and verification are handled by middleware (isOrganizerEventAuthor and isOrganizerVerified)
exports.publishEvent = async ({ eventId }) => {
    const sql = `
        UPDATE event
        SET status = 'published'
        WHERE id = $1 RETURNING *
    `;
    const result = await query(sql, [eventId]);

    if (!result.rows[0]) {
        throw new CustomError("Event not found", 404);
    }

    return result.rows[0];
};

// Unpublish an event (make it draft/private)
// Authorization is handled by isOrganizerEventAuthor middleware
exports.unpublishEvent = async ({ eventId }) => {
    const sql = `
        UPDATE event
        SET status = 'draft'
        WHERE id = $1 RETURNING *
    `;
    const result = await query(sql, [eventId]);

    if (!result.rows[0]) {
        throw new CustomError("Event not found", 404);
    }

    return result.rows[0];
};
