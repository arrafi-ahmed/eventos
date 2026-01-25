const router = require("express").Router();
const appearanceSettingsService = require("../service/appearanceSettings");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdmin} = require("../middleware/auth");

// Get appearance settings (public endpoint)
router.get("/", async (req, res, next) => {
    try {
        const settings = await appearanceSettingsService.getAppearanceSettings();
        res.status(200).json(new ApiResponse(null, {settings}));
    } catch (err) {
        next(err);
    }
});

// Update appearance settings (admin only)
router.put("/", auth, isAdmin, async (req, res, next) => {
    try {
        const {
            defaultTheme,
            lightColors,
            lightVariables,
            darkColors,
            darkVariables
        } = req.body;

        // Validate lightColors if provided
        if (lightColors !== undefined && (typeof lightColors !== 'object' || Array.isArray(lightColors))) {
            return res.status(400).json(new ApiResponse("lightColors must be an object"));
        }

        // Validate darkColors if provided
        if (darkColors !== undefined && (typeof darkColors !== 'object' || Array.isArray(darkColors))) {
            return res.status(400).json(new ApiResponse("darkColors must be an object"));
        }

        // Validate lightVariables if provided
        if (lightVariables !== undefined && (typeof lightVariables !== 'object' || Array.isArray(lightVariables))) {
            return res.status(400).json(new ApiResponse("lightVariables must be an object"));
        }

        // Validate darkVariables if provided
        if (darkVariables !== undefined && (typeof darkVariables !== 'object' || Array.isArray(darkVariables))) {
            return res.status(400).json(new ApiResponse("darkVariables must be an object"));
        }

        const settings = await appearanceSettingsService.updateAppearanceSettings({
            defaultTheme,
            lightColors,
            lightVariables,
            darkColors,
            darkVariables
        });

        res.status(200).json(new ApiResponse("Appearance settings updated successfully!", {settings}));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

