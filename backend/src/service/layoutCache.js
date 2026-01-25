const {query} = require("../db");

/**
 * Get cache timestamps for all layout settings
 * Returns the updated_at timestamp for each settings type
 * This allows clients to check if their cache is stale
 */
exports.getCacheTimestamps = async () => {
    const timestamps = {};

    try {
        // Footer settings
        const footerResult = await query(
            "SELECT updated_at FROM footer_settings ORDER BY id ASC LIMIT 1",
            []
        );
        timestamps.footer = footerResult.rows.length > 0
            ? footerResult.rows[0].updatedAt || footerResult.rows[0].updated_at
            : null;

        // Header settings
        const headerResult = await query(
            "SELECT updated_at FROM header_settings ORDER BY id ASC LIMIT 1",
            []
        );
        timestamps.header = headerResult.rows.length > 0
            ? headerResult.rows[0].updatedAt || headerResult.rows[0].updated_at
            : null;

        // Appearance settings
        const appearanceResult = await query(
            "SELECT updated_at FROM appearance_settings ORDER BY id ASC LIMIT 1",
            []
        );
        timestamps.appearance = appearanceResult.rows.length > 0
            ? appearanceResult.rows[0].updatedAt || appearanceResult.rows[0].updated_at
            : null;

        // Organizer dashboard banner
        const bannerResult = await query(
            "SELECT updated_at FROM organizer_dashboard_banner ORDER BY id ASC LIMIT 1",
            []
        );
        timestamps.organizerDashboardBanner = bannerResult.rows.length > 0
            ? bannerResult.rows[0].updatedAt || bannerResult.rows[0].updated_at
            : null;

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

