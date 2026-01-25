const footerSettingsService = require("./footerSettings");
const headerSettingsService = require("./headerSettings");
const appearanceSettingsService = require("./appearanceSettings");
const organizerDashboardBannerService = require("./organizerDashboardBanner");
const homepageService = require("./homepage");

/**
 * Get all layout data in a single call
 * Returns footer, header, appearance, organizer dashboard banner, and homepage banners
 */
exports.getAllLayoutData = async () => {
    try {
        // Fetch all layout data in parallel
        const [
            footerSettings,
            headerSettings,
            appearanceSettings,
            organizerDashboardBanner,
            homepageBanners
        ] = await Promise.all([
            footerSettingsService.getFooterSettings(),
            headerSettingsService.getHeaderSettings(),
            appearanceSettingsService.getAppearanceSettings(),
            organizerDashboardBannerService.getOrganizerDashboardBanner(),
            homepageService.getActiveBanners()
        ]);

        return {
            footer: footerSettings,
            header: headerSettings,
            appearance: appearanceSettings,
            organizerDashboardBanner: organizerDashboardBanner,
            homepageBanners: homepageBanners,
            // Include timestamps for cache validation
            timestamps: {
                footer: footerSettings.updatedAt || null,
                header: headerSettings.updatedAt || null,
                appearance: appearanceSettings.updatedAt || null,
                organizerDashboardBanner: organizerDashboardBanner.updatedAt || null,
                homepageBanners: homepageBanners.length > 0 
                    ? new Date(Math.max(...homepageBanners.map(b => new Date(b.updatedAt || 0).getTime()))).toISOString()
                    : null
            }
        };
    } catch (error) {
        console.error('Error fetching all layout data:', error);
        throw error;
    }
};

