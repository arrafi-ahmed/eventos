const router = require("express").Router();
const sponsorshipService = require("../service/sponsorship");
const ApiResponse = require("../model/ApiResponse");
const {
    auth,
    isAuthenticated,
    isOrganizerEventAuthor,
} = require("../middleware/auth");

router.post("/create", async (req, res, next) => {
    try {
        const result = await sponsorshipService.save({
            payload: req.body,
        });
        res.status(200).json(
            new ApiResponse("Sponsorship created successfully!", {
                sponsorship: result,
            }),
        );
    } catch (err) {
        next(err);
    }
});

router.post("/createSponsorshipPaymentIntent", async (req, res, next) => {
    try {
        const result = await sponsorshipService.createSponsorshipPaymentIntent({
            packageId: req.body.packageId,
            amount: req.body.amount,
            currency: req.body.currency,
            sponsorEmail: req.body.sponsorEmail,
            eventId: req.body.eventId,
        });
        res
            .status(200)
            .json(new ApiResponse("Payment intent created successfully!", result));
    } catch (err) {
        next(err);
    }
});

router.get("/getSponsorshipsByEventId", async (req, res, next) => {
    try {
        const results = await sponsorshipService.getSponsorshipsByEventId({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getSponsorshipById", async (req, res, next) => {
    try {
        const results = await sponsorshipService.getSponsorshipById({
            sponsorshipId: req.query.sponsorshipId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getSponsorshipsBySponsorId", async (req, res, next) => {
    try {
        const results = await sponsorshipService.getSponsorshipsBySponsorId({
            sponsorId: req.query.sponsorId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
