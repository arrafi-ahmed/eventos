const router = require("express").Router();
const tempRegistrationService = require("../service/tempRegistration");
const ApiResponse = require("../model/ApiResponse");
const {auth, isOrganizerEventAuthor} = require("../middleware/auth");
const CustomError = require("../model/CustomError");

// Store temporary registration data
router.post("/store", async (req, res, next) => {
    try {
        const result = await tempRegistrationService.storeTempRegistration(
            req.body,
        );

        res
            .status(200)
            .json(
                new ApiResponse("Temporary registration data stored successfully", {
                    success: result,
                }),
            );
    } catch (error) {
        next(error);
    }
});

// Retrieve temporary registration data by session ID
router.get("/get/:sessionId", async (req, res, next) => {
    try {
        const tempRegistration = await tempRegistrationService.getTempRegistration(
            req.params.sessionId,
        );

        res
            .status(200)
            .json(
                new ApiResponse(
                    "Temporary registration data retrieved successfully",
                    tempRegistration,
                ),
            );
    } catch (error) {
        next(error);
    }
});

// Update session activity (extend expiration)
router.put("/extend/:sessionId", async (req, res, next) => {
    try {
        // Extend the session using the dedicated service function
        const result = await tempRegistrationService.updateSessionActivity(
            req.params.sessionId,
            req.body.extendHours || 24,
        );

        res
            .status(200)
            .json(new ApiResponse("Session extended successfully", result));
    } catch (error) {
        next(error);
    }
});

// Get session status (check if valid without returning full data)
router.get("/status/:sessionId", async (req, res, next) => {
    try {
        const sessionStatus = await tempRegistrationService.getSessionStatus(
            req.params.sessionId,
        );

        res
            .status(200)
            .json(
                new ApiResponse(
                    sessionStatus.valid
                        ? "Session is valid"
                        : "Session not found or expired",
                    sessionStatus,
                ),
            );
    } catch (error) {
        next(error);
    }
});

// Get temporary registration data by session ID (for success page)
router.get("/success/:sessionId", async (req, res, next) => {
    try {
        const {sessionId} = req.params;

        if (!sessionId) {
            throw new CustomError("Session ID is required", 400);
        }

        const tempRegistration =
            await tempRegistrationService.getTempRegistrationWAttendees(sessionId);

        res
            .status(200)
            .json(
                new ApiResponse(
                    "Temporary registration data retrieved successfully",
                    tempRegistration,
                ),
            );
    } catch (error) {
        next(error);
    }
});

module.exports = router;
