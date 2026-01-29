const PaymentDispatcher = require("../payment");
const registrationService = require("./registration");
const eventService = require("./event");
const ticketService = require("./ticket");
const productService = require("./product");
const emailService = require("./email");
const tempRegistrationService = require("./tempRegistration");
const orderService = require("./order");
const attendeesService = require("./attendees");
const eventVisitorService = require("./eventVisitor");
const promoCodeService = require("./promoCode");
const CustomError = require("../model/CustomError");

const { v4: uuidv4 } = require("uuid");
const { generateSessionId } = require("../utils/common");

/**
 * Payment Business Logic Service
 * Gateway-agnostic logic for handling order finalization and status checks.
 */
class PaymentService {
    /**
     * Initiate a payment with full backend validation
     * @param {Object} params 
     * @returns {Promise<Object>} Action object
     */
    async initiatePayment(params) {
        const {
            gateway = 'stripe',
            attendees,
            selectedTickets,
            selectedProducts,
            registration,
            sessionId: providedSessionId
        } = params;

        // 1. Validation Logic (extracted from legacy stripeService)
        if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
            throw new CustomError("Missing required attendee data", 400);
        }

        if (!registration || !registration.eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        // 2. Check for existing registration
        for (const attendee of attendees) {
            const existing = await registrationService.getRegistrationByEmail({
                email: attendee.email,
                eventId: registration.eventId,
            });
            if (existing) {
                throw new CustomError(`Registration already exists for email: ${attendee.email}`, 400);
            }
        }

        // 3. Load Event & Calculate Totals
        const event = await eventService.getEventById({ eventId: registration.eventId });
        if (!event) throw new CustomError("Event not found", 404);

        let subtotal = 0;
        const validatedTickets = [];
        const validatedProducts = [];

        // Validate Tickets
        const dbTickets = await ticketService.getTicketsByEventId({ eventId: registration.eventId });
        const ticketMap = new Map(dbTickets.map(t => [t.id, t]));

        for (const item of selectedTickets) {
            const dbTicket = ticketMap.get(item.ticketId);
            if (!dbTicket) throw new CustomError(`Ticket not found`, 404);
            if (dbTicket.currentStock < item.quantity) throw new CustomError(`Insufficient stock for ${dbTicket.title}`, 400);

            subtotal += dbTicket.price * item.quantity;
            validatedTickets.push({ ...item, price: dbTicket.price });
        }

        // Validate Products
        if (selectedProducts?.length > 0) {
            const dbProducts = await productService.getEventProducts({ eventId: registration.eventId });
            const productMap = new Map(dbProducts.map(p => [p.id, p]));

            for (const item of selectedProducts) {
                const dbProduct = productMap.get(item.productId);
                if (!dbProduct) throw new CustomError(`Product not found`, 404);
                if (dbProduct.stock < item.quantity) throw new CustomError(`Insufficient stock for ${dbProduct.name}`, 400);

                subtotal += dbProduct.price * item.quantity;
                validatedProducts.push({ ...item, price: dbProduct.price });
            }
        }

        // 4. Calculate Tax
        let totalAmount = subtotal;
        let taxAmount = 0;
        const taxType = event.taxType || event.tax_type;
        const taxAmountConfig = event.taxAmount || event.tax_amount;

        if (taxType && taxAmountConfig && subtotal > 0) {
            const type = taxType.toLowerCase();
            const amount = Number(taxAmountConfig);
            if (type === 'percent') {
                taxAmount = Math.round((subtotal * amount) / 100);
            } else if (type === 'fixed') {
                taxAmount = Math.round(amount);
            }
            totalAmount += taxAmount;
        }

        // 4b. LATE INIT: Apply Promo Code (if provided)
        let discountAmount = 0;
        let promoCodeApplied = null;

        if (params.promoCode) {
            const promo = await promoCodeService.validatePromoCode({ code: params.promoCode, eventId: registration.eventId });
            if (promo) {
                // Calculate discount
                const dV = Number(promo.discountValue || promo.discount_value || 0);
                const dT = promo.discountType || promo.discount_type;

                if (dT === 'percentage') {
                    discountAmount = Math.round((subtotal * dV) / 100);
                } else {
                    discountAmount = dV;
                }
                discountAmount = Math.min(discountAmount, subtotal);

                // Recalculate tax with net subtotal
                const netSubtotal = Math.max(0, subtotal - discountAmount);
                let newTax = 0;
                if (taxType && taxAmountConfig && netSubtotal > 0) {
                    const type = taxType.toLowerCase();
                    const amount = Number(taxAmountConfig);
                    if (type === 'percent') newTax = Math.round((netSubtotal * amount) / 100);
                    else newTax = Math.round(amount);
                }

                // Update totals
                taxAmount = newTax;
                totalAmount = netSubtotal + newTax;
                promoCodeApplied = params.promoCode;
            }
        }

        // 4c. Calculate Shipping (if products are present and delivery selected)
        let shippingAmount = 0;
        const shippingOption = params.shippingOption || 'pickup';
        if (selectedProducts?.length > 0 && shippingOption === 'delivery') {
            const fee = event.config?.shippingFee || 0;
            const ratio = getCurrencyMinorUnitRatio(event.currency.toLowerCase());
            shippingAmount = Math.round(fee * ratio);
            totalAmount += shippingAmount;
        }

        // 5. Generate Session & Order
        const sessionId = providedSessionId || generateSessionId();
        const orderNumber = orderService.generateOrderNumber();

        // 5b. Pre-generate QR UUIDs (for early success page landing)
        const attendeeBlueprint = attendees.map(a => ({
            ...a,
            qrUuid: a.qrUuid || uuidv4()
        }));

        // 5c. Idempotency Check: Reuse existing session if gateway and amount match
        if (providedSessionId) {
            const existingTemp = await tempRegistrationService.getTempRegistration(providedSessionId, true);
            if (existingTemp && existingTemp.orders) {
                const existingGateway = existingTemp.orders.gateway;
                const existingAmount = existingTemp.orders.totalAmount || existingTemp.orders.total_amount;

                if (existingGateway === gateway && Number(existingAmount) === totalAmount) {
                    // Reuse the existing transaction data
                    return {
                        ...existingTemp.orders.gatewayMetadata,
                        transactionId: existingTemp.orders.gatewayTransactionId || existingTemp.orders.gateway_transaction_id,
                        sessionId: providedSessionId,
                        totalAmount
                    };
                }
            }
        }

        // 6. Invoke Dispatcher (to Gateway)
        let action = {};

        if (totalAmount > 0) {
            action = await PaymentDispatcher.initiatePayment(gateway, {
                amount: totalAmount,
                currency: event.currency,
                receiptEmail: attendeeBlueprint[0].email,
                metadata: {
                    sessionId,
                    eventId: registration.eventId.toString(),
                    eventSlug: event.slug,
                    orderNumber
                }
            });
        } else {
            // Free order: No gateway needed
            action = {
                transactionId: `FREE_${orderNumber}`,
                metadata: {
                    sessionId,
                    orderNumber,
                    isFree: true
                }
            };
        }

        // 7. Store Temporary Registration
        await tempRegistrationService.storeTempRegistration({
            sessionId,
            attendees: attendeeBlueprint,
            registration,
            selectedTickets,
            selectedProducts,
            orders: {
                orderNumber,
                totalAmount,
                currency: event.currency,
                paymentStatus: "pending",
                subtotal,
                taxAmount,
                shippingAmount,
                discountAmount,
                promoCode: promoCodeApplied,
                eventId: registration.eventId,
                shippingOption,
                // STANDARD: Store gateway info explicitly
                gateway: gateway,
                gatewayTransactionId: action.transactionId,
                gatewayMetadata: {
                    payToken: action.payToken,
                    notifToken: action.notifToken,
                    paymentUrl: action.paymentUrl,
                    ...action.metadata
                },
                // LEGACY BACK COMPAT: Keep specific fields for now just in case
                ...(gateway === 'orange_money' && action.payToken ? {
                    omPayToken: action.payToken,
                    omNotifToken: action.notifToken,
                    omPaymentUrl: action.paymentUrl,
                    omTransactionId: action.transactionId
                } : {})
            },
            eventId: registration.eventId,
        });

        return { ...action, sessionId, totalAmount };
    }

