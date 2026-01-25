const express = require("express");
const router = require("express").Router();
const stripeService = require("../service/stripe");
const ApiResponse = require("../model/ApiResponse");

// Create PaymentIntent with base amount (no shipping yet)
router.post("/create-payment-intent", async (req, res, next) => {
    try {
        const {
            amount,
            currency = 'usd',
            attendees,
            selectedTickets,
            selectedProducts,
            registration,
            shippingOption,
            eventId,
            shippingAddress
        } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json(new ApiResponse({ error: 'Invalid amount' }, null));
        }

        const result = await stripeService.createPaymentIntentWithShipping({
            amount: Math.round(amount),
            currency: currency.toLowerCase(),
            attendees,
            selectedTickets,
            selectedProducts,
            registration,
            shippingOption,
            eventId,
            shippingAddress,
            sessionId: req.body.sessionId, // Pass sessionId if provided to reuse existing entry
        });

        res.status(200).json(new ApiResponse(null, {
            clientSecret: result.clientSecret,
            paymentIntentId: result.paymentIntentId,
            sessionId: result.sessionId
        }));
    } catch (error) {
        next(error);
    }
});

// Create secure payment intent with backend validation
router.post("/create-secure-payment-intent", async (req, res, next) => {
    try {
        const result = await stripeService.createSecurePaymentIntent(req.body);

        res.status(200).json(
            new ApiResponse(null, {
                clientSecret: result.paymentIntent.client_secret,
                paymentIntentId: result.paymentIntent.id,
                totalAmount: result.totalAmount,
                sessionId: result.sessionId,
            }),
        );
    } catch (error) {
        next(error);
    }
});

// Update PaymentIntent with shipping costs
router.post("/update-payment-intent", async (req, res, next) => {
    try {
        const { paymentIntentId, baseAmount, shippingOption, sessionId, eventId, shippingAddress } = req.body;

        if (!paymentIntentId) {
            return res.status(400).json(new ApiResponse({ error: 'Missing required parameter: paymentIntentId' }, null));
        }

        const result = await stripeService.updatePaymentIntentWithShipping({
            paymentIntentId,
            baseAmount: typeof baseAmount === 'number' ? Math.round(baseAmount) : undefined,
            shippingOption,
            eventId,
            shippingAddress,
        });

        // Conditionally update temp_registration if we have a session
        if (sessionId) {
            const updatePayload = { sessionId };

            // amounts
            if (typeof baseAmount === 'number') updatePayload.baseAmount = Math.round(baseAmount);
            if (typeof result.totalAmount === 'number') updatePayload.totalAmount = result.totalAmount;
            if (typeof result.shippingCost === 'number') updatePayload.shippingCost = result.shippingCost;

            // shipping
            if (shippingAddress) updatePayload.shippingAddress = shippingAddress;
            if (shippingOption) updatePayload.shippingType = shippingOption;

            // identifiers / status (optional passthroughs from request)
            if (req.body.orderNumber) updatePayload.orderNumber = req.body.orderNumber;
            if (req.body.currency) updatePayload.currency = req.body.currency;
            if (req.body.paymentStatus) updatePayload.paymentStatus = req.body.paymentStatus;
            if (paymentIntentId) updatePayload.stripePaymentIntentId = paymentIntentId;
            if (req.body.productStatus) updatePayload.productStatus = req.body.productStatus;

            // items (optional)
            if (req.body.itemsTicket) updatePayload.itemsTicket = req.body.itemsTicket;
            if (req.body.itemsProduct) updatePayload.itemsProduct = req.body.itemsProduct;

            // explicit tax amount override
            if (typeof req.body.taxAmount === 'number') updatePayload.taxAmount = req.body.taxAmount;

            await stripeService.updateTempRegistrationOrders(updatePayload);
        }

        // Build dynamic response based on what was updated
        const payload = { clientSecret: result.clientSecret };

        // Only include fields that were actually updated/calculated
        if (typeof result.totalAmount === 'number') {
            payload.totalAmount = result.totalAmount;
        }

        if (typeof result.shippingCost === 'number' && result.shippingCost > 0) {
            payload.shippingCost = result.shippingCost;
        }

        if (typeof result.baseAmount === 'number') {
            payload.baseAmount = result.baseAmount;
        }

        if (result.taxAmount !== undefined) {
            payload.taxAmount = result.taxAmount;
        }

        if (result.shippingType) {
            payload.shippingType = result.shippingType;
        }

        res.status(200).json(new ApiResponse(null, payload));
    } catch (error) {
        next(error);
    }
});

// Apply promo code to an existing payment intent
router.post("/apply-promo", async (req, res, next) => {
    try {
        const { paymentIntentId, promoCode, sessionId, eventId } = req.body;

        if (!paymentIntentId || !promoCode || !sessionId || !eventId) {
            return res.status(400).json(new ApiResponse({ error: 'Missing required parameters' }, null));
        }

        const result = await stripeService.applyPromoCode({
            paymentIntentId,
            promoCode,
            sessionId,
            eventId
        });

        res.status(200).json(new ApiResponse("Promo code applied successfully", result));
    } catch (error) {
        next(error);
    }
});

// Check payment status and get processed registration data
router.get("/check-payment-status", async (req, res, next) => {
    try {
        const result = await stripeService.checkPaymentStatus({
            paymentIntent: req.query.paymentIntent,
        });

        res.status(200).json(new ApiResponse(null, result));
    } catch (error) {
        next(error);
    }
});

// Webhook for handling payment intent events
const webhook = async (req, res, next) => {
    stripeService
        .webhook(req)
        .then((result) => {
            res.status(200).json(new ApiResponse(result, null));
        })
        .catch((err) => next(err));
};

module.exports = { router, webhook };
