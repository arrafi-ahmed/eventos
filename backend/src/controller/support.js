const express = require("express");
const router = express.Router();
const supportService = require("../service/support");
const ApiResponse = require("../model/ApiResponse");
const CustomError = require("../model/CustomError");
const {auth} = require("../middleware/auth");
const {query} = require("../db");

// ============================================
// MAIN CHAT ENDPOINT
// ============================================

/**
 * POST /support/chat
 * Main chat endpoint - handles user messages with LLM parsing
 */
router.post("/chat", async (req, res, next) => {
    try {
        const {sessionId, message, context = {}} = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json(
                new ApiResponse("Message is required", null)
            );
        }

        // Get user context if authenticated
        const userContext = {
            userId: req.currentUser?.id || null,
            userEmail: req.currentUser?.email || context.userEmail || null
        };

        const result = await supportService.handleChatMessage({
            sessionId,
            message: message.trim(),
            context: userContext
        });

        res.status(200).json(new ApiResponse("Message processed", result));
    } catch (err) {
        next(err);
    }
});

// ============================================
// INTENT-SPECIFIC ENDPOINTS
// ============================================

/**
 * POST /support/resend-ticket
 * Resend ticket email
 */
router.post("/resend-ticket", async (req, res, next) => {
    try {
        const {email, orderNumber, newEmail} = req.body;

        // Use authenticated user email if available
        const userEmail = req.currentUser?.email || email;

        if (!userEmail) {
            return res.status(400).json(
                new ApiResponse("Email is required", null)
            );
        }

        const result = await supportService.handleResendTicket({
            email: userEmail,
            orderNumber,
            newEmail
        });

        res.status(200).json(new ApiResponse("Tickets resent successfully", result));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/check-payment-status
 * Check order payment status
 */
router.post("/check-payment-status", async (req, res, next) => {
    try {
        const {email, orderNumber} = req.body;
        const userEmail = req.currentUser?.email || email;

        if (!userEmail || !orderNumber) {
            return res.status(400).json(
                new ApiResponse("Email and orderNumber are required", null)
            );
        }

        const result = await supportService.handleCheckPaymentStatus({
            email: userEmail,
            orderNumber
        });

        res.status(200).json(new ApiResponse("Payment status retrieved", result));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/check-checkin-status
 * Check check-in status and QR code information
 */
router.post("/check-checkin-status", async (req, res, next) => {
    try {
        const {email, orderNumber} = req.body;
        const userEmail = req.currentUser?.email || email;

        if (!userEmail || !orderNumber) {
            return res.status(400).json(
                new ApiResponse("Email and orderNumber are required", null)
            );
        }

        const result = await supportService.handleCheckCheckinStatus({
            email: userEmail,
            orderNumber
        });

        res.status(200).json(new ApiResponse("Check-in status retrieved", result));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/track-shipment
 * Track physical product shipments
 */
router.post("/track-shipment", async (req, res, next) => {
    try {
        const {email, orderNumber} = req.body;
        const userEmail = req.currentUser?.email || email;

        if (!userEmail || !orderNumber) {
            return res.status(400).json(
                new ApiResponse("Email and orderNumber are required", null)
            );
        }

        const result = await supportService.handleTrackShipment({
            email: userEmail,
            orderNumber
        });

        res.status(200).json(new ApiResponse("Shipment tracking retrieved", result));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/update-shipping-address
 * Update product order shipping address (requires OTP if order processing)
 */
router.post("/update-shipping-address", async (req, res, next) => {
    try {
        const {orderNumber, newAddress} = req.body;

        if (!orderNumber || !newAddress) {
            return res.status(400).json(
                new ApiResponse("orderNumber and newAddress are required", null)
            );
        }

        const order = await supportService.findOrderByNumber({orderNumber});

        if (!order) {
            return res.status(404).json(
                new ApiResponse("Order not found", null)
            );
        }

        // Check if OTP required (order already processing/shipped)
        if (order.productStatus === 'processing' || order.productStatus === 'shipped') {
            // Create support request
            const supportRequest = await supportService.createSupportRequest({
                sessionId: req.body.sessionId || null,
                orderId: order.id,
                intentType: 'update_shipping_address',
                userEmail: req.currentUser?.email || null,
                userInput: {orderNumber, newAddress}
            });

            // Generate OTP
            const email = req.currentUser?.email || order.shippingAddress?.email || null;
            if (!email) {
                return res.status(400).json(
                    new ApiResponse("Email is required for OTP verification", null)
                );
            }

            const otp = await supportService.generateOTP({
                email,
                purpose: 'update_shipping_address',
                supportRequestId: supportRequest.id
            });

            // TODO: Send OTP via email

            return res.status(200).json(new ApiResponse("OTP sent to email", {
                requiresOTP: true,
                otpSentTo: email,
                supportRequestId: supportRequest.id,
                expiresIn: 900
            }));
        }

        // No OTP required, update directly
        const result = await supportService.handleUpdateShippingAddress({
            orderNumber,
            newAddress
        });

        res.status(200).json(new ApiResponse("Shipping address updated", result));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/update-attendee-info
 * Modify attendee details (requires OTP)
 */
router.post("/update-attendee-info", async (req, res, next) => {
    try {
        const {orderNumber, attendeeId, fieldToUpdate, newValue} = req.body;

        if (!orderNumber || !attendeeId || !fieldToUpdate || !newValue) {
            return res.status(400).json(
                new ApiResponse("orderNumber, attendeeId, fieldToUpdate, and newValue are required", null)
            );
        }

        const order = await supportService.findOrderByNumber({orderNumber});

        if (!order) {
            return res.status(404).json(
                new ApiResponse("Order not found", null)
            );
        }

        // Get attendee email for OTP
        const attendeeResult = await query(
            `SELECT email FROM attendees WHERE id = $1 AND registration_id = $2`,
            [attendeeId, order.registrationId]
        );

        if (attendeeResult.rows.length === 0) {
            return res.status(404).json(
                new ApiResponse("Attendee not found", null)
            );
        }

        const email = attendeeResult.rows[0].email;

        // Create support request
        const supportRequest = await supportService.createSupportRequest({
            sessionId: req.body.sessionId || null,
            orderId: order.id,
            intentType: 'update_attendee_info',
            userEmail: email,
            userInput: {orderNumber, attendeeId, fieldToUpdate, newValue}
        });

        // Generate OTP
        const otp = await supportService.generateOTP({
            email,
            purpose: 'update_attendee_info',
            supportRequestId: supportRequest.id
        });

        // TODO: Send OTP via email

        res.status(200).json(new ApiResponse("OTP sent to email", {
            requiresOTP: true,
            otpSentTo: email,
            supportRequestId: supportRequest.id,
            expiresIn: 900
        }));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/view-order-details
 * Get complete information about an order
 */
router.post("/view-order-details", async (req, res, next) => {
    try {
        const {email, orderNumber} = req.body;
        const userEmail = req.currentUser?.email || email;

        if (!userEmail || !orderNumber) {
            return res.status(400).json(
                new ApiResponse("Email and orderNumber are required", null)
            );
        }

        const result = await supportService.handleViewOrderDetails({
            email: userEmail,
            orderNumber
        });

        res.status(200).json(new ApiResponse("Order details retrieved", result));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/check-event-details
 * Get comprehensive information about an event
 */
router.post("/check-event-details", async (req, res, next) => {
    try {
        const {eventSlug, orderNumber} = req.body;

        if (!eventSlug && !orderNumber) {
            return res.status(400).json(
                new ApiResponse("Either eventSlug or orderNumber is required", null)
            );
        }

        const result = await supportService.handleCheckEventDetails({
            eventSlug,
            orderNumber
        });

        res.status(200).json(new ApiResponse("Event details retrieved", result));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/contact-us
 * Send a message directly to support team
 */
router.post("/contact-us", async (req, res, next) => {
    try {
        const {email, message, orderNumber} = req.body;
        const userEmail = req.currentUser?.email || email;

        if (!userEmail || !message) {
            return res.status(400).json(
                new ApiResponse("Email and message are required", null)
            );
        }

        const result = await supportService.handleContactUs({
            email: userEmail,
            message,
            orderNumber
        });

        res.status(200).json(new ApiResponse("Message sent to support team", result));
    } catch (err) {
        next(err);
    }
});

// ============================================
// OTP ENDPOINTS
// ============================================

/**
 * POST /support/request-otp
 * Request OTP for sensitive operation
 */
router.post("/request-otp", async (req, res, next) => {
    try {
        const {email, purpose, supportRequestId} = req.body;

        if (!email || !purpose) {
            return res.status(400).json(
                new ApiResponse("Email and purpose are required", null)
            );
        }

        const otp = await supportService.generateOTP({
            email,
            purpose,
            supportRequestId
        });

        // TODO: Send OTP via email

        res.status(200).json(new ApiResponse("OTP sent to email", {
            success: true,
            expiresIn: 900
        }));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/verify-otp
 * Verify OTP and execute action
 */
router.post("/verify-otp", async (req, res, next) => {
    try {
        const {email, purpose, code, supportRequestId} = req.body;

        if (!email || !purpose || !code) {
            return res.status(400).json(
                new ApiResponse("Email, purpose, and code are required", null)
            );
        }

        // Verify OTP
        await supportService.verifyOTP({email, purpose, code});

        // Get support request to execute action
        if (supportRequestId) {
            const requestResult = await query(
                `SELECT * FROM support_requests WHERE id = $1`,
                [supportRequestId]
            );

            if (requestResult.rows.length > 0) {
                const request = requestResult.rows[0];
                const userInput = request.userInput;

                // Execute the intended action based on intent type
                let result;
                switch (request.intentType) {
                    case 'update_shipping_address':
                        result = await supportService.handleUpdateShippingAddress({
                            orderNumber: userInput.orderNumber,
                            newAddress: userInput.newAddress
                        });
                        break;
                    case 'update_attendee_info':
                        result = await supportService.handleUpdateAttendeeInfo({
                            orderNumber: userInput.orderNumber,
                            attendeeId: userInput.attendeeId,
                            fieldToUpdate: userInput.fieldToUpdate,
                            newValue: userInput.newValue
                        });
                        break;
                    default:
                        throw new CustomError("Unknown intent type", 400);
                }

                // Update support request
                await supportService.updateSupportRequest({
                    requestId: supportRequestId,
                    status: 'resolved',
                    actionResult: result
                });

                return res.status(200).json(new ApiResponse("Action completed successfully", result));
            }
        }

        res.status(200).json(new ApiResponse("OTP verified successfully", {success: true}));
    } catch (err) {
        next(err);
    }
});

/**
 * POST /support/resend-otp
 * Resend OTP code
 */
router.post("/resend-otp", async (req, res, next) => {
    try {
        const {email, purpose, supportRequestId} = req.body;

        if (!email || !purpose) {
            return res.status(400).json(
                new ApiResponse("Email and purpose are required", null)
            );
        }

        const otp = await supportService.generateOTP({
            email,
            purpose,
            supportRequestId
        });

        // TODO: Send OTP via email

        res.status(200).json(new ApiResponse("New OTP sent to email", {
            success: true,
            expiresIn: 900
        }));
    } catch (err) {
        next(err);
    }
});

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * GET /support/session/:sessionId
 * Get session details and history
 */
router.get("/session/:sessionId", async (req, res, next) => {
    try {
        const {sessionId} = req.params;

        const sessionResult = await query(
            `SELECT * FROM support_sessions WHERE session_id = $1`,
            [sessionId]
        );

        if (sessionResult.rows.length === 0) {
            return res.status(404).json(
                new ApiResponse("Session not found", null)
            );
        }

        const messages = await supportService.getSessionHistory({
            sessionId,
            limit: 50
        });

        res.status(200).json(new ApiResponse("Session retrieved", {
            session: sessionResult.rows[0],
            messages
        }));
    } catch (err) {
        next(err);
    }
});

/**
 * DELETE /support/session/:sessionId
 * End session
 */
router.delete("/session/:sessionId", async (req, res, next) => {
    try {
        const {sessionId} = req.params;

        await query(
            `UPDATE support_sessions SET status = 'resolved' WHERE session_id = $1`,
            [sessionId]
        );

        res.status(200).json(new ApiResponse("Session ended", {success: true}));
    } catch (err) {
        next(err);
    }
});

module.exports = router;