    /**
     * Finalize an order after successful payment
     * @param {Object} paymentData Standardized data from adapter
     * @returns {Promise<Object>} Processed registration data
     */
    async finalizePayment(paymentData) {
        const { transactionId, metadata, gateway, amount } = paymentData;
        const sessionId = metadata.sessionId;

        if (!sessionId) {
            throw new CustomError("No session data found for this payment", 400);
        }

        try {
            // 0. Robust Pre-emptive Idempotency Check
            // We check for both existing order and existing attendees linked to this session.
            const existingOrder = await orderService.getOrderByGatewayTransactionId({
                gatewayTransactionId: transactionId,
                paymentGateway: gateway
            });

            const sessionAttendees = await attendeesService.getAttendeesBySessionId(sessionId);

            if (existingOrder || (sessionAttendees && sessionAttendees.length > 0)) {

                const regId = existingOrder ? existingOrder.registrationId : sessionAttendees[0].registrationId;
                const registration = await registrationService.getRegistrationById({ registrationId: regId });
                const attendees = await attendeesService.getAttendeesByRegistrationId({ registrationId: regId });

                // Fetch the actual order to ensure we have the correct orderNumber/orderId
                const finalOrder = existingOrder || await orderService.getOrderByRegistrationId({ registrationId: regId });

                return {
                    registrationId: regId,
                    orderId: finalOrder ? finalOrder.id : null,
                    orderNumber: finalOrder ? finalOrder.orderNumber : null,
                    attendees,
                    eventId: registration.eventId,
                    alreadyFinalized: true
                };
            }

            // 1. Retrieve Blueprint from temp_registration
            const sessionData = await tempRegistrationService.getTempRegistration(sessionId);
            if (!sessionData) {
                // Check if payment was already processed despite idempotency checks (race condition)
                if (paymentData.metadata?.processed === "true") {
                    return { alreadyFinalized: true, message: "Handled by earlier process" };
                }
                throw new CustomError("Temporary registration data not found or expired", 404);
            }

            // 2. Load dependencies
            const event = await eventService.getEventById({ eventId: sessionData.eventId });
            if (!event) throw new CustomError("Event not found", 404);

            // 3. Create permanent Registration record
            const registrationResult = await registrationService.save({
                eventId: sessionData.eventId,
                organizationId: sessionData.organizationId,
                additionalFields: sessionData.registration?.additionalFields || {},
                userTimezone: sessionData.registration?.userTimezone || 'UTC',
                timezoneOffset: sessionData.registration?.timezoneOffset || 0,
                status: true // Mark as paid
            });

            // 4. Create Order record (High Fidelity mapping)
            const orderNumber = sessionData.orders?.orderNumber || sessionData.orders?.order_number || orderService.generateOrderNumber();

            // Explicit separate tickets/products from Blueprint
            const itemsTicket = sessionData.selectedTickets || [];
            const itemsProduct = sessionData.selectedProducts || [];

            // Build gateway-specific metadata
            const gatewayMetadata = { sessionId: sessionId }; // Always include sessionId for traceability
            if (gateway === 'stripe') {
                gatewayMetadata.payment_intent_id = transactionId;
                if (paymentData.metadata) Object.assign(gatewayMetadata, paymentData.metadata);
            } else if (gateway === 'orange_money') {
                gatewayMetadata.order_id = transactionId;
                gatewayMetadata.pay_token = sessionData.orders?.omPayToken || sessionData.orders?.om_pay_token;
                gatewayMetadata.notif_token = sessionData.orders?.omNotifToken || sessionData.orders?.om_notif_token;
                gatewayMetadata.payment_url = sessionData.orders?.omPaymentUrl || sessionData.orders?.om_payment_url;
            }

            const orderResult = await orderService.save({
                payload: {
                    ...(sessionData.orders || {}),
                    orderNumber,
                    totalAmount: amount || sessionData.orders?.totalAmount || sessionData.orders?.total_amount,
                    currency: event.currency,
                    paymentStatus: "paid",
                    paymentGateway: gateway,
                    gatewayTransactionId: transactionId,
                    gatewayMetadata: gatewayMetadata,
                    gatewayResponse: paymentData.rawResponse || paymentData.metadata || {},
                    itemsTicket,
                    itemsProduct,
                    registrationId: registrationResult.id,
                    eventId: sessionData.eventId,
                    organizationId: sessionData.organizationId,
                    shippingCost: paymentData.shippingCost || sessionData.orders?.shippingCost || sessionData.orders?.shipping_cost || 0,
                    shippingAddress: paymentData.shippingAddress || sessionData.orders?.shippingAddress || sessionData.orders?.shipping_address || null,
                    shippingType: paymentData.shippingType || sessionData.orders?.shippingType || sessionData.orders?.shipping_type || 'pickup',
                    sessionId: sessionId // Use full indexed column
                },
            });

            // 5. Create Attendees (linked to session and ORDER)
            const attendeesToCreate = sessionData.attendees.map(a => ({
                ...a,
                registrationId: registrationResult.id,
                sessionId: sessionId,
                orderId: orderResult.id
            }));

            const savedAttendees = await attendeesService.createAttendees({
                registrationId: registrationResult.id,
                attendees: attendeesToCreate
            });

            // 6. Stock Updates (Channel Optimized)
            for (const item of itemsTicket) {
                await ticketService.updateStock({
                    ticketId: item.ticketId,
                    quantity: item.quantity,
                    salesChannel: 'online'
                });
            }
            for (const item of itemsProduct) {
                if (item.productId && item.quantity) {
                    await productService.updateStock({
                        productId: item.productId,
                        quantity: item.quantity
                    });
                }
            }

            // 7. Event Metrics & Visitor Conversion
            await eventService.increaseRegistrationCount({ eventId: sessionData.eventId });
            if (savedAttendees?.[0]?.email) {
                try {
                    await eventVisitorService.markVisitorConverted({
                        eventId: sessionData.eventId,
                        email: savedAttendees[0].email,
                    });
                } catch (e) { console.warn("Visitor conversion failed", e); }
            }

            // 8. Emails (Batch)
            emailService.sendTicketsByRegistrationId({
                registrationId: registrationResult.id,
                orderId: orderResult.id
            }).catch(e => console.error(`Email batch failed for registration ${registrationResult.id}:`, e));

            // 9. Cleanup temp registration (IMMEDIATE)
            try {
                const tempRegistrationService = require("./tempRegistration");
                await tempRegistrationService.deleteTempRegistration(sessionId);
            } catch (e) {
                console.warn(`[PaymentService] Temp registration cleanup failed for ${sessionId}:`, e.message);
            }

            return {
                registrationId: registrationResult.id,
                orderId: orderResult.id,
                orderNumber,
                attendees: savedAttendees,
                eventId: sessionData.eventId,
                order: orderResult,
                event: event,
                registration: registrationResult
            };

        } catch (error) {
            console.error("Order Finalization Failed:", error);
            if (error instanceof CustomError) throw error;
            throw new CustomError(`Finalization Error: ${error.message}`, 500);
        }
    }

