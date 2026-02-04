const fs = require("fs").promises;
const path = require("path");
const systemSettingsService = require("../service/systemSettings");
const { getApiPublicImgUrl, getFilePath, appInfo } = require("./common");

/**
 * Helper to convert local image to Base64
 */
async function fileToBase64(filePath) {
    try {
        if (!filePath) return null;
        const data = await fs.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
        return `data:${mimeType};base64,${data.toString('base64')}`;
    } catch (e) {
        console.error(`[Branding] Base64 conversion failed for ${filePath}:`, e.message);
        return null;
    }
}

/**
 * Fetches standardized branding and header data for system templates (Email, PDF, Badges).
 */
async function getBrandingData() {
    try {
        const systemSettings = await systemSettingsService.getSystemSettings();
        const settings = systemSettings.header || {};
        const appearance = systemSettings.appearance || {};

        let logoUrl = null;
        let logoDarkUrl = null;
        let logoBase64 = null;
        let logoDarkBase64 = null;

        if (settings.logoImage) {
            logoUrl = getApiPublicImgUrl(settings.logoImage, 'header-logo');
            logoBase64 = await fileToBase64(getFilePath(settings.logoImage, 'headerLogo'));
        }
        if (settings.logoImageDark) {
            logoDarkUrl = getApiPublicImgUrl(settings.logoImageDark, 'header-logo');
            logoDarkBase64 = await fileToBase64(getFilePath(settings.logoImageDark, 'headerLogo'));
        }

        return {
            logo: logoUrl, // Default to light logo for Emails (URLs are better for mail clients)
            logoBase64: logoBase64, // Preferred for PDFs (avoids network issues in Puppeteer)
            logoLight: logoUrl,
            logoDark: logoDarkUrl,
            logoDarkBase64: logoDarkBase64,
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
