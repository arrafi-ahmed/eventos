const router = require("express").Router();
const orderService = require("../service/order");
const ApiResponse = require("../model/ApiResponse");
const { auth } = require("../middleware/auth");

/**
 * Attendee-specific Order Controller
 */

// Get all orders for the current logged-in user (attendee)
router.get("/my-orders", auth, async (req, res, next) => {
    try {
        const email = req.currentUser.email;
        const orders = await orderService.getOrdersByEmail(email);
        res.status(200).json(new ApiResponse(null, orders));
    } catch (error) {
        next(error);
    }
});

// Resend ticket email for a specific order
router.post("/email-ticket", auth, async (req, res, next) => {
    try {
        const { orderId } = req.body;
        const userEmail = req.currentUser.email;

        await orderService.resendOrderEmail(orderId, userEmail);

        res.status(200).json(new ApiResponse("Ticket email sent successfully!"));
    } catch (error) {
        next(error);
    }
});

module.exports = router;
