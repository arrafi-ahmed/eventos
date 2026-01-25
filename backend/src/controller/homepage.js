const router = require("express").Router();
const homepageService = require("../service/homepage");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdminOrOrganizer} = require("../middleware/auth");
const {upload} = require("../middleware/upload");
const fs = require("fs");

// Get active banners (public endpoint)
router.get("/banners/active", async (req, res, next) => {
    try {
        const banners = await homepageService.getActiveBanners();
        res.status(200).json(new ApiResponse(null, {banners}));
    } catch (err) {
        next(err);
    }
});

// Get all banners (admin or organizer)
router.get("/banners", auth, isAdminOrOrganizer, async (req, res, next) => {
    try {
        const banners = await homepageService.getAllBanners();
        res.status(200).json(new ApiResponse(null, {banners}));
    } catch (err) {
        next(err);
    }
});

// Get single banner (admin or organizer)
router.get("/banners/:id", auth, isAdminOrOrganizer, async (req, res, next) => {
    try {
        const bannerId = parseInt(req.params.id);
        const banner = await homepageService.getBannerById({bannerId});
        res.status(200).json(new ApiResponse(null, {banner}));
    } catch (err) {
        next(err);
    }
});

// Create banner (admin or organizer)
router.post("/banners", auth, isAdminOrOrganizer, upload("homepage"), async (req, res, next) => {
    try {
        const {link, startDate, endDate, displayOrder, isActive} = req.body;

        if (!req.processedFiles || !req.processedFiles[0]) {
            return res.status(400).json(new ApiResponse("Image is required"));
        }

        const imageUrl = req.processedFiles[0].filename;

        const banner = await homepageService.createBanner({
            imageUrl,
            link: link || null,
            startDate,
            endDate,
            displayOrder: displayOrder ? parseInt(displayOrder) : undefined,
            isActive: isActive === 'true' || isActive === true,
            userId: req.currentUser.id,
        });

        res.status(201).json(new ApiResponse("Homepage banner created successfully!", {banner}));
    } catch (err) {
        // Delete uploaded file if error occurs
        if (req.processedFiles && req.processedFiles[0]) {
            try {
                fs.unlinkSync(req.processedFiles[0].path);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        next(err);
    }
});

// Update banner (admin or organizer)
router.put("/banners/:id", auth, isAdminOrOrganizer, upload("homepage"), async (req, res, next) => {
    try {
        const bannerId = parseInt(req.params.id);
        const {link, startDate, endDate, displayOrder, isActive} = req.body;

        const updateData = {};
        if (link !== undefined) updateData.link = link;
        if (startDate !== undefined) updateData.startDate = startDate;
        if (endDate !== undefined) updateData.endDate = endDate;
        if (displayOrder !== undefined) updateData.displayOrder = parseInt(displayOrder);
        if (isActive !== undefined) updateData.isActive = isActive === 'true' || isActive === true;

        // Handle image upload if provided
        if (req.processedFiles && req.processedFiles[0]) {
            updateData.imageUrl = req.processedFiles[0].filename;
        }

        const banner = await homepageService.updateBanner({
            bannerId,
            ...updateData,
        });

        res.status(200).json(new ApiResponse("Homepage banner updated successfully!", {banner}));
    } catch (err) {
        // Delete uploaded file if error occurs
        if (req.processedFiles && req.processedFiles[0]) {
            try {
                fs.unlinkSync(req.processedFiles[0].path);
            } catch (e) {
                // Ignore cleanup errors
            }
        }
        next(err);
    }
});

// Delete banner (admin or organizer)
router.delete("/banners/:id", auth, isAdminOrOrganizer, async (req, res, next) => {
    try {
        const bannerId = parseInt(req.params.id);
        await homepageService.deleteBanner({bannerId});
        res.status(200).json(new ApiResponse("Homepage banner deleted successfully!"));
    } catch (err) {
        next(err);
    }
});

// Update display order (admin or organizer)
router.post("/banners/reorder", auth, isAdminOrOrganizer, async (req, res, next) => {
    try {
        const {bannerOrders} = req.body; // Array of {id, display_order}
        if (!Array.isArray(bannerOrders)) {
            return res.status(400).json(new ApiResponse("bannerOrders must be an array"));
        }
        await homepageService.updateDisplayOrder({bannerOrders});
        res.status(200).json(new ApiResponse("Display order updated successfully!"));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

