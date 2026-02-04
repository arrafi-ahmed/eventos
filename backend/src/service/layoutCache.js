const { query } = require("../db");

/**
 * Get cache timestamps for all layout settings
 * Returns the updated_at timestamp for each settings type
 * This allows clients to check if their cache is stale
 */
exports.getCacheTimestamps = async () => {
    const timestamps = {};

    try {
        // System settings (consolidated) - fetch all updated_at by key
        const systemResult = await query(
            "SELECT key, updated_at FROM system_settings",
            []
        );

        const systemTimestamps = systemResult.rows.reduce((acc, row) => {
            acc[row.key] = row.updatedAt || row.updated_at
            return acc
        }, {})

        timestamps.footer = systemTimestamps.footer || null;
        timestamps.header = systemTimestamps.header || null;
        timestamps.appearance = systemTimestamps.appearance || null;
        timestamps.organizerDashboardBanner = systemTimestamps.organizer_dashboard_banner || null;

        // Homepage banners - get the most recent updated_at from homepage_section where section_type = 'banner'
        const homepageBannersResult = await query(
            "SELECT MAX(updated_at) as max_updated_at FROM homepage_section WHERE section_type = 'banner'",
            []
        );
        timestamps.homepageBanners = homepageBannersResult.rows.length > 0 && homepageBannersResult.rows[0].maxUpdatedAt
            ? homepageBannersResult.rows[0].maxUpdatedAt || homepageBannersResult.rows[0].max_updated_at
            : null;

    } catch (error) {
        console.error('Error fetching cache timestamps:', error);
        // Return null for all if error occurs
        return {
            footer: null,
            header: null,
            appearance: null,
            organizerDashboardBanner: null,
            homepageBanners: null,
        };
    }

    return timestamps;
};

