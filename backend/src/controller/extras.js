const router = require("express").Router();
const eventService = require("../service/event");
const stripeService = require("../service/stripe");
const ApiResponse = require("../model/ApiResponse");
const {
    auth,
    isAuthenticated,
    isOrganizerEventAuthor,
} = require("../middleware/auth");

// Create extras purchase and initiate payment
router.post("/purchaseExtras", async (req, res, next) => {
    try {
        const result = await stripeService.createExtrasPaymentIntentWithValidation({
            payload: req.body,
        });
        res
            .status(200)
            .json(new ApiResponse("Extras purchase initiated successfully!", result));
    } catch (err) {
        next(err);
    }
});

router.post("/save", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const results = await eventService.saveExtras({
            payload: req.body,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get(
    "/getExtrasByEventId",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            const results = await eventService.getExtrasByEventId({
                eventId: req.query.eventId,
            });
            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/getExtrasByIds",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            const results = await eventService.getExtrasByIds({
                extrasIds: req.query.extrasIds,
            });
            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

module.exports = router;
