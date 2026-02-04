const systemSettingsService = require('./systemSettings')
const homepageService = require('./homepage')

/**
 * Get all layout data in a single call
 * Returns unified system settings and homepage banners
 */
exports.getAllLayoutData = async () => {
    try {
        const [systemSettings, homepageBanners] = await Promise.all([
            systemSettingsService.getSystemSettings(),
            homepageService.getActiveBanners(),
        ])

        return {
            ...systemSettings,
            homepageBanners,
            timestamp: Date.now()
        }
    } catch (error) {
        console.error('Error fetching all layout data:', error)
        throw error
    }
}
