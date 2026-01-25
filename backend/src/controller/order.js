const router = require("express").Router();
const orderService = require("../service/order");
const ApiResponse = require("../model/ApiResponse");
const {auth, isAuthenticated} = require("../middleware/auth");


// Get order by ID
router.get("/getOrderById", async (req, res, next) => {
    try {
        const results = await orderService.getOrderById({
            orderId: req.query.orderId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Get order with items
router.get("/getOrderWithItems", async (req, res, next) => {
    try {
        const results = await orderService.getOrderWithItems({
            orderId: req.query.orderId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Get orders by event ID (requires auth)
router.get("/getOrdersByEventId", auth, async (req, res, next) => {
    try {
        const results = await orderService.getOrdersByEventId({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Update payment status (webhook)
router.post("/updatePaymentStatus", async (req, res, next) => {
    try {
        const result = await orderService.updatePaymentStatusWithStockUpdate({
            orderId: req.body.orderId,
            paymentStatus: req.body.paymentStatus,
            stripePaymentIntentId: req.body.stripePaymentIntentId,
        });
        res
            .status(200)
            .json(new ApiResponse("Payment status updated successfully!", result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
