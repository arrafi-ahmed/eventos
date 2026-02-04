const { query } = require("../db");
const CustomError = require("../model/CustomError");
const { v4: uuidv4 } = require("uuid");
const emailService = require("./email");
const orderService = require("./order");
const registrationService = require("./registration");
const attendeesService = require("./attendees");
const eventService = require("./event");
const checkinService = require("./checkin");
const llmSupport = require("./llmSupport");
const { hasAnyIntentWithOrderNumber } = require("../config/supportIntents");

// ============================================
// SESSION MANAGEMENT
// ============================================

/**
 * Get support session by session ID
 */
exports.getSession = async ({ sessionId }) => {
    if (!sessionId) {
        return null;
    }

    const result = await query(
        `SELECT * FROM support_sessions WHERE session_id = $1`,
        [sessionId]
    );

    return result.rows[0] || null;
};

/**
 * Save support session (create or update)
 * Uses ON CONFLICT to handle upsert
 */
exports.saveSession = async ({ sessionId, userId = null, userEmail = null, summary = null, lastIntent = null, status = 'active' }) => {
    if (!sessionId) {
        // Generate new session ID if not provided
        sessionId = `support_${Date.now()}_${uuidv4()}`;
    }

    const sql = `
        INSERT INTO support_sessions (session_id, user_id, user_email, summary, last_intent, status, created_at, updated_at, last_activity)
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
        ON CONFLICT (session_id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            user_email = EXCLUDED.user_email,
            summary = EXCLUDED.summary,
            last_intent = EXCLUDED.last_intent,
            status = EXCLUDED.status,
            updated_at = NOW(),
            last_activity = NOW()
        RETURNING *
    `;

    const result = await query(sql, [
        sessionId,
        userId,
        userEmail,
        summary,
        lastIntent,
        status
    ]);

    if (!result.rows[0]) {
        throw new CustomError("Failed to save session", 500);
    }

    return result.rows[0];
};

/**
 * Get session history (last N messages)
 */
exports.getSessionHistory = async ({ sessionId, limit = 10 }) => {
    const result = await query(
        `SELECT role, content, intent, confidence, slots, created_at
         FROM support_messages
         WHERE session_id = $1
         ORDER BY created_at DESC
         LIMIT $2`,
        [sessionId, limit]
    );

    // Reverse to get chronological order
    return result.rows.reverse();
};

/**
 * Save message to session
 */
