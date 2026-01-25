const router = require("express").Router();
const organizationService = require("../service/organization");
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizationManager } = require("../middleware/auth");

router.post("/save", auth, async (req, res, next) => {
    try {
        const results = await organizationService.save({
            payload: req.body,
            currentUser: req.currentUser,
        });
        res.status(200).json(new ApiResponse("Organization saved!", results));
    } catch (err) {
        next(err);
    }
});

router.get("/getOrganization", async (req, res, next) => {
    try {
        const results = await organizationService.getOrganizationById({
            organizationId: req.query.organizationId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getOrganizationByOrganizationId", async (req, res, next) => {
    try {
        const result = await organizationService.getOrganizationById({
            organizationId: req.query.organizationId,
        });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

router.get("/getAllOrganizations", auth, async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;

        const result = await organizationService.getAllOrganizations({
            page,
            itemsPerPage,
        });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

router.get("/removeOrganization", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const result = await organizationService.deleteOrganization({
            organizationId: req.query.organizationId,
        });
        res.status(200).json(new ApiResponse("Organization deleted!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
