const router = require("express").Router();
const eventService = require("../service/event");
const ApiResponse = require("../model/ApiResponse");
const {
    auth,
    isOrganizerEventAuthor,
    isAuthenticated,
    isOrganizerVerified,
} = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { compress } = require("../middleware/compress");
const { ifAdmin } = require("../utils/common");

router.post(
    "/save",
    auth,
    upload("event"),
    compress("event"),
    async (req, res, next) => {
        try {
            const result = await eventService.save({
                payload: req.body,
                files: req.processedFiles || req.files || [],
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse("Event saved!", result));
        } catch (err) {
            next(err);
        }
    },
);

router.post(
    "/saveConfig",
    auth,
    async (req, res, next) => {
        try {
            const result = await eventService.saveConfig({
                payload: req.body,
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse("Configuration saved!", result));
        } catch (err) {
            next(err);
        }
    },
);

router.post(
    "/saveLandingConfig",
    auth,
    async (req, res, next) => {
        try {
            const result = await eventService.saveLandingConfig({
                payload: req.body,
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse("Landing configuration saved!", result));
        } catch (err) {
            next(err);
        }
    },
);


router.get("/getAllEvents", async (req, res, next) => {
    try {
        // Extract pagination parameters
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 6;
        const fetchTotalCount = req.query.fetchTotalCount === 'true';
        const offset = (page - 1) * itemsPerPage;

        const results = await eventService.getAllEvents({
            organizationId: req.query.organizationId,
            search: req.query.search || '',
            page,
            itemsPerPage,
            offset,
            fetchTotalCount,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Get only published events (for public access)
router.get("/getPublishedEvents", async (req, res, next) => {
    try {
        const results = await eventService.getPublishedEvents({
            organizationId: req.query.organizationId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Search published events across all organizations
router.get("/searchPublishedEvents", async (req, res, next) => {
    try {
        const searchTerm = req.query.searchTerm || '';
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 12;

        const results = await eventService.searchPublishedEvents({
            searchTerm,
            page,
            itemsPerPage,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Publish an event
router.post("/publishEvent", auth, isOrganizerEventAuthor, isOrganizerVerified, async (req, res, next) => {
    try {
        const result = await eventService.publishEvent({
            eventId: req.body.eventId,
            currentUser: req.currentUser,
        });
        res.status(200).json(new ApiResponse("Event published successfully!", result));
    } catch (err) {
        next(err);
    }
});

// Unpublish an event
router.post("/unpublishEvent", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const result = await eventService.unpublishEvent({
            eventId: req.body.eventId,
        });
        res.status(200).json(new ApiResponse("Event unpublished successfully!", result));
    } catch (err) {
        next(err);
    }
});

router.get("/getEvent", async (req, res, next) => {
    try {
        const results = await eventService.getEventById({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getEventBySlug", async (req, res, next) => {
    try {
        const results = await eventService.getEventBySlug({
            slug: req.query.slug,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get(
    "/getEventByEventIdnOrganizationId",
    isAuthenticated,
    async (req, res, next) => {
        try {
            const results = await eventService.getEventByEventIdnOrganizationId({
                organizationId: req.query.organizationId,
                eventId: req.query.eventId,
                currentUser: req.currentUser,
            });
            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

router.get("/removeEvent", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const results = await eventService.removeEvent({
            organizationId: req.query.organizationId,
            eventId: req.query.eventId,
            currentUser: req.currentUser,
        });
        res.status(200).json(new ApiResponse("Event deleted!", results));
    } catch (err) {
        next(err);
    }
});


router.get("/getFirstEvent", async (req, res, next) => {
    try {
        const event = await eventService.getFirstEvent();
        res.status(200).json(new ApiResponse(null, event));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