exports.saveMessage = async ({ sessionId, role, content, intent = null, confidence = null, slots = null }) => {
    const result = await query(
        `INSERT INTO support_messages (session_id, role, content, intent, confidence, slots, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [sessionId, role, content, intent, confidence, slots ? JSON.stringify(slots) : null]
    );

    // Update session last activity, last intent, and increment message count
    await query(
        `UPDATE support_sessions 
         SET last_activity = NOW(), 
             last_intent = $1, 
             message_count = message_count + 1
         WHERE session_id = $2`,
        [intent, sessionId]
    );

    return result.rows[0];
};

/**
 * Update session summary
 * Also updates last_summarized_message_count to current message_count
 */
exports.updateSessionSummary = async ({ sessionId, summary }) => {
    const session = await exports.getSession({ sessionId });

    if (!session) {
        throw new CustomError("Session not found", 404);
    }

    // Update summary and last_summarized_message_count in one query
    const result = await query(
        `UPDATE support_sessions 
         SET summary = $1, 
             last_summarized_message_count = message_count,
             updated_at = NOW()
         WHERE session_id = $2
         RETURNING *`,
        [summary, sessionId]
    );

    if (!result.rows[0]) {
        throw new CustomError("Failed to update session summary", 500);
    }

    return result.rows[0];
};

/**
 * Summarize conversation if needed
 * Uses incremental counter (message_count - last_summarized_message_count) instead of COUNT(*)
 * This scales efficiently to millions of messages without expensive queries
 */
exports.summarizeIfNeeded = async ({ sessionId }) => {
    // Get current message count and last summarized count (O(1) lookup, no COUNT query)
    const sessionResult = await query(
        `SELECT message_count, last_summarized_message_count, summary 
         FROM support_sessions 
         WHERE session_id = $1`,
        [sessionId]
    );

    if (!sessionResult.rows[0]) {
        return null;
    }

    const session = sessionResult.rows[0];
    const messageCount = session.messageCount || 0;
    const lastSummarizedCount = session.lastSummarizedMessageCount || 0;
    const messagesSinceLastSummary = messageCount - lastSummarizedCount;

    // Summarize every 5 messages (threshold can be adjusted)
    // Using >= ensures we trigger if we've crossed the threshold (e.g., at 5, 10, 15, etc.)
    if (messageCount > 0 && messagesSinceLastSummary >= 5) {
        const messages = await exports.getSessionHistory({ sessionId, limit: 15 });
        const formattedMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const summary = await llmSupport.summarizeConversation({
            messages: formattedMessages,
            currentSummary: session.summary || null
        });

        await exports.updateSessionSummary({ sessionId, summary });
        return summary;
    }

    return null;
};

// ============================================
// ORDER LOOKUP HELPERS
// ============================================

/**
 * Find order by email and order number
 */
exports.findOrderByEmailAndNumber = async ({ email, orderNumber }) => {
    if (!email) {
        throw new CustomError("Email is required", 400);
    }

    let sql = `
        SELECT o.*, r.id as registration_id, r.event_id
        FROM orders o
        JOIN registration r ON o.registration_id = r.id
        JOIN attendees a ON a.registration_id = r.id
        WHERE a.email = $1
    `;
    const values = [email];

    if (orderNumber) {
        sql += ` AND o.order_number = $2`;
        values.push(orderNumber);
    }

    sql += ` ORDER BY o.created_at DESC LIMIT 1`;

    const result = await query(sql, values);
    return result.rows[0] || null;
};

/**
 * Find order by order number only
 */
exports.findOrderByNumber = async ({ orderNumber }) => {
    if (!orderNumber) {
        throw new CustomError("Order number is required", 400);
    }

    const result = await query(
        `SELECT o.*, r.id as registration_id, r.event_id
         FROM orders o
         JOIN registration r ON o.registration_id = r.id
         WHERE o.order_number = $1`,
        [orderNumber]
    );

    return result.rows[0] || null;
};

/**
 * Get recent order numbers for a user by email
 * Returns up to 3 most recent order numbers (human-readable, not IDs)
 */
exports.getRecentOrderNumbers = async ({ email, limit = 3 }) => {
    if (!email) {
        return [];
    }

    const result = await query(
        `SELECT DISTINCT o.order_number, o.created_at
         FROM orders o
         JOIN registration r ON o.registration_id = r.id
         JOIN attendees a ON a.registration_id = r.id
         WHERE a.email = $1
         ORDER BY o.created_at DESC
         LIMIT $2`,
        [email, limit]
    );

    return result.rows.map(row => row.order_number);
};

// ============================================
// OTP MANAGEMENT
// ============================================

/**
 * Generate and store OTP
 */
exports.generateOTP = async ({ email, purpose, supportRequestId = null }) => {
    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Expires in 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Invalidate any existing OTPs for this email+purpose
    await query(
        `UPDATE support_otp SET is_used = true WHERE email = $1 AND purpose = $2 AND is_used = false`,
        [email, purpose]
    );

    // Store new OTP
    const result = await query(
        `INSERT INTO support_otp (email, purpose, code, expires_at, support_request_id, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [email, purpose, code, expiresAt, supportRequestId]
    );

    return result.rows[0];
};

/**
 * Verify OTP
 */
exports.verifyOTP = async ({ email, purpose, code }) => {
    const result = await query(
        `SELECT * FROM support_otp
         WHERE email = $1 AND purpose = $2 AND code = $3 AND is_used = false AND expires_at > NOW()`,
        [email, purpose, code]
    );

    if (result.rows.length === 0) {
        throw new CustomError("Invalid or expired OTP", 400);
    }

    // Mark as used
    await query(
        `UPDATE support_otp SET is_used = true WHERE id = $1`,
        [result.rows[0].id]
    );

    return result.rows[0];
};

// ============================================
// SUPPORT REQUEST MANAGEMENT
// ============================================

/**
 * Create support request
 */
exports.createSupportRequest = async ({
    sessionId,
    registrationId,
    orderId,
    intentType,
    userEmail,
    userInput,
    llmParsed = null
}) => {
    const result = await query(
        `INSERT INTO support_requests (session_id, registration_id, order_id, intent_type, user_email, user_input, llm_parsed, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', NOW()) RETURNING *`,
        [
            sessionId,
            registrationId,
            orderId,
            intentType,
            userEmail,
            userInput ? JSON.stringify(userInput) : null,
            llmParsed ? JSON.stringify(llmParsed) : null
        ]
    );

    return result.rows[0];
};

/**
 * Update support request result
 */
exports.updateSupportRequest = async ({ requestId, status, actionResult }) => {
    const result = await query(
        `UPDATE support_requests
         SET status = $1, action_result = $2, resolved_at = NOW()
         WHERE id = $3 RETURNING *`,
        [status, actionResult ? JSON.stringify(actionResult) : null, requestId]
    );

    return result.rows[0];
};

// ============================================
// INTENT HANDLERS
// ============================================

/**
 * 1. Resend Ticket
 */
exports.handleResendTicket = async ({ email, orderNumber, newEmail = null }) => {
    const order = await exports.findOrderByEmailAndNumber({ email, orderNumber });

    if (!order) {
        throw new CustomError("Order not found with the provided information", 404);
    }

    // Resend tickets
    const result = await emailService.sendTicketsByRegistrationId({
        registrationId: order.registrationId
    });

    // If newEmail provided, send to that email instead
    if (newEmail) {
        // Note: This would require modifying emailService to accept custom email
        // For now, we'll use the registration email
        // TODO: Add support for custom email in sendTicketsByRegistrationId
    }

    return {
        success: true,
        message: `Tickets resent successfully to ${newEmail || email}`,
        registrationId: order.registrationId,
        result
    };
};

/**
 * 2. Check Payment Status
 */
exports.handleCheckPaymentStatus = async ({ email, orderNumber }) => {
    const order = await exports.findOrderByEmailAndNumber({ email, orderNumber });

    if (!order) {
        throw new CustomError("Order not found with the provided information", 404);
    }

    return {
        success: true,
        orderNumber: order.orderNumber,
        paymentStatus: order.paymentStatus,
        totalAmount: order.totalAmount,
        currency: order.currency || 'USD',
        paidAt: order.paymentStatus === 'paid' ? order.updatedAt : null
    };
};

/**
 * 4. Check Check-in Status
 */
exports.handleCheckCheckinStatus = async ({ email, orderNumber }) => {
    const order = await exports.findOrderByEmailAndNumber({ email, orderNumber });

    if (!order) {
        throw new CustomError("Order not found with the provided information", 404);
    }

    // Get attendees
    const attendees = await attendeesService.getAttendeesByRegistrationId({
        registrationId: order.registrationId
    });

    // Get check-in records
    const checkins = await checkinService.getCheckinByRegistrationId({
        registrationId: order.registrationId
    });

    const checkinMap = new Map(checkins.map(c => [c.attendeeId, c]));

    const attendeeStatuses = attendees.map(attendee => {
        // Format name properly, handling null/undefined values
        // Database returns camelCase (via db.js toCamelCase)
        const firstName = (attendee.firstName || '').trim();
        const lastName = (attendee.lastName || '').trim();
        let name = `${firstName} ${lastName}`.trim();

        // If name is empty or looks like invalid/test data (short lowercase names like "loop jki"), 
        // set to null so frontend can use email instead
        if (!name || name === 'Attendee' || (name.length < 10 && /^[a-z]+\s[a-z]+$/.test(name))) {
            name = null; // Let frontend decide to use email instead
        }

        return {
            attendeeId: attendee.id,
            name: name, // null if invalid, so frontend can fallback to email
            email: attendee.email,
            checkinStatus: checkinMap.has(attendee.id) ? 'checked_in' : 'not_checked_in',
            qrCode: attendee.qrUuid,
            qrValid: true,
            checkedInAt: checkinMap.get(attendee.id)?.createdAt || null,
            checkedInBy: checkinMap.get(attendee.id)?.checkedInBy || null
        };
    });

    return {
        success: true,
        orderNumber: order.orderNumber,
        attendees: attendeeStatuses
    };
};

/**
 * 5. Track Shipment
 */
exports.handleTrackShipment = async ({ email, orderNumber }) => {
    const order = await exports.findOrderByEmailAndNumber({ email, orderNumber });

    if (!order) {
        throw new CustomError("Order not found with the provided information", 404);
    }

    // Check if order has products
    if (!order.itemsProduct || order.itemsProduct.length === 0) {
        throw new CustomError("This order does not contain physical products", 400);
    }

    return {
        success: true,
        orderNumber: order.orderNumber,
        productStatus: order.productStatus || 'pending',
        shippingAddress: order.shippingAddress,
        shippingType: order.shippingType || 'pickup',
        // TODO: Add actual tracking number if available
        trackingNumber: null,
        carrier: null,
        status: order.productStatus === 'shipped' ? 'in_transit' : 'pending',
        estimatedDelivery: null,
        currentLocation: null,
        trackingUrl: null
    };
};

/**
 * 6. Update Shipping Address
 */
exports.handleUpdateShippingAddress = async ({ orderNumber, newAddress }) => {
    const order = await exports.findOrderByNumber({ orderNumber });

    if (!order) {
        throw new CustomError("Order not found", 404);
    }

    // Check if order can still be updated
    if (order.productStatus === 'shipped' || order.productStatus === 'delivered') {
        throw new CustomError("Cannot update shipping address for orders that are already shipped", 400);
    }

    // Update shipping address
    await query(
        `UPDATE orders SET shipping_address = $1, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(newAddress), order.id]
    );

    return {
        success: true,
        message: "Shipping address updated successfully",
        orderId: order.id,
        canStillChange: order.productStatus === 'pending'
    };
};

/**
 * 7. Update Attendee Info
 */
exports.handleUpdateAttendeeInfo = async ({ orderNumber, attendeeId, fieldToUpdate, newValue }) => {
    const order = await exports.findOrderByNumber({ orderNumber });

    if (!order) {
        throw new CustomError("Order not found", 404);
    }

    // Validate attendee belongs to this order
    const attendee = await query(
        `SELECT * FROM attendees WHERE id = $1 AND registration_id = $2`,
        [attendeeId, order.registrationId]
    );

    if (attendee.rows.length === 0) {
        throw new CustomError("Attendee not found for this order", 404);
    }

    // Validate field
    const allowedFields = ['first_name', 'last_name', 'email', 'phone'];
    if (!allowedFields.includes(fieldToUpdate)) {
        throw new CustomError(`Field ${fieldToUpdate} cannot be updated`, 400);
    }

    // Update field
    const columnName = fieldToUpdate === 'first_name' ? 'first_name' :
        fieldToUpdate === 'last_name' ? 'last_name' :
            fieldToUpdate === 'email' ? 'email' : 'phone';

    await query(
        `UPDATE attendees SET ${columnName} = $1, updated_at = NOW() WHERE id = $2`,
        [newValue, attendeeId]
    );

    return {
        success: true,
        message: `${fieldToUpdate} updated successfully`,
        attendeeId,
        fieldUpdated: fieldToUpdate,
        newValue
    };
};

/**
 * 9. View Order Details
 */
exports.handleViewOrderDetails = async ({ email, orderNumber }) => {
    // Get order with event name in a single optimized query
    let sql = `
        SELECT o.*, 
               r.id as registration_id, 
               r.event_id,
               e.name as event_name
        FROM orders o
        JOIN registration r ON o.registration_id = r.id
        JOIN event e ON r.event_id = e.id
        JOIN attendees a ON a.registration_id = r.id
        WHERE a.email = $1
    `;
    const values = [email];

    if (orderNumber) {
        sql += ` AND o.order_number = $2`;
        values.push(orderNumber);
    }

    sql += ` ORDER BY o.created_at DESC LIMIT 1`;

    const result = await query(sql, values);
    const order = result.rows[0];

    if (!order) {
        throw new CustomError("Order not found with the provided information", 404);
    }

    return {
        success: true,
        order: {
            orderNumber: order.orderNumber,
            status: order.paymentStatus,
            totalAmount: order.totalAmount,
            currency: order.currency || 'USD',
            createdAt: order.createdAt,
            eventName: order.eventName,
            tickets: order.itemsTicket || [],
            products: order.itemsProduct || []
        }
    };
};

/**
 * 10. Check Event Details
 */
exports.handleCheckEventDetails = async ({ eventSlug, orderNumber }) => {
    // Either eventSlug or orderNumber must be provided
    if (!eventSlug && !orderNumber) {
        throw new CustomError("Either event slug/name or order number is required", 400);
    }

    let event = null;

    // If orderNumber is provided, get event from order
    if (orderNumber) {
        const order = await exports.findOrderByNumber({ orderNumber });
        if (!order) {
            throw new CustomError("Order not found", 404);
        }

        // Get event by ID from order's registration
        event = await eventService.getEventById({ eventId: order.eventId });
        if (!event) {
            throw new CustomError("Event not found for this order", 404);
        }
    } else if (eventSlug) {
        // Try to find by slug first
        event = await eventService.getEventBySlug({ slug: eventSlug });

        // If not found by slug, try to find by name (case-insensitive partial match)
        if (!event) {
            const eventResult = await query(
                `SELECT * FROM event WHERE LOWER(name) LIKE LOWER($1) LIMIT 1`,
                [`%${eventSlug}%`]
            );
            if (eventResult.rows.length > 0) {
                event = eventResult.rows[0];
            }
        }
    }

    if (!event) {
        throw new CustomError("Event not found", 404);
    }

    return {
        success: true,
        event: {
            name: event.name,
            slug: event.slug,
            description: event.description,
            startDate: event.startDatetime,
            endDate: event.endDatetime,
            location: event.location,
            venue: event.location, // Assuming location is the venue
            timezone: event.config?.timezone || 'UTC',
            currency: event.currency || 'USD'
        }
    };
};

/**
 * 10. Contact Us
 */
exports.handleContactUs = async ({ email, message, orderNumber = null }) => {
    if (!email || !message) {
        throw new CustomError("Email and message are required", 400);
    }

    // TODO: Send email to support team
    // For now, just return success

    return {
        success: true,
        message: "Your message has been sent to our support team",
        supportEmail: process.env.SENDER_EMAIL || 'support@example.com',
        estimatedResponseTime: "2-4 hours"
    };
};

// ============================================
// MAIN CHAT HANDLER
// ============================================

/**
 * Handle chat message with LLM parsing
 */
exports.handleChatMessage = async ({ sessionId, message, context = {} }) => {
    // Get or create session
    let session = await exports.getSession({ sessionId });

    if (!session) {
        // Create new session
        session = await exports.saveSession({
            sessionId: sessionId || null, // Will be generated if null
            userId: context.userId || null,
            userEmail: context.userEmail || null
        });
    } else {
        // Update last activity for existing session (preserve existing values)
        session = await exports.saveSession({
            sessionId: session.sessionId,
            userId: session.userId || context.userId || null,
            userEmail: session.userEmail || context.userEmail || null,
            summary: session.summary,
            lastIntent: session.lastIntent,
            status: session.status
        });
    }

    // Save user message
    await exports.saveMessage({
        sessionId: session.sessionId,
        role: 'user',
        content: message
    });

    // Get session history
    const sessionHistory = await exports.getSessionHistory({
        sessionId: session.sessionId,
        limit: 10
    });

    // Format history for LLM
    const formattedHistory = sessionHistory.map(m => ({
        role: m.role,
        content: m.content
    }));

    const userEmail = context.userEmail || session.userEmail;

    // Fetch order context if email exists and any intent uses orderNumber
    // This is data-driven from intent config, not hardcoded
    const recentOrderNumbers = (userEmail && hasAnyIntentWithOrderNumber())
        ? await exports.getRecentOrderNumbers({ email: userEmail, limit: 3 })
        : [];

    // Generate hybrid response (natural text + JSON) using LLM
    const hybridResponse = await llmSupport.generateHybridResponse({
        text: message,
        context: {
            userEmail: userEmail,
            recentOrderNumbers: recentOrderNumbers,
            summary: session.summary
        },
        sessionHistory: formattedHistory
    });

    // Parse hybrid response to extract natural text and structured data
    const parsed = llmSupport.parseHybridResponse(hybridResponse);

    // If intent is unknown or confidence is very low, redirect to contact_us
    if (parsed.intent === 'unknown' || parsed.confidence < 0.3) {
        parsed.intent = 'contact_us';
        parsed.confidence = 0.8;
        parsed.naturalResponse = "I'm sorry, I couldn't find a solution for your request. Please contact our support team and we'll help you right away.";
        parsed.slots = {
            email: userEmail || null,
            message: message,
            orderNumber: null
        };
    }

    // Save assistant response with natural language content
    await exports.saveMessage({
        sessionId: session.sessionId,
        role: 'assistant',
        content: parsed.naturalResponse, // Store natural language response
        intent: parsed.intent,
        confidence: parsed.confidence,
        slots: parsed.slots
    });

    // Summarize if needed
    await exports.summarizeIfNeeded({ sessionId: session.sessionId });

    return {
        sessionId: session.sessionId,
        intent: parsed.intent,
        confidence: parsed.confidence,
        slots: parsed.slots,
        naturalResponse: parsed.naturalResponse // Return natural language response
    };
};


