const router = require("express").Router();
const ticketService = require("../service/ticket");
const ApiResponse = require("../model/ApiResponse");
const {
    auth,
    isAuthenticated,
    isOrganizerEventAuthor,
} = require("../middleware/auth");

// Get tickets by event ID (public access for viewing)
router.get("/getTicketsByEventId", async (req, res, next) => {
    try {
        const results = await ticketService.getTicketsByEventId({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Get ticket by ID (public access for viewing)
router.get("/getTicketById", async (req, res, next) => {
    try {
        const results = await ticketService.getTicketById({
            ticketId: req.query.ticketId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Save ticket (requires auth)
router.post("/save", auth, async (req, res, next) => {
    try {
        const results = await ticketService.save({
            payload: req.body,
            currentUser: req.currentUser,
        });
        res
            .status(200)
            .json(new ApiResponse("Ticket saved successfully!", results));
    } catch (err) {
        next(err);
    }
});

// Remove ticket (requires auth)
router.delete("/removeTicket", auth, async (req, res, next) => {
    try {
        const results = await ticketService.removeTicket({
            ticketId: req.body.ticketId,
            eventId: req.body.eventId,
        });
        res
            .status(200)
            .json(new ApiResponse("Ticket removed successfully!", results));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
