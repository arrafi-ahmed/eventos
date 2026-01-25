const router = require("express").Router();
const authService = require("../service/auth");
const ApiResponse = require("../model/ApiResponse");

router.post("/register", async (req, res, next) => {
    try {
        const result = await authService.register({payload: req.body});
        res
            .status(200)
            .set("Authorization", result.token)
            .json(
                new ApiResponse("Registration successful!", {
                    currentUser: result.currentUser,
                }),
            );
    } catch (err) {
        next(err);
    }
});

router.post("/signin", async (req, res, next) => {
    try {
        const result = await authService.signin(req.body);
        res
            .status(200)
            .set("Authorization", result.token)
            .json(
                new ApiResponse("Sign in successful!", {
                    currentUser: result.currentUser,
                }),
            );
    } catch (err) {
        next(err);
    }
});

router.post("/forgotPassword", async (req, res, next) => {
    try {
        const result = await authService.forgotPassword({payload: req.body});
        res
            .status(200)
            .json(new ApiResponse("Password reset link sent to your email!", result));
    } catch (err) {
        next(err);
    }
});

router.post("/resetPassword", async (req, res, next) => {
    try {
        const result = await authService.resetPassword({payload: req.body});
        res.status(200).json(new ApiResponse("Password reset successful!", result));
    } catch (err) {
        next(err);
    }
});

router.get("/me", require("../middleware/auth").auth, async (req, res, next) => {
    try {
        const result = await authService.getCurrentUser({currentUser: req.currentUser});
        res.status(200).json(new ApiResponse(null, {currentUser: result}));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
