const headerSettingsService = require("../service/headerSettings");
const appearanceSettingsService = require("../service/appearanceSettings");
const { getApiPublicImgUrl, appInfo } = require("./common");

/**
 * Fetches standardized branding and header data for system templates (Emails, PDFs, Badges).
 */
async function getBrandingData() {
    try {
        const settings = await headerSettingsService.getHeaderSettings();
        const appearance = await appearanceSettingsService.getAppearanceSettings();

        let logoUrl = null;
        let logoDarkUrl = null;
        if (settings.logoImage) {
            logoUrl = getApiPublicImgUrl(settings.logoImage, 'header-logo');
        }
        if (settings.logoImageDark) {
            logoDarkUrl = getApiPublicImgUrl(settings.logoImageDark, 'header-logo');
        }

        return {
            logo: logoUrl, // Default to light logo for PDFs/Emails
            logoLight: logoUrl,
            logoDark: logoDarkUrl,
            logoPosition: settings.logoPosition || 'left',
            appName: settings.organizationName || appInfo.name || 'Ticketi',
            primaryColor: appearance?.lightColors?.primary || '#ED2939'
        };
    } catch (error) {
        console.error("Error fetching branding data:", error);
        return {
            logo: null,
            logoPosition: 'left',
            appName: appInfo.name || 'Ticketi',
            primaryColor: '#ED2939'
        };
    }
}

module.exports = {
    getBrandingData
};
