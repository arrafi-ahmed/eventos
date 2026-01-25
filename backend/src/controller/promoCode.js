const router = require("express").Router();
const promoCodeService = require("../service/promoCode");
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizationManager } = require("../middleware/auth");
const CustomError = require("../model/CustomError");

router.post("/save", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const { eventId } = req.body;

        // Only Admins (role 20) can create global promo codes (no eventId)
        if (!eventId && req.currentUser.role !== 20) {
            throw new CustomError("Only administrators can create global promo codes", 403);
        }

        const result = await promoCodeService.save({
            payload: req.body,
        });
        res.status(200).json(new ApiResponse("Promo Code saved!", result));
    } catch (err) {
        next(err);
    }
});

router.get("/getPromoCodes", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const organizationId = req.query.organizationId || req.currentUser.organizationId;
        const results = await promoCodeService.getPromoCodesByOrganizationId({
            organizationId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/delete", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const result = await promoCodeService.deletePromoCode({
            id: req.query.id,
            organizationId: req.currentUser.organizationId,
        });
        res.status(200).json(new ApiResponse("Promo Code deleted!", result));
    } catch (err) {
        next(err);
    }
});

router.get("/validate", async (req, res, next) => {
    try {
        const result = await promoCodeService.validatePromoCode({
            code: req.query.code,
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse("Promo Code valid!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
