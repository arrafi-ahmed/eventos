const express = require("express");
const router = express.Router();
const PaymentDispatcher = require("../payment");
const paymentService = require("../service/payment");
const tempRegistrationService = require('../service/tempRegistration');
const eventService = require('../service/event');
const ApiResponse = require("../model/ApiResponse");

/**
 * Unified Payment Controller
 * Generic endpoints for all payment gateways.
 */

// Initiate a payment
router.post("/init", async (req, res, next) => {
    try {
        const result = await paymentService.initiatePayment(req.body);
        res.status(200).json(new ApiResponse(null, result));
    } catch (error) {
        next(error);
    }
});

// Apply a promo code to a payment
router.post("/apply-promo", async (req, res, next) => {
    try {
        const result = await paymentService.applyPromoCode(req.body);
        res.status(200).json(new ApiResponse("Promo code applied successfully", result));
    } catch (error) {
        next(error);
    }
});

// Generic Webhook Handler
// This route is "/webhook/:gateway", so "gateway" is a URL Parameter
const webhook = async (req, res, next) => {
    try {
        const { gateway } = req.params; // Get gateway name from the URL path

        // LOG CORE COMPONENTS INDIVIDUALLY (JSON.stringify doesn't work on the whole req object)
        console.log('--- [Webhook Debug Start] ---');
        console.log(`[Webhook] Gateway: ${gateway}`);
        console.log(`[Webhook] Body:`, JSON.stringify(req.body, null, 2));
        console.log(`[Webhook] Params:`, JSON.stringify(req.params, null, 2));
        console.log(`[Webhook] Query:`, JSON.stringify(req.query, null, 2));
        console.log('--- [Webhook Debug End] ---');

        let result;

        // For Orange Money, the notif_token is the primary search key
        if (gateway === 'orange_money') {
            const rawBody = req.body || {};
            const gatewayTxnId = rawBody.txnid || rawBody.order_id;
            const notifToken = rawBody.notif_token || rawBody.notifToken;
            const status = rawBody.status;

            console.log(`[Orange Money Webhook] Handling ${status} for ID: ${gatewayTxnId}`);

            if (!notifToken) {
                console.error('[Orange Money Webhook] Missing notification token in payload');
                return res.status(200).json(new ApiResponse("Missing token"));
            }

            // IDEMPOTENCY: Always check if the order exists first to prevent 404s on retries
            if (gatewayTxnId) {
                const existingOrder = await paymentService.getOrderByGatewayTransactionId(gatewayTxnId);
                if (existingOrder) {
                    console.log(`[Orange Money Webhook] Order ${gatewayTxnId} already finalized. Handled.`);
                    return res.status(200).json(new ApiResponse("Already processed"));
                }
            }

            // FIND SESSION: Use the notification token to find the draft booking
            console.log(`[Orange Money Webhook] Searching for draft with token: ${notifToken}...`);
            const sessionData = await tempRegistrationService.getTempRegistrationByOmNotifToken(notifToken);

            if (!sessionData) {
                console.warn(`[Orange Money Webhook] Session not found for token: ${notifToken}. Handled.`);
                return res.status(200).json(new ApiResponse("Session not found or already processed"));
            }

            console.log(`[Orange Money Webhook] Linked to Session: ${sessionData.sessionId}`);

            const orders = sessionData.orders || {};
            const storedNotifToken = orders.omNotifToken || orders.om_notif_token;

            result = await PaymentDispatcher.handleWebhook(gateway, req.body, req.headers, storedNotifToken);

            // Preserve our internal sessionId for the success page lookup
            if (result.status === 'paid') {
                result.metadata = {
                    ...result.metadata,
                    sessionId: sessionData.sessionId
                };
            }
        } else {
            // Stripe or other gateways
            result = await PaymentDispatcher.handleWebhook(gateway, req.body, req.headers);
        }

        if (result.status === 'paid') {
            console.log(`[Payment Webhook] Finalizing ${gateway} transaction: ${result.transactionId}`);

            await paymentService.finalizePayment({
                ...result,
                gateway
            });
        }

        res.status(200).json(new ApiResponse("Processed"));
    } catch (error) {
        console.error(`Webhook Error [${req.params.gateway}]:`, error);
        res.status(200).json(new ApiResponse("Logged"));
    }
};

router.post("/webhook/:gateway", webhook);

// Manual Verification / Check Status
router.get("/verify/:gateway/:transactionId", async (req, res, next) => {
    try {
        const { gateway, transactionId } = req.params;
        console.log(`[Payment Verify] Checking ${gateway} txn: ${transactionId}`);

        // NEW STRATEGY: Resolve session data FIRST to get amount and payToken
        // We check the ORDERS table first, because the webhook handling deletes the tempDraft after success.
        let sessionData = null;
        let sessionId = null;
        let eventSlug = null;
        try {
            // Check if order already finalized
            const existingOrder = await paymentService.getOrderByGatewayTransactionId(transactionId);
            if (existingOrder) {
                console.log(`[Payment Verify] Found finalized order for ID: ${transactionId}`);
                sessionId = transactionId; // Original sessionId
                const event = await eventService.getEventById({ eventId: existingOrder.eventId });
                eventSlug = event?.slug;

                // Map order data to a compatible format for the verify call
                sessionData = {
                    sessionId: sessionId,
                    orders: {
                        totalAmount: existingOrder.totalAmount,
                        omPayToken: existingOrder.gatewayMetadata?.omPayToken || existingOrder.gatewayMetadata?.pay_token
                    }
                };
            }
        } catch (e) {
            console.warn(`[Payment Verify] Order check failed:`, e.message);
        }

        // If not in orders yet, fallback to tempDrafts (race condition where redirect beats webhook)
        if (!sessionData) {
            try {
                sessionData = await tempRegistrationService.getTempRegistration(transactionId);
            } catch (e) {
                try {
                    sessionData = await tempRegistrationService.getTempRegistrationByOmTransactionId(transactionId);
                } catch (ee) {
                    // Both failed, session might be missing or expired
                }
            }
        }

        if (sessionData && !eventSlug) {
            sessionId = sessionData.sessionId;
            const event = await eventService.getEventById({ eventId: sessionData.eventId });
            eventSlug = event?.slug;
        }

        // Now call verification with all required data to prevent "Missing body field"
        const result = await PaymentDispatcher.verifyPayment(gateway, transactionId, {
            amount: sessionData?.orders?.totalAmount,
            payToken: sessionData?.orders?.omPayToken
        });

        // If paid, finalize it
        if (result.status === 'paid') {
            console.log(`[Payment Verify] Transaction ${transactionId} confirmed as PAID`);

            await paymentService.finalizePayment({
                ...result,
                gateway,
                metadata: {
                    ...result.metadata,
                    sessionId: sessionId || result.metadata?.sessionId
                }
            });
        } else {
            console.log(`[Payment Verify] Transaction ${transactionId} status: ${result.status}`);
        }

        res.status(200).json(new ApiResponse(null, {
            ...result,
            sessionId,
            eventSlug
        }));
    } catch (error) {
        next(error);
    }
});

// Check session status
router.get("/status/:sessionId", async (req, res, next) => {
    try {
        const { sessionId } = req.params;
        const result = await paymentService.checkStatusBySession(sessionId);
        res.status(200).json(new ApiResponse(null, result));
    } catch (error) {
        next(error);
    }
});

module.exports = { router, webhook };
