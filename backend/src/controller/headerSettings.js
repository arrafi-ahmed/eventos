const router = require("express").Router();
const headerSettingsService = require("../service/headerSettings");
const ApiResponse = require("../model/ApiResponse");
const { auth, isAdmin } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const fs = require("fs");

// Get header settings (public endpoint)
router.get("/", async (req, res, next) => {
    try {
        const settings = await headerSettingsService.getHeaderSettings();
        res.status(200).json(new ApiResponse(null, { settings }));
    } catch (err) {
        next(err);
    }
});

// Get header settings (admin endpoint - same as public but for consistency)
router.get("/admin", auth, isAdmin, async (req, res, next) => {
    try {
        const settings = await headerSettingsService.getHeaderSettings();
        res.status(200).json(new ApiResponse(null, { settings }));
    } catch (err) {
        next(err);
    }
});

// Update header settings (admin only)
router.put("/", auth, isAdmin, upload("header"), async (req, res, next) => {
    try {
        const {
            logoPosition,
            menuPosition,
            logoWidthLeft,
            logoWidthCenter,
            logoWidthMobile
        } = req.body;

        const updateData = {};
        if (logoPosition !== undefined) updateData.logoPosition = logoPosition;
        if (menuPosition !== undefined) updateData.menuPosition = menuPosition;
        if (logoWidthLeft !== undefined) updateData.logoWidthLeft = parseInt(logoWidthLeft);
        if (logoWidthCenter !== undefined) updateData.logoWidthCenter = parseInt(logoWidthCenter);
        if (logoWidthMobile !== undefined) updateData.logoWidthMobile = parseInt(logoWidthMobile);

        // Handle logo image uploads if provided (processedFiles is an object with field names)
        if (req.processedFiles) {
            if (req.processedFiles.logoImage) {
                updateData.logoImage = req.processedFiles.logoImage.filename;
            }
            if (req.processedFiles.logoImageDark) {
                updateData.logoImageDark = req.processedFiles.logoImageDark.filename;
            }
        }

        const settings = await headerSettingsService.updateHeaderSettings(updateData);

        res.status(200).json(new ApiResponse("Header settings updated successfully!", { settings }));
    } catch (err) {
        // Delete uploaded files if error occurs
        if (req.processedFiles) {
            Object.values(req.processedFiles).forEach(file => {
                try { fs.unlinkSync(file.path); } catch (e) { }
            });
        }
        next(err);
    }
});

module.exports = router;

