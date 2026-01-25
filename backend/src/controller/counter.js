const router = require("express").Router();
const cashSessionService = require("../service/cashSession");
const registrationService = require("../service/registration");
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizationManager } = require("../middleware/auth");
const CustomError = require("../model/CustomError");

// Start a cash session
router.post("/startSession", auth, async (req, res, next) => {
    try {
        // Only cashiers (50) and organizers (30) can start sessions
        if (req.currentUser.role !== 30 && req.currentUser.role !== 50) {
            throw new CustomError("Unauthorized to start a cash session", 403);
        }

        const result = await cashSessionService.startSession({
            cashierId: req.currentUser.id,
            eventId: req.body.eventId,
            organizationId: req.currentUser.organizationId,
            ticketCounterId: req.body.ticketCounterId,
            openingCash: req.body.openingCash,
            timezone: req.body.timezone,
        });
        res.status(200).json(new ApiResponse("Session started successfully", result));
    } catch (err) {
        next(err);
    }
});

// Close a cash session
router.post("/closeSession", auth, async (req, res, next) => {
    try {
        const result = await cashSessionService.closeSession({
            sessionId: req.body.sessionId,
            closingCash: req.body.closingCash,
            notes: req.body.notes,
        });
        res.status(200).json(new ApiResponse("Session closed successfully", result));
    } catch (err) {
        next(err);
    }
});

// Get active session for current user
router.get("/activeSession", auth, async (req, res, next) => {
    try {
        const result = await cashSessionService.getActiveSessionByCashierId({
            cashierId: req.currentUser.id,
        });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

// Process a counter sale
router.post("/processSale", auth, async (req, res, next) => {
    try {
        const result = await registrationService.completeCounterSale({
            payload: req.body,
            currentUser: req.currentUser
        });

        res.status(200).json(new ApiResponse("Sale processed successfully", result));
    } catch (err) {
        next(err);
    }
});

// Get session statistics
router.get("/sessionStats", auth, async (req, res, next) => {
    try {
        const result = await cashSessionService.getSessionStats({
            sessionId: req.query.sessionId,
        });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

// Get session report
router.get("/sessionReport/:sessionId", auth, async (req, res, next) => {
    try {
        const result = await cashSessionService.getSessionReport({
            sessionId: req.params.sessionId,
        });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

// Download session report as PDF
router.get("/downloadSessionReport/:sessionId", auth, async (req, res, next) => {
    try {
        const pdfService = require("../service/pdf");

        const reportData = await cashSessionService.getSessionReport({
            sessionId: req.params.sessionId,
        });

        const pdfBuffer = await pdfService.generateSessionReport({ reportData });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="session-report-${req.params.sessionId}.pdf"`);
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
});

// Get sale tickets for display/print
router.get("/saleTickets/:registrationId", auth, async (req, res, next) => {
    try {
        const attendeesService = require("../service/attendees");
        const eventService = require("../service/event");
        const registrationService = require("../service/registration");

        const registration = await registrationService.getRegistrationById({
            registrationId: req.params.registrationId
        });

        if (!registration) {
            throw new CustomError("Registration not found", 404);
        }

        const attendees = await attendeesService.getAttendeesByRegistrationId({
            registrationId: req.params.registrationId
        });

        const event = await eventService.getEventById({
            eventId: registration.eventId
        });

        res.status(200).json(new ApiResponse(null, {
            registration,
            attendees,
            event
        }));
    } catch (err) {
        next(err);
    }
});

// Get all sessions (filtered)
router.get("/sessions", auth, async (req, res, next) => {
    try {
        const filters = {
            organizationId: req.currentUser.organizationId,
        };

        // If cashier, only show their sessions
        if (req.currentUser.role === 50) {
            filters.cashierId = req.currentUser.id;
        }

        // Optional query filters
        if (req.query.eventId) filters.eventId = req.query.eventId;
        if (req.query.status) filters.status = req.query.status;

        const result = await cashSessionService.getSessions(filters);
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