    /**
     * Apply a promo code to an existing payment transaction
     * @param {Object} params 
     * @returns {Promise<Object>} Discount details
     */
    async applyPromoCode(params) {
        const { transactionId, promoCode, sessionId, eventId, gateway = 'stripe' } = params;

        if (!transactionId || !promoCode || !sessionId || !eventId) {
            throw new CustomError("Missing required parameters", 400);
        }

        // 1. Validate promo code
        const validatedPromo = await promoCodeService.validatePromoCode({ code: promoCode, eventId });

        // 2. Get temp registration data to calculate new total
        const tempReg = await tempRegistrationService.getTempRegistration(sessionId);
        if (!tempReg || !tempReg.orders) {
            throw new CustomError("Registration session not found", 404);
        }

        const event = await eventService.getEventById({ eventId });
        const orders = tempReg.orders;
        const subtotal = Number(orders.subtotal || 0);
        const shippingCost = Number(orders.shippingCost || orders.shipping_cost || 0);

        // 3. Calculate discount
        let discountAmount = 0;
        const dT = validatedPromo.discountType || validatedPromo.discount_type;
        const dV = Number(validatedPromo.discountValue || validatedPromo.discount_value || 0);

        if (dT === 'percentage') {
            discountAmount = Math.round((subtotal * dV) / 100);
        } else {
            discountAmount = dV;
        }

        discountAmount = Math.min(discountAmount, subtotal);

        // 4. Recalculate Tax
        const netSubtotal = Math.max(0, subtotal - discountAmount);
        let newTaxAmount = 0;

        const taxType = event.taxType || event.tax_type;
        const taxAmountConfig = event.taxAmount || event.tax_amount;

        if (taxType && taxAmountConfig && netSubtotal > 0) {
            const type = taxType.toLowerCase();
            const amount = Number(taxAmountConfig);

            if (!isNaN(amount) && amount > 0) {
                if (type === 'percent') {
                    newTaxAmount = Math.round((netSubtotal * amount) / 100);
                } else if (type === 'fixed') {
                    newTaxAmount = Math.round(amount);
                }
            }
        }

        const newTotal = netSubtotal + newTaxAmount + shippingCost;

        // 5. Update Payment Gateway (if applicable)
        let result = { status: 'applied', discountAmount, newTotal };

        // Only call gateway if it's a real transaction and newTotal > 0
        if (!transactionId.toString().startsWith('FREE_') && newTotal > 0 && gateway) {
            result = await PaymentDispatcher.applyPromoCode(gateway, transactionId, validatedPromo, {
                newTotal,
                discountAmount,
                netSubtotal,
                newTaxAmount,
                promoCode
            });
        }

        // 6. Update temp_registration orders
        await tempRegistrationService.updateTempRegistration(sessionId, {
            orders: {
                ...tempReg.orders,
                totalAmount: newTotal,
                taxAmount: newTaxAmount,
                discountAmount,
                promoCode: promoCode.toUpperCase()
            }
        });

        return result;
    }

