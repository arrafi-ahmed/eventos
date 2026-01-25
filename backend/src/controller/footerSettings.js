const router = require("express").Router();
const footerSettingsService = require("../service/footerSettings");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdmin} = require("../middleware/auth");

// Get footer settings (public endpoint)
router.get("/", async (req, res, next) => {
    try {
        const settings = await footerSettingsService.getFooterSettings();
        res.status(200).json(new ApiResponse(null, {settings}));
    } catch (err) {
        next(err);
    }
});

// Get footer settings (admin endpoint - same as public but for consistency)
router.get("/admin", auth, isAdmin, async (req, res, next) => {
    try {
        const settings = await footerSettingsService.getFooterSettings();
        res.status(200).json(new ApiResponse(null, {settings}));
    } catch (err) {
        next(err);
    }
});

// Update footer settings (admin only)
router.put("/", auth, isAdmin, async (req, res, next) => {
    try {
        const {
            style,
            companyName,
            companyAddress,
            companyEmail,
            companyPhone,
            quickLinks,
            socialLinks,
            copyrightText
        } = req.body;

        // Validate quickLinks if provided
        if (quickLinks !== undefined && !Array.isArray(quickLinks)) {
            return res.status(400).json(new ApiResponse("quickLinks must be an array"));
        }

        // Validate socialLinks if provided
        if (socialLinks !== undefined && (typeof socialLinks !== 'object' || Array.isArray(socialLinks))) {
            return res.status(400).json(new ApiResponse("socialLinks must be an object"));
        }

        const settings = await footerSettingsService.updateFooterSettings({
            style,
            companyName,
            companyAddress,
            companyEmail,
            companyPhone,
            quickLinks,
            socialLinks,
            copyrightText
        });

        res.status(200).json(new ApiResponse("Footer settings updated successfully!", {settings}));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

