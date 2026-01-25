const router = require("express").Router();
const layoutCacheService = require("../service/layoutCache");
const ApiResponse = require("../model/ApiResponse");

// Get cache timestamps (public endpoint - lightweight check)
router.get("/timestamps", async (req, res, next) => {
    try {
        const timestamps = await layoutCacheService.getCacheTimestamps();
        res.status(200).json(new ApiResponse(null, {timestamps}));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

