const CustomError = require("../model/CustomError");
const { query } = require("../db");
const { v4: uuidv4 } = require("uuid");
const stripeService = require("../service/stripe");
const ticketService = require("./ticket");
const registrationService = require("./registration");
const attendeesService = require("./attendees");
const emailService = require("./email");
const eventService = require("./event");

exports.save = async ({ payload }) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    const orderNumber = payload.orderNumber || payload.order_number;
    const totalAmount = payload.totalAmount !== undefined ? payload.totalAmount : payload.total_amount;
    const registrationId = payload.registrationId || payload.registration_id;
    const eventId = payload.eventId || payload.event_id;

    // Validate required fields
    if (!orderNumber || (typeof orderNumber === 'string' && !orderNumber.trim())) {
        throw new CustomError("Order number is required", 400);
    }

    if (totalAmount == null) {
        throw new CustomError("Valid total amount is required", 400);
    }

    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        INSERT INTO orders (order_number, total_amount, currency, payment_status, 
                            payment_gateway, gateway_transaction_id, gateway_metadata, gateway_response,
                            stripe_payment_intent_id,
                            items_ticket, items_product, product_status,
                            registration_id, event_id, shipping_cost, shipping_address, shipping_type,
                            tax_amount, promo_code, discount_amount,
                            sales_channel, cashier_id, ticket_counter_id, cash_session_id, payment_method,
                            created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, NOW(), NOW()) RETURNING *;`;

    const result = await query(sql, [
        orderNumber,
        totalAmount,
        payload.currency || "USD",
        payload.paymentStatus || payload.payment_status || "pending",
        payload.paymentGateway || payload.payment_gateway || null,
        payload.gatewayTransactionId || payload.gateway_transaction_id || null,
        JSON.stringify(payload.gatewayMetadata || payload.gateway_metadata || {}),
        JSON.stringify(payload.gatewayResponse || payload.gateway_response || {}),
        payload.stripePaymentIntentId || payload.stripe_payment_intent_id || null, // Keep for backward compatibility
        JSON.stringify(payload.itemsTicket || payload.items_ticket || payload.items || []),
        JSON.stringify(payload.itemsProduct || payload.items_product || []),
        payload.productStatus || payload.product_status || "pending",
        registrationId,
        eventId,
        payload.shippingCost || payload.shipping_cost || 0,
        JSON.stringify(payload.shippingAddress || payload.shipping_address || null),
        payload.shippingType || payload.shipping_type || "pickup",
        payload.taxAmount || payload.tax_amount || 0,
        payload.promoCode || payload.promo_code || null,
        payload.discountAmount || payload.discount_amount || 0,
        payload.salesChannel || payload.sales_channel || "online",
        payload.cashierId || payload.cashier_id || null,
        payload.ticketCounterId || payload.ticket_counter_id || null,
        payload.cashSessionId || payload.cash_session_id || null,
        payload.paymentMethod || payload.payment_method || "card",
    ]);

    if (!result.rows[0]) {
        throw new CustomError("Failed to create order", 500);
    }

    return result.rows[0];
};

exports.getOrderById = async ({ orderId }) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM orders
        WHERE id = $1
    `;
    const result = await query(sql, [orderId]);

    if (!result.rows[0]) {
        throw new CustomError("Order not found", 404);
    }

    return result.rows[0];
};

exports.updatePaymentStatus = async ({
    orderId,
    paymentStatus,
    stripePaymentIntentId = null,
}) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }

    if (!paymentStatus || !paymentStatus.trim()) {
        throw new CustomError("Payment status is required", 400);
    }

    const sql = `
        UPDATE orders
        SET payment_status           = $1,
            stripe_payment_intent_id = $2,
            updated_at               = NOW()
        WHERE id = $3 RETURNING *
    `;
    const result = await query(sql, [
        paymentStatus,
        stripePaymentIntentId,
        orderId,
    ]);

    if (!result.rows[0]) {
        throw new CustomError("Order not found", 404);
    }

    return result.rows[0];
};

exports.getOrderWithItems = async ({ orderId }) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }

    const sql = `
        SELECT o.*,
               jsonb_build_object(
                       'attendees', COALESCE(
                       (SELECT jsonb_agg(
                                       jsonb_build_object(
                                               'id', a.id,
                                               'firstName', a.first_name,
                                               'lastName', a.last_name,
                                               'email', a.email,
                                               'phone', a.phone,
                                               'ticketId', a.ticket_id,
                                               'qrUuid', a.qr_uuid,
                                               'isPrimary', a.is_primary
                                       )
                               )
                        FROM attendees a
                        WHERE a.registration_id = r.id), '[]' ::jsonb
                                    ),
                       'additionalFields', r.additional_fields
               ) as customer_data
        FROM orders o
                 LEFT JOIN registration r ON o.registration_id = r.id
        WHERE o.id = $1
    `;
    const result = await query(sql, [orderId]);

    if (!result.rows[0]) {
        throw new CustomError("Order not found", 404);
    }

    return result.rows[0];
};

