const router = require("express").Router();
const adminService = require("../service/admin");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAdmin} = require("../middleware/auth");

// Get all organizers for review
router.get("/organizers", auth, isAdmin, async (req, res, next) => {
    try {
        const {
            page,
            itemsPerPage,
            offset,
            limit,
            fetchTotalCount = "false",
            status,
        } = req.query;

        const parsedItemsPerPage = parseInt(itemsPerPage || limit, 10) || 10;
        const parsedPage = parseInt(page, 10) || 1;
        const parsedOffset =
            offset !== undefined
                ? parseInt(offset, 10) || 0
                : (parsedPage - 1) * parsedItemsPerPage;
        const parsedLimit = parsedItemsPerPage;
        const shouldFetchTotal =
            fetchTotalCount === true ||
            fetchTotalCount === "true" ||
            fetchTotalCount === "1" ||
            fetchTotalCount === 1;

        const normalizedStatus =
            typeof status === "string" ? status.toLowerCase() : undefined;

        const result = await adminService.getOrganizers({
            offset: parsedOffset < 0 ? 0 : parsedOffset,
            limit: parsedLimit < 1 ? 10 : parsedLimit,
            fetchTotalCount: shouldFetchTotal,
            status: normalizedStatus,
        });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

// Approve organizer
router.post("/organizers/:id/approve", auth, isAdmin, async (req, res, next) => {
    try {
        const organizerId = parseInt(req.params.id);
        const result = await adminService.approveOrganizer({
            organizerId,
            adminId: req.currentUser.id,
        });
        res.status(200).json(new ApiResponse("Organizer approved successfully!", result));
    } catch (err) {
        next(err);
    }
});

// Reject organizer
router.post("/organizers/:id/reject", auth, isAdmin, async (req, res, next) => {
    try {
        const organizerId = parseInt(req.params.id);
        const {reason} = req.body;

        if (!reason || !reason.trim()) {
            return res.status(400).json(new ApiResponse("Rejection reason is required"));
        }

        const result = await adminService.rejectOrganizer({
            organizerId,
            adminId: req.currentUser.id,
            reason: reason.trim(),
        });
        res.status(200).json(new ApiResponse("Organizer rejected", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

