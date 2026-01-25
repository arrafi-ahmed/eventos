const express = require("express");
const router = express.Router();
const {auth, isOrganizerEventAuthor} = require("../middleware/auth");
const formService = require("../service/form");
const ApiResponse = require("../model/ApiResponse");

router.post("/save", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const results = await formService.saveFormQuestions({
            eventId: req.body.eventId,
            questions: req.body.questions,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getFormQuestions", async (req, res, next) => {
    try {
        const results = await formService.getFormQuestions({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
