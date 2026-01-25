const router = require("express").Router();
const abandonedCartService = require("../service/abandonedCart");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdmin, isOrganizer} = require("../middleware/auth");

/**
 * Manual trigger for processing abandoned carts
 * POST /abandoned-cart/process
 * Requires authentication (admin/organizer)
 */
router.post("/process", auth, async (req, res, next) => {
    try {
        const {batchSize = 50, dryRun = false} = req.body;

        const result = await abandonedCartService.processAbandonedCarts({
            batchSize: parseInt(batchSize) || 50,
            dryRun: dryRun === true || dryRun === "true",
        });

        res.status(200).json(
            new ApiResponse("Abandoned carts processed successfully", result),
        );
    } catch (err) {
        next(err);
    }
});

/**
 * Get abandoned cart statistics
 * GET /abandoned-cart/stats
 * Requires authentication (admin/organizer)
 */
router.get("/stats", auth, async (req, res, next) => {
    try {
        const stats = await abandonedCartService.getAbandonedCartStats();
        res.status(200).json(new ApiResponse("Statistics retrieved", stats));
    } catch (err) {
        next(err);
    }
});

/**
 * Trigger the cron job manually
 * POST /abandoned-cart/trigger-job
 * Requires authentication (admin/organizer)
 */
router.post("/trigger-job", auth, async (req, res, next) => {
    try {
        const result = await abandonedCartService.processAbandonedCarts({
            batchSize: 50,
            dryRun: false
        });
        res.status(200).json(
            new ApiResponse("Abandoned cart job triggered successfully", result),
        );
    } catch (err) {
        next(err);
    }
});

/**
 * Cleanup expired carts manually
 * POST /abandoned-cart/cleanup
 * Requires authentication (admin/organizer)
 */
router.post("/cleanup", auth, async (req, res, next) => {
    try {
        const result = await abandonedCartService.cleanupExpiredCarts();
        res.status(200).json(
            new ApiResponse("Expired carts cleaned up successfully", result),
        );
    } catch (err) {
        next(err);
    }
});

module.exports = router;


