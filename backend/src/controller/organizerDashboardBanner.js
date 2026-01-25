const router = require("express").Router();
const organizerDashboardBannerService = require("../service/organizerDashboardBanner");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdmin} = require("../middleware/auth");

// Get organizer dashboard banner settings (public endpoint)
router.get("/", async (req, res, next) => {
    try {
        const settings = await organizerDashboardBannerService.getOrganizerDashboardBanner();
        res.status(200).json(new ApiResponse(null, {settings}));
    } catch (err) {
        next(err);
    }
});

// Update organizer dashboard banner settings (admin only)
router.put("/", auth, isAdmin, async (req, res, next) => {
    try {
        const {
            isEnabled,
            icon,
            title,
            description,
            ctaButtonText,
            ctaButtonUrl
        } = req.body;

        const settings = await organizerDashboardBannerService.updateOrganizerDashboardBanner({
            isEnabled,
            icon,
            title,
            description,
            ctaButtonText,
            ctaButtonUrl
        });

        res.status(200).json(new ApiResponse("Organizer dashboard banner settings updated successfully!", {settings}));
    } catch (err) {
        next(err);
    }
});

module.exports = router;