    /**
     * Get payment status (checks DB first, then Gateway if needed)
     * @param {string} sessionId 
     * @returns {Promise<Object>}
     */
    async checkStatusBySession(sessionId) {
        if (!sessionId) throw new CustomError("Session ID is required", 400);

        try {
            // 1. Check if an order already exists for this session (via registration mapping)
            // 1. Find the temporary registration (search by PK or OM ID)
            let tempReg = null;
            try {
                // Try PK lookup first
                tempReg = await tempRegistrationService.getTempRegistration(sessionId);
            } catch (e) {
                // Try OM Transaction ID fallback
                tempReg = await tempRegistrationService.getTempRegistrationByOmTransactionId(sessionId);
            }

            // 2. Look for completed orders by sessionId in metadata OR by email/event from tempReg
            const orders = await orderService.getOrdersBySessionId(sessionId);
            const completedOrder = orders.find(o => o.paymentStatus === 'paid');

            if (completedOrder) {
                return {
                    status: 'paid',
                    orderId: completedOrder.id,
                    orderNumber: completedOrder.orderNumber,
                    registrationId: completedOrder.registrationId,
                    eventId: completedOrder.eventId
                };
            }

            // 3. Check if it's still in temp_registration (meaning pending or failed)
            if (tempReg) {
                return {
                    status: tempReg.orders?.paymentStatus || 'pending',
                    eventId: tempReg.eventId
                };
            }

            return { status: 'not_found' };
        } catch (error) {
            console.error("[Payment Service] Status check failed:", error);
            return { status: 'error', message: error.message };
        }
    }

