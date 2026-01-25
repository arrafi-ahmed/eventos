const router = require("express").Router();
const {auth} = require("../middleware/auth");
const ApiResponse = require("../model/ApiResponse");
const userSettingsService = require("../service/userSettings");

router.get("/me", auth, async (req, res, next) => {
    try {
        const result = await userSettingsService.getUserSettings({
            userId: req.currentUser.id,
        });
        res
            .status(200)
            .json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

router.put("/theme", auth, async (req, res, next) => {
    try {
        const {theme} = req.body || {};
        const result = await userSettingsService.upsertTheme({
            userId: req.currentUser.id,
            theme,
        });
        res
            .status(200)
            .json(new ApiResponse("Theme updated successfully", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

