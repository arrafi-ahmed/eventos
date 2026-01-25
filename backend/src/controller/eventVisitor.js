const router = require("express").Router();
const eventVisitorService = require("../service/eventVisitor");
const ApiResponse = require("../model/ApiResponse");
const {auth, isOrganizerEventAuthor} = require("../middleware/auth");

/**
 * Save visitor data (public endpoint - no auth required)
 * POST /event-visitor/save
 */
router.post("/save", async (req, res, next) => {
    try {
        const {eventId, firstName, lastName, email, phone} = req.body;

        const result = await eventVisitorService.saveVisitor({
            eventId,
            firstName,
            lastName,
            email,
            phone,
        });

        res.status(200).json(
            new ApiResponse("Visitor data saved successfully", result),
        );
    } catch (err) {
        next(err);
    }
});

/**
 * Get visitors for an event (requires auth - organizer/admin only)
 * GET /event-visitor/getEventVisitors?eventId=123&page=1&itemsPerPage=50
 */
router.get(
    "/getEventVisitors",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            const eventId = parseInt(req.query.eventId);
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = parseInt(req.query.itemsPerPage) || 50;
            const includeConverted = req.query.includeConverted !== "false";

            const result = await eventVisitorService.getEventVisitors({
                eventId,
                pagination: {page, itemsPerPage},
                includeConverted,
            });

            res.status(200).json(new ApiResponse(null, result));
        } catch (err) {
            next(err);
        }
    },
);

/**
 * Get visitor statistics for an event
 * GET /event-visitor/stats?eventId=123
 */
router.get("/stats", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const eventId = parseInt(req.query.eventId);

        const stats = await eventVisitorService.getVisitorStats(eventId);

        res.status(200).json(new ApiResponse(null, stats));
    } catch (err) {
        next(err);
    }
});

/**
 * Delete a visitor
 * DELETE /event-visitor/delete?visitorId=123&eventId=456
 */
router.delete("/delete", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const visitorId = parseInt(req.query.visitorId);
        const eventId = parseInt(req.query.eventId);

        if (!visitorId || !eventId) {
            return res.status(400).json(
                new ApiResponse("Visitor ID and Event ID are required", null)
            );
        }

        const result = await eventVisitorService.deleteVisitor({
            visitorId,
            eventId,
        });

        res.status(200).json(new ApiResponse("Visitor deleted successfully", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;