exports.getOrdersByEventId = async ({ eventId }) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM orders
        WHERE event_id = $1
        ORDER BY created_at DESC
    `;
    const result = await query(sql, [eventId]);
    return result.rows;
};

// Generate unique order number
exports.generateOrderNumber = () => {
    const timestamp = Date.now().toString();
    // const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `ORD-${timestamp}`;
};


// Update payment status with stock update
exports.updatePaymentStatusWithStockUpdate = async ({
    orderId,
    paymentStatus,
    stripePaymentIntentId,
}) => {
    if (!orderId) {
        throw new CustomError("Order ID is required", 400);
    }
    if (!paymentStatus) {
        throw new CustomError("Payment status is required", 400);
    }

    const updatedOrder = await exports.updatePaymentStatus({
        orderId,
        paymentStatus,
        stripePaymentIntentId,
    });

    // If payment successful, update ticket stock
    if (paymentStatus === "paid") {
        const orderWithItems = await exports.getOrderWithItems({ orderId });

        for (const item of orderWithItems.items) {
            await ticketService.updateStock({
                ticketId: item.ticketId,
                quantity: item.quantity,
                salesChannel: updatedOrder.salesChannel || "online"
            });
        }
    }

    return updatedOrder;
};

exports.getOrderByRegistrationId = async ({ registrationId }) => {
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }

    const sql = `
        SELECT *
        FROM orders
        WHERE registration_id = $1
        ORDER BY created_at DESC LIMIT 1
    `;
    const result = await query(sql, [registrationId]);

    if (result.rows.length === 0) {
        return null; // No order found for this registration
    }

    return result.rows[0];
};

exports.getOrderByGatewayTransactionId = async ({ gatewayTransactionId, paymentGateway }) => {
    if (!gatewayTransactionId) {
        throw new CustomError("Gateway transaction ID is required", 400);
    }

    let sql = `
        SELECT *
        FROM orders
        WHERE gateway_transaction_id = $1
    `;
    const params = [gatewayTransactionId];
    if (paymentGateway) {
        sql += ` AND payment_gateway = $2`
        params.push(paymentGateway)
    }

    // Add LIMIT 1 just in case
    const safeSql = sql + ` LIMIT 1`;

    const result = await query(safeSql, params);

    return result.rows[0] || null;
};
exports.getOrdersBySessionId = async (sessionId) => {
    if (!sessionId) {
        throw new CustomError("Session ID is required", 400);
    }

    const sql = `
        SELECT o.*
        FROM orders o
        JOIN registration r ON o.registration_id = r.id
        JOIN attendees a ON a.registration_id = r.id
        WHERE a.session_id = $1
        UNION
        SELECT *
        FROM orders
        WHERE gateway_metadata->>'sessionId' = $1
           OR gateway_metadata->>'session_id' = $1
           OR gateway_response->'metadata'->>'sessionId' = $1
           OR gateway_response->'metadata'->>'session_id' = $1;
    `;
    const result = await query(sql, [sessionId]);
    return result.rows;
};

exports.getOrdersByEmail = async (email) => {
    if (!email) {
        throw new CustomError("Email is required", 400);
    }

    const sql = `
        SELECT 
            o.id, 
            o.order_number, 
            o.total_amount, 
            o.currency, 
            o.payment_status, 
            o.items_ticket, 
            o.created_at, 
            o.registration_id, 
            e.name as event_name, 
            e.slug as event_slug, 
            e.start_datetime as event_date,
            e.location as event_location,
            jsonb_build_object(
                'attendees', (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', a.id,
                            'firstName', a.first_name,
                            'lastName', a.last_name,
                            'email', a.email,
                            'qrUuid', a.qr_uuid,
                            'ticketId', a.ticket_id
                        )
                    )
                    FROM attendees a
                    WHERE a.registration_id = o.registration_id
                )
            ) as customer_data
        FROM orders o
        JOIN event e ON o.event_id = e.id
        WHERE o.registration_id IN (
            SELECT registration_id FROM attendees WHERE email = $1
        )
        ORDER BY o.created_at DESC;
    `;
    const result = await query(sql, [email]);

    // DB driver already converts snake_case to camelCase
    return result.rows;
};

exports.resendOrderEmail = async (orderId, userEmail) => {
    const order = await exports.getOrderById({ orderId });

    // Safety check: ensure the user requesting the email is linked to this order
    const checkSql = `
        SELECT 1 FROM attendees 
        WHERE registration_id = $1 AND email = $2
        LIMIT 1;
    `;
    const checkResult = await query(checkSql, [order.registration_id, userEmail]);
    if (checkResult.rows.length === 0) {
        throw new CustomError("You are not authorized to resend this ticket", 403);
    }

    return await emailService.sendTicketsByRegistrationId({
        registrationId: order.registration_id
    });
};
