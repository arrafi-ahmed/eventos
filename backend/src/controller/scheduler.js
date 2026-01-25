const router = require("express").Router();
const {scheduler} = require("../scheduler");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdmin} = require("../middleware/auth");

/**
 * Get status of all scheduled jobs
 * GET /scheduler/status
 * Requires authentication (admin only)
 */
router.get("/status", auth, isAdmin, async (req, res, next) => {
    try {
        const status = scheduler.getStatus();
        res.status(200).json(
            new ApiResponse("Scheduler status retrieved successfully", {
                jobs: status,
                totalJobs: status.length,
                enabledJobs: status.filter(j => j.enabled && j.running).length
            })
        );
    } catch (err) {
        next(err);
    }
});

module.exports = router;

