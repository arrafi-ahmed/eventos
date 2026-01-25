const router = require("express").Router();
const ticketCounterService = require("../service/ticketCounter");
const ApiResponse = require("../model/ApiResponse");
const { auth, isAdmin, isOrganizationManager, isOrganizationMember } = require("../middleware/auth");

router.post("/save", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const result = await ticketCounterService.save({
            payload: req.body,
        });
        res.status(200).json(new ApiResponse("Ticket Counter saved!", result));
    } catch (err) {
        next(err);
    }
});

router.get("/", auth, isOrganizationMember, async (req, res, next) => {
    try {
        const organizationId = req.query.organizationId || req.currentUser.organizationId;
        const results = await ticketCounterService.getTicketCountersByOrganizationId({
            organizationId,
            search: req.query.search || '',
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getTicketCounters", auth, isOrganizationMember, async (req, res, next) => {
    try {
        const organizationId = req.query.organizationId || req.currentUser.organizationId;
        const results = await ticketCounterService.getTicketCountersByOrganizationId({
            organizationId,
            search: req.query.search || '',
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/delete", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const result = await ticketCounterService.deleteTicketCounter({
            id: req.query.id,
            organizationId: req.currentUser.organizationId,
        });
        res.status(200).json(new ApiResponse("Ticket Counter deleted!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
