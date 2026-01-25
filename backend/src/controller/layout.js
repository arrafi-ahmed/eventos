const router = require("express").Router();
const layoutService = require("../service/layout");
const ApiResponse = require("../model/ApiResponse");

// Get all layout data in a single call (public endpoint)
router.get("/", async (req, res, next) => {
    try {
        const layoutData = await layoutService.getAllLayoutData();
        res.status(200).json(new ApiResponse(null, layoutData));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

