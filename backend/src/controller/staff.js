const router = require("express").Router();
const eventStaffService = require("../service/eventStaff");
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizerEventAuthor } = require("../middleware/auth");

router.post("/assign", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const result = await eventStaffService.assignStaff({
            eventId: req.body.eventId,
            userId: req.body.userId,
            role: req.body.role,
            organizationId: req.currentUser.organizationId,
        });
        res.status(200).json(new ApiResponse("Staff assigned successfully!", result));
    } catch (err) {
        next(err);
    }
});

router.post("/create-and-assign", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const result = await eventStaffService.createAndAssignStaff({
            email: req.body.email,
            password: req.body.password,
            fullName: req.body.fullName,
            role: req.body.role,
            eventId: req.body.eventId,
            organizationId: req.currentUser.organizationId,
        });
        res.status(200).json(new ApiResponse("Staff created and assigned successfully!", result));
    } catch (err) {
        next(err);
    }
});

router.post("/update", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const result = await eventStaffService.updateStaff({
            eventId: req.body.eventId,
            userId: req.body.userId,
            fullName: req.body.fullName,
            email: req.body.email,
            role: req.body.role,
        });
        res.status(200).json(new ApiResponse("Staff updated successfully!", result));
    } catch (err) {
        next(err);
    }
});

router.post("/remove", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const result = await eventStaffService.removeStaff({
            eventId: req.body.eventId,
            userId: req.body.userId,
            role: req.body.role,
        });
        res.status(200).json(new ApiResponse("Staff removed successfully!", result));
    } catch (err) {
        next(err);
    }
});

router.get("/getStaff", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const results = await eventStaffService.getStaffByEventId({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getAssignedEvents", auth, async (req, res, next) => {
    try {
        const results = await eventStaffService.getEventsByStaffId({
            userId: req.currentUser.id,
            role: req.query.role,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
