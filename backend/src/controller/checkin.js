const router = require("express").Router();
const checkinService = require("../service/checkin");
const eventService = require("../service/event");
const ApiResponse = require("../model/ApiResponse");
const { auth, isAuthorizedStaff } = require("../middleware/auth");

router.post("/save", auth, async (req, res, next) => {
    try {
        const results = await checkinService.save({
            newCheckin: { ...req.body, checkedInBy: req.currentUser.id },
        });
        res.status(200).json(new ApiResponse("Check-in saved!", results));
    } catch (err) {
        next(err);
    }
});

router.delete("/delete", auth, isAuthorizedStaff, async (req, res, next) => {
    try {
        const results = await checkinService.delete({
            attendeeId: req.body.attendeeId,
            eventId: req.body.eventId,
        });
        res
            .status(200)
            .json(new ApiResponse("Check-in deleted successfully!", results));
    } catch (err) {
        next(err);
    }
});

router.get(
    "/getStatistics",
    auth,
    isAuthorizedStaff,
    async (req, res, next) => {
        try {
            const results = await checkinService.getStatistics({
                eventId: req.query.eventId,
            });
            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/getCheckinsByEventId",
    auth,
    isAuthorizedStaff,
    async (req, res, next) => {
        try {
            const results = await checkinService.getCheckinsByEventId({
                eventId: req.query.eventId,
            });
            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

router.post(
    "/scanByRegistrationId",
    auth,
    isAuthorizedStaff,
    async (req, res, next) => {
        try {
            const result = await checkinService.scanByRegistrationId({
                ...req.body.payload,
                userId: req.currentUser.id,
            });
            res.status(200).json(new ApiResponse("Check-in successful!", result));
        } catch (err) {
            next(err);
        }
    },
);

module.exports = router;
