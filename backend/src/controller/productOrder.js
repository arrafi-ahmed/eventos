const ApiResponse = require("../model/ApiResponse");
const CustomError = require("../model/CustomError");
const productOrderService = require("../service/productOrder");

const express = require("express");
const router = express.Router();

// Get product orders for an event with pagination
router.get("/getEventProductOrders", async (req, res, next) => {
    try {
        const {eventId, page = 1, limit = 10, searchKeyword = '', fetchTotalCount = false} = req.query;

        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        const result = await productOrderService.getEventProductOrders({
            eventId: parseInt(eventId),
            page: parseInt(page),
            limit: parseInt(limit),
            searchKeyword,
            fetchTotalCount: fetchTotalCount === 'true' || fetchTotalCount === true,
        });

        res.status(200).json(
            new ApiResponse(null, result)
        );
    } catch (error) {
        next(error);
    }
});

// Get product order details by order ID
router.get("/getProductOrderDetails/:orderId", async (req, res, next) => {
    try {
        const {orderId} = req.params;

        if (!orderId) {
            throw new CustomError("Order ID is required", 400);
        }

        const result = await productOrderService.getProductOrderDetails({
            orderId: parseInt(orderId),
        });

        res.status(200).json(
            new ApiResponse(null, result)
        );
    } catch (error) {
        next(error);
    }
});

// Update product order status
router.put("/updateProductOrderStatus", async (req, res, next) => {
    try {
        const {orderId, productStatus} = req.body;

        if (!orderId) {
            throw new CustomError("Order ID is required", 400);
        }

        if (!productStatus) {
            throw new CustomError("Product status is required", 400);
        }

        const result = await productOrderService.updateProductOrderStatus({
            orderId: parseInt(orderId),
            productStatus,
        });

        res.status(200).json(
            new ApiResponse("Product order status updated successfully", result)
        );
    } catch (error) {
        next(error);
    }
});

module.exports = router;
