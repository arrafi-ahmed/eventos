const router = require("express").Router();
const appUserService = require("../service/appUser");
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizationManager, isAdmin } = require("../middleware/auth");

router.post("/save", auth, async (req, res, next) => {
    try {
        const results = await appUserService.save({
            payload: req.body,
        });
        res.status(200).json(new ApiResponse("User saved!", results));
    } catch (err) {
        next(err);
    }
});

// Get organizers for an organization - for admins
// Only returns organizers as they are the only role that belongs to organizations
router.get("/getAppUsers", auth, isAdmin, async (req, res, next) => {
    try {
        const organizationId = req.query.organizationId;

        const results = await appUserService.getAppUsers({
            organizationId: organizationId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getUsers", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const results = await appUserService.getUsers({
            organizationId: req.currentUser.organizationId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Delete app user - for admins
router.get("/deleteAppUser", auth, isAdmin, async (req, res, next) => {
    try {
        const userId = req.query.id;
        const result = await appUserService.deleteUserById({
            userId: userId,
        });
        res.status(200).json(new ApiResponse("User deleted!", { deleted: result }));
    } catch (err) {
        next(err);
    }
});

router.get("/removeUser", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const result = await appUserService.removeUser({
            userId: req.query.userId,
            organizationId: req.currentUser.organizationId,
        });
        res.status(200).json(new ApiResponse("User removed!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