    /**
     * Get order by gateway transaction ID
     * @param {string} transactionId 
     * @returns {Promise<Object>} Order object or null
     */
    async getOrderByGatewayTransactionId(transactionId) {
        return await orderService.getOrderByGatewayTransactionId({
            gatewayTransactionId: transactionId
        });
    }

    /**
     * Proactively verify payment status with gateway and finalize if paid.
     * Used by success page to prevent race conditions.
     * @param {string} sessionId
     * @returns {Promise<boolean>} True if finalized/paid, false otherwise
     */
    async verifyAndFinalize(sessionId) {
        try {
            // 0. CHECK PERMANENT RECORDS FIRST (Source of Truth Pivot)
            // If the order already exists, then we are done. We don't need the temp table anymore.
            const existingOrders = await orderService.getOrdersBySessionId(sessionId);
            const permanentOrder = existingOrders && existingOrders.length > 0 ? existingOrders[0] : null;

            if (permanentOrder && permanentOrder.paymentStatus === 'paid') {
                // Get current registration and attendees to reflect manual changes (like deletions)
                const registration = await registrationService.getRegistrationById({ registrationId: permanentOrder.registrationId });

                // If registration is gone, the record is considered 'deleted' (manually by admin or system)
                if (!registration) {
                    return { paid: false, status: 'deleted' };
                }

                const attendees = await attendeesService.getAttendeesByRegistrationId({ registrationId: permanentOrder.registrationId });
                const event = await eventService.getEventById({ eventId: permanentOrder.eventId });

                return {
                    paid: true,
                    status: 'paid',
                    registration,
                    order: permanentOrder,
                    attendees,
                    event
                };
            }

            // 1. Get Temp Registration (Blueprint)
            const tempReg = await tempRegistrationService.getTempRegistration(sessionId, true);
            if (!tempReg) {
                // If no temp reg AND no permanent order, it's genuinely gone or expired
                return { paid: false, status: 'expired' };
            }

            const orders = tempReg.orders || {};

            // If already marked paid in session (but for some reason check above failed - safety net)
            if (orders.paymentStatus === 'paid') {
                const fullData = await tempRegistrationService.getTempRegistrationWAttendees(sessionId);
                return { paid: true, status: 'paid', ...fullData };
            }

            if (orders.paymentStatus === 'failed' || orders.paymentStatus === 'cancelled') {
                return { paid: false, status: orders.paymentStatus, ...tempReg };
            }

            // 2. Determine Gateway
            let gateway = orders.gateway;
            let transactionId = orders.gatewayTransactionId;
            let extraParams = orders.gatewayMetadata || {};

            // Fallback for legacy sessions
            if (!gateway) {
                if (orders.omPayToken || orders.om_pay_token) {
                    gateway = 'orange_money';
                    transactionId = orders.omTransactionId || orders.om_transaction_id;
                    extraParams = { amount: orders.totalAmount, payToken: orders.omPayToken };
                } else if (orders.paymentIntentId) {
                    gateway = 'stripe';
                    transactionId = orders.paymentIntentId;
                }
            }

            if (!gateway || !transactionId) {
                return { paid: false, status: 'pending', ...tempReg };
            }

            // 3. Call Dispatcher
            const adapter = PaymentDispatcher.getAdapter(gateway);
            if (!extraParams.amount) {
                extraParams.amount = orders.totalAmount || orders.total_amount;
            }

            const verifyResult = await adapter.verifyPayment(transactionId, extraParams);

            // 4. Finalize if paid
            if (verifyResult.status === 'paid') {
                // Update temp registration status BEFORE finalization (which deletes it)
                // This ensures that even if finalization takes a second, concurrent polls see 'paid'
                try {
                    await tempRegistrationService.updateTempRegistration(sessionId, {
                        orders: { ...orders, paymentStatus: 'paid' }
                    });
                } catch (e) {
                    console.warn("[PaymentService] Failed to update temp status (data might already be finalized by webhook)", e.message);
                }

                const result = await this.finalizePayment({
                    transactionId: verifyResult.transactionId,
                    metadata: { sessionId, ...verifyResult.metadata },
                    gateway: gateway,
                    amount: verifyResult.amount,
                    rawResponse: verifyResult.metadata
                });

                const registration = await registrationService.getRegistrationById({ registrationId: result.registrationId });
                const event = await eventService.getEventById({ eventId: registration.eventId });

                return {
                    paid: true,
                    status: 'paid',
                    registration,
                    order: result.order || result,
                    attendees: result.attendees,
                    event
                };
            }

            return { paid: false, status: verifyResult?.status || 'pending', ...tempReg };
        } catch (error) {
            console.error(`[PaymentService] verification failed: ${error.message}`);
            return { paid: false, error: error.message, status: 'error' };
        }
    }
}

module.exports = new PaymentService();
