const { VUE_BASE_URL, STRIPE_SECRET } = process.env;
const stripe = require("stripe")(STRIPE_SECRET);
const { query } = require("../db");
const CustomError = require("../model/CustomError");
const registrationService = require("./registration");
const eventService = require("./event");
const ticketService = require("./ticket");
const productService = require("./product");
const emailService = require("./email");
const tempRegistrationService = require("./tempRegistration");
const orderService = require("./order");
const { v4: uuidv4 } = require("uuid");
const { defaultCurrency, getCurrencyMinorUnitRatio } = require("../utils/common");
const sponsorshipService = require("./sponsorship");
const attendeesService = require("./attendees");
const eventVisitorService = require("./eventVisitor");

exports.createProduct = async ({ payload }) => {
    const createdProduct = await stripe.products.create(payload);
    return createdProduct;
};

exports.updateProduct = async ({ id, payload }) => {
    const updatedProduct = await stripe.products.update(id, payload);
    return updatedProduct;
};

exports.deleteProduct = async ({ id }) => {
    const deletedProduct = await stripe.products.del(id);
    return deletedProduct;
};

exports.retrieveProduct = async ({ id }) => {
    const retrievedProduct = await stripe.products.retrieve(id);
    return retrievedProduct;
};

exports.createPrice = async ({ payload }) => {
    const createdPrice = await stripe.prices.create(payload);
    return createdPrice;
};

exports.updatePrice = async ({ id, payload }) => {
    const updatedPrice = await stripe.prices.update(id, payload);
    return updatedPrice;
};

exports.createProductPrice = async ({ product, price }) => {
    //create stripe product
    const insertedProduct = await exports.createProduct({
        payload: product,
    });
    price.product = insertedProduct.id;
    //create stripe price
    const insertedPrice = await exports.createPrice({
        payload: price,
    });
    return { insertedProduct, insertedPrice };
};
// Get registration data from payment intent metadata
exports.getRegistrationFromPaymentIntentMetadata = async (paymentIntentId) => {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Handle new temporary storage approach
    if (paymentIntent.metadata.sessionId) {
        try {
            // Retrieve temporary registration data
            const sessionData = await tempRegistrationService.getTempRegistration(
                paymentIntent.metadata.sessionId,
            );

            if (!sessionData) {
                console.error(
                    "No temporary registration data found for session:",
                    paymentIntent.metadata.sessionId,
                );
                throw new CustomError(
                    "No registration data found in payment intent",
                    400,
                );
            }

            // Get event data to access currency
            const event = await eventService.getEventById({ eventId: sessionData.eventId });
            if (!event) {
                throw new CustomError("Event not found", 404);
            }

            if (
                !sessionData.attendees ||
                !Array.isArray(sessionData.attendees) ||
                sessionData.attendees.length === 0
            ) {
                throw new CustomError("Invalid attendees data structure", 400);
            }

            // Create registration record
            const registrationResult = await registrationService.save({
                eventId: sessionData.eventId,
                organizationId: sessionData.organizationId,
                additionalFields: {}, // Empty for now, can be enhanced later
                userTimezone: sessionData.registration?.userTimezone,
                timezoneOffset: sessionData.registration?.timezoneOffset,
            });

            // Save all attendees at once
            const attendees = sessionData.attendees;

            const savedAttendees = await attendeesService.createAttendees({
                registrationId: registrationResult.id,
                attendees: attendees,
                additionalFields: {},
            });

            // Create order record
            const orderNumber = sessionData.orders?.order_number || orderService.generateOrderNumber();
            const totalAmount = sessionData.orders?.total_amount || Math.round(paymentIntent.amount);

            const orderResult = await orderService.save({
                payload: {
                    ...(sessionData.orders || {}),
                    orderNumber,
                    totalAmount,
                    currency: event.currency,
                    paymentStatus: "paid",
                    stripePaymentIntentId: paymentIntentId,
                    itemsTicket: sessionData.selectedTickets,
                    itemsProduct: sessionData.selectedProducts || [],
                    registrationId: registrationResult.id,
                    eventId: sessionData.eventId,
                    organizationId: sessionData.organizationId,
                },
            });

            // Update payment intent metadata with new data
            await stripe.paymentIntents.update(paymentIntentId, {
                metadata: {
                    registrationId: registrationResult.id.toString(),
                    qrUuid: savedAttendees[0]?.qrUuid || "",
                    orderId: orderResult.id.toString(),
                    orderNumber,
                    totalAmount: totalAmount.toString(),
                    eventId: sessionData.eventId.toString(),
                    organizationId: sessionData.organizationId.toString(),
                },
            });

            // Reduce ticket stock
            for (const item of sessionData.selectedTickets) {
                await ticketService.updateStock({
                    ticketId: item.ticketId,
                    quantity: item.quantity,
                });
            }

            // Reduce product stock
            const productService = require('./product');
            for (const item of sessionData.selectedProducts || []) {
                if (item.productId && item.quantity) {
                    await productService.updateStock({
                        productId: item.productId,
                        quantity: item.quantity,
                    });
                }
            }

            // Increase registration count in event
            await eventService.increaseRegistrationCount({
                eventId: sessionData.eventId,
            });

            // Mark visitor as converted (if they were a visitor)
            // Use primary attendee email to mark visitor as converted
            if (savedAttendees && savedAttendees.length > 0) {
                const primaryAttendee = savedAttendees.find(a => a.is_primary) || savedAttendees[0];
                if (primaryAttendee && primaryAttendee.email) {
                    try {
                        await eventVisitorService.markVisitorConverted({
                            eventId: sessionData.eventId,
                            email: primaryAttendee.email,
                        });
                    } catch (error) {
                        // Don't fail registration if visitor marking fails
                        console.warn(`Failed to mark visitor as converted:`, error);
                    }
                }
            }

            // Send confirmation emails to all attendees (async, don't wait)
            savedAttendees.forEach(async (attendee) => {
                emailService
                    .sendTicketsByRegistrationId({
                        registrationId: registrationResult.id,
                        attendeeId: attendee.id,
                    })
                    .catch((error) => {
                        console.error(`Failed to send email to ${attendee.email}:`, error);
                    });
            });

            // Note: Temporary data will be cleaned up by cronjob later
            // await tempRegistrationService.deleteTempRegistration(paymentIntent.metadata.sessionId);

            // Return the complete registration data with all attendees
            const result = {
                id: registrationResult.id,
                eventId: sessionData.eventId,
                organizationId: sessionData.organizationId,
                status: true,
                attendees: savedAttendees.map((attendee) => ({
                    id: attendee.id,
                    isPrimary: attendee.is_primary,
                    firstName: attendee.first_name,
                    lastName: attendee.last_name,
                    email: attendee.email,
                    phone: attendee.phone,
                    ticketId: attendee.ticket_id,
                    qrUuid: attendee.qr_uuid,
                })),
                orderId: orderResult.id,
                orderNumber: orderNumber,
                totalAmount: totalAmount,
                createdAt: registrationResult.createdAt,
                updatedAt: registrationResult.updatedAt,
            };

            return result;
        } catch (error) {
            console.error(
                "Error processing payment intent with temporary storage:",
                error,
            );
            if (error instanceof CustomError) {
                throw error;
            }
            throw new CustomError(
                `Failed to process registration from payment intent: ${error.message}`,
                500,
            );
        }
    }

    // Handle existing approach (fallback)
    if (!paymentIntent.metadata.registrationId) {
        throw new CustomError("No registration data found in payment intent", 400);
    }

    // Use metadata instead of database query since we have all the data we need
    const result = {
        id: parseInt(paymentIntent.metadata.registrationId),
        qrUuid: paymentIntent.metadata.qrUuid,
        status: true, // Payment succeeded, so status is true
        eventId: parseInt(paymentIntent.metadata.eventId),
        organizationId: parseInt(paymentIntent.metadata.organizationId),
    };

    return result;
};

exports.createPaymentIntent = async ({
    payload: { savedRegistration, savedExtrasPurchase, extrasIds },
}) => {
    const lineItems = [];
    let subtotal = 0;

    // Get event to get currency and tax configuration
    const event = await eventService.getEventById({
        eventId: savedRegistration.eventId,
    });
    const eventCurrency = event?.currency || 'USD';

    // Get event tickets price
    const tickets = await ticketService.getTicketsByEventId({
        eventId: savedRegistration.eventId,
    });
    const eventTicketPrice = tickets.length > 0 ? tickets[0].price : 0; // Assuming one ticket per event for registration
    if (eventTicketPrice > 0) {
        subtotal += eventTicketPrice;
    }

    // Get extras prices
    if (extrasIds?.length > 0) {
        const extras = await eventService.getExtrasByIds({ extrasIds });
        extras.forEach((item) => {
            if (item.price > 0) {
                subtotal += item.price;
            }
        });
    }

    if (subtotal <= 0) {
        return { clientSecret: "no-stripe" };
    }

    // Calculate tax if configured
    let totalAmount = subtotal;
    const taxType = event.taxType || event.tax_type;
    const taxAmountConfig = event.taxAmount || event.tax_amount;

    if (taxType && taxAmountConfig && subtotal > 0) {
        const type = taxType.toLowerCase();
        const amount = Number(taxAmountConfig);

        if (type === 'percent' && amount > 0) {
            const taxAmount = Math.round((subtotal * amount) / 100);
            totalAmount += taxAmount;
        } else if (type === 'fixed' && amount > 0) {
            // amount expected in cents
            totalAmount += Math.round(amount);
        }
    }

    // Create payment intent (tax already calculated manually above)
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount), // Total includes tax if configured
        currency: eventCurrency,
        metadata: {
            registrationId: savedRegistration.id,
            registrationUuid: savedRegistration.qrUuid,
            extrasPurchaseId: savedExtrasPurchase?.id,
            eventId: savedRegistration.eventId,
        },
    });

    return { clientSecret: paymentIntent.client_secret };
};

// Create secure payment intent with temporary storage
exports.createSecurePaymentIntent = async ({
    attendees,
    selectedTickets,
    selectedProducts,
    registration,
    sessionId: providedSessionId,
}) => {
    // Validate required data
    if (!attendees || !Array.isArray(attendees) || attendees.length === 0) {
        throw new CustomError("Missing required payment data", 400);
    }

    // Validate that at least tickets or products are selected
    if (
        (!selectedTickets || !Array.isArray(selectedTickets) || selectedTickets.length === 0) &&
        (!selectedProducts || !Array.isArray(selectedProducts) || selectedProducts.length === 0)
    ) {
        throw new CustomError("At least one ticket or product is required", 400);
    }

    if (!registration || !registration.eventId) {
        throw new CustomError("Registration data with event ID is required", 400);
    }

    // Validate each attendee
    for (const attendee of attendees) {
        if (
            !attendee.email ||
            !attendee.firstName ||
            !attendee.lastName ||
            !attendee.phone
        ) {
            throw new CustomError(
                "All attendees must have email, first name, last name, and phone",
                400,
            );
        }
    }

    // Check if any attendee already exists for this event
    for (const attendee of attendees) {
        const existingRegistration =
            await registrationService.getRegistrationByEmail({
                email: attendee.email,
                eventId: registration.eventId,
            });

        if (existingRegistration) {
            throw new CustomError(
                `Registration already exists for email: ${attendee.email}`,
                400,
            );
        }
    }

    try {
        // Use provided sessionId if available, otherwise generate a new one
        // This prevents duplicate entries when updating payment intent
        const sessionId = providedSessionId || uuidv4();

        // Get event data to access currency and config
        const event = await eventService.getEventById({ eventId: registration.eventId });
        if (!event) {
            throw new CustomError("Event not found", 404);
        }

        // Get max tickets per registration from event config
        const maxTicketsPerRegistration = event.config?.maxTicketsPerRegistration || 10;

        // Calculate total amount from backend prices
        let totalAmount = 0;
        const validatedItems = [];

        // Get tickets from database to validate prices
        const dbTickets = await ticketService.getTicketsByEventId({
            eventId: registration.eventId,
        });
        const ticketMap = new Map(dbTickets.map((ticket) => [ticket.id, ticket]));

        for (const frontendItem of selectedTickets) {
            const dbTicket = ticketMap.get(frontendItem.ticketId);

            if (!dbTicket) {
                throw new CustomError(`Ticket ${frontendItem.ticketId} not found`, 404);
            }

            // Validate quantity
            if (frontendItem.quantity <= 0 || frontendItem.quantity > maxTicketsPerRegistration) {
                throw new CustomError(
                    `Invalid quantity for ticket ${dbTicket.title}. Maximum ${maxTicketsPerRegistration} tickets allowed per registration.`,
                    400,
                );
            }

            // Validate stock availability
            if (dbTicket.currentStock < frontendItem.quantity) {
                throw new CustomError(`Insufficient stock for ${dbTicket.title}`, 400);
            }

            // Use backend price, not frontend price
            const itemTotal = dbTicket.price * frontendItem.quantity;
            totalAmount += itemTotal;

            validatedItems.push({
                ticketId: dbTicket.id,
                title: dbTicket.title,
                price: dbTicket.price,
                quantity: frontendItem.quantity,
            });
        }

        // Handle products if selected
        if (selectedProducts && selectedProducts.length > 0) {
            // Get products from database to validate prices
            const dbProducts = await productService.getEventProducts({
                eventId: registration.eventId,
            });
            const productMap = new Map(dbProducts.map((product) => [product.id, product]));

            for (const frontendItem of selectedProducts) {
                const dbProduct = productMap.get(frontendItem.productId);

                if (!dbProduct) {
                    throw new CustomError(`Product ${frontendItem.productId} not found`, 404);
                }

                // Validate quantity
                if (frontendItem.quantity <= 0 || frontendItem.quantity > dbProduct.stock) {
                    throw new CustomError(
                        `Invalid quantity for product ${dbProduct.name}. Maximum ${dbProduct.stock} items available.`,
                        400,
                    );
                }

                // Use backend price, not frontend price
                const itemTotal = dbProduct.price * frontendItem.quantity;
                totalAmount += itemTotal;

                validatedItems.push({
                    productId: dbProduct.id,
                    title: dbProduct.name, // Save name as title for consistency
                    price: dbProduct.price,
                    quantity: frontendItem.quantity,
                });
            }
        }

        const originalSubtotal = totalAmount;
        // Apply event-level tax if configured (from database columns)
        // Only apply tax if subtotal > 0
        if (totalAmount > 0) {
            const taxType = event.taxType
            const taxAmountConfig = event.taxAmount

            if (taxType && taxAmountConfig) {
                const type = taxType.toLowerCase();
                const amount = Number(taxAmountConfig);

                if (type === 'percent' && amount > 0) {
                    const taxAmount = Math.round((totalAmount * amount) / 100);
                    totalAmount += taxAmount;
                } else if (type === 'fixed' && amount > 0) {
                    // amount expected in cents
                    totalAmount += Math.round(amount);
                }
            }
        }

        // Validate amount
        if (totalAmount <= 0) {
            throw new CustomError("Invalid payment amount", 400);
        }
        const subtotal = originalSubtotal;
        let taxAmount = 0;
        if (event.config?.taxEnabled && event.config?.taxType && event.config?.taxAmount) {
            const type = event.config.taxType.toLowerCase();
            const amount = Number(event.config.taxAmount);
            if (type === 'percent') {
                taxAmount = Math.round((subtotal * amount) / 100);
            } else if (type === 'fixed') {
                taxAmount = Math.round(amount);
            }
        }

        // Create payment intent with session ID only
        const primaryAttendee = attendees && attendees.length > 0 ? attendees[0] : null;
        const receiptEmail = primaryAttendee ? primaryAttendee.email : null;

        // Scale amount for Stripe: Ticketi stores in virtual cents (1/100), Stripe wants actual minor units
        const stripeRatio = getCurrencyMinorUnitRatio(event.currency);
        const stripeAmount = Math.round(totalAmount * (stripeRatio / 100));

        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: event.currency.toLowerCase(),
            receipt_email: receiptEmail,
            automatic_payment_methods: {
                enabled: true,
            },
            metadata: {
                sessionId: sessionId,
                eventId: registration.eventId.toString(),
                paymentType: "paid", // Mark as paid registration
                taxAmount: taxAmount.toString()
            },
        });

        // Prepare order data for temp storage (without items array)
        const orders = {
            order_number: orderService.generateOrderNumber(),
            total_amount: totalAmount,
            currency: event.currency,
            payment_status: "pending",
            stripe_payment_intent_id: paymentIntent.id,
            subtotal: subtotal,
            tax_amount: taxAmount,
            shipping_cost: 0,
            registration_id: null,
            event_id: registration.eventId,
        };

        // Store attendee data temporarily with prepared order data
        await tempRegistrationService.storeTempRegistration({
            sessionId,
            attendees,
            registration,
            selectedTickets,
            selectedProducts,
            orders, // Add prepared order data with stripePaymentIntentId
            eventId: registration.eventId,
        });

        return {
            paymentIntent,
            totalAmount,
            sessionId,
        };
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }

        console.error("Error in createSecurePaymentIntent:", error);
        throw new CustomError(`Failed to create secure payment intent: ${error.message}`, 500);
    }
};

// Create PaymentIntent with base amount (no shipping yet)
exports.createPaymentIntentWithShipping = async ({
    amount,
    currency,
    attendees,
    selectedTickets,
    selectedProducts,
    registration,
    shippingOption,
    eventId,
    shippingAddress,
    sessionId: providedSessionId,
}) => {
    try {
        // Use provided sessionId if available, otherwise generate a new one
        // This prevents duplicate entries when updating payment intent
        const sessionId = providedSessionId || uuidv4();

        // Compute shipping cost and final total if shipping info provided
        let finalAmount = Math.round(amount);
        let meta = {
            type: 'shipping_payment',
            baseAmount: String(Math.round(amount)),
            sessionId: sessionId,
        };

        if (shippingOption && eventId) {
            const event = await eventService.getEventById({ eventId });
            let shippingCost = 0;

            // Use new shippingFee from event config if available
            if (event?.config?.shippingFee !== undefined && shippingOption === 'delivery') {
                // Convert from major currency units to minor units (cents)
                const currency = event.currency?.toLowerCase() || 'usd';
                const majorToMinorRatio = getCurrencyMinorUnitRatio(currency);
                shippingCost = Math.round(event.config.shippingFee * majorToMinorRatio);
            } else {
                // Fallback to old shippingRates structure for backward compatibility
                const defaultShippingRates = { delivery: 500, pickup: 0 };
                const shippingRates = event?.config?.shippingRates || defaultShippingRates;
                shippingCost = shippingRates[shippingOption] || 0;
            }

            finalAmount = Math.round(amount) + shippingCost;
            meta.shippingOption = shippingOption;
            meta.shippingCost = String(shippingCost);
            meta.totalAmount = String(finalAmount);
            if (shippingAddress) {
                meta.shippingAddress = JSON.stringify(shippingAddress);
            }
        } else {
            // default metadata when shipping not yet chosen
            meta.shippingOption = 'pickup';
            meta.shippingCost = '0';
        }

        const primaryAttendee = attendees && attendees.length > 0 ? attendees[0] : null;
        let receiptEmail = primaryAttendee ? primaryAttendee.email : null;

        // Validating email format basic check
        if (!receiptEmail || !receiptEmail.includes('@')) {
            receiptEmail = undefined;
        }

        // Scale amount for Stripe: Ticketi stores in virtual cents (1/100), Stripe wants actual minor units
        const stripeRatio = getCurrencyMinorUnitRatio(currency);
        const stripeAmount = Math.round(finalAmount * (stripeRatio / 100));

        const paymentIntent = await stripe.paymentIntents.create({
            amount: stripeAmount,
            currency: currency.toLowerCase(),
            receipt_email: receiptEmail,
            automatic_payment_methods: { enabled: true },
            metadata: meta,
        });

        // Store temporary registration data (similar to createSecurePaymentIntent)
        if (attendees && selectedTickets && registration) {
            // Get event data
            const event = await eventService.getEventById({
                eventId: registration.eventId,
            });

            if (!event) {
                throw new CustomError("Event not found", 404);
            }

            // Validate stock for tickets
            if (selectedTickets && selectedTickets.length > 0) {
                const dbTickets = await ticketService.getTicketsByEventId({
                    eventId: registration.eventId,
                });
                const ticketMap = new Map(dbTickets.map((ticket) => [ticket.id, ticket]));

                for (const ticketItem of selectedTickets) {
                    const dbTicket = ticketMap.get(ticketItem.ticketId);
                    if (!dbTicket) {
                        throw new CustomError(`Ticket ${ticketItem.ticketId} not found`, 404);
                    }
                    // Validate stock availability respecting on-site quota for online sales
                    const availableForOnline = dbTicket.currentStock - (dbTicket.onSiteQuota || 0);
                    if (availableForOnline < ticketItem.quantity) {
                        throw new CustomError(`Insufficient online stock for ${dbTicket.title}. Only ${Math.max(0, availableForOnline)} available.`, 400);
                    }
                }
            }

            // Validate stock for products
            if (selectedProducts && selectedProducts.length > 0 && Array.isArray(selectedProducts)) {
                const dbProducts = await productService.getEventProducts({
                    eventId: registration.eventId,
                });
                const productMap = new Map(dbProducts.map((product) => [product.id, product]));

                for (const productItem of selectedProducts) {
                    const dbProduct = productMap.get(productItem.productId);
                    if (!dbProduct) {
                        throw new CustomError(`Product ${productItem.productId} not found`, 404);
                    }
                    // Validate stock availability
                    if (dbProduct.stock < productItem.quantity) {
                        throw new CustomError(`Insufficient stock for ${dbProduct.name}. Only ${dbProduct.stock} available.`, 400);
                    }
                }
            }

            // Prepare order data for temp storage
            const orders = {
                orderNumber: orderService.generateOrderNumber(),
                totalAmount: finalAmount,
                currency: event.currency,
                paymentStatus: "pending",
                stripePaymentIntentId: paymentIntent.id,
                subtotal: Math.round(amount),
                shippingCost: meta.shippingCost ? parseInt(meta.shippingCost) : 0,
                taxAmount: 0,
                registrationId: null, // Will be set after registration creation
                eventId: registration.eventId,
            };

            // Store attendee data temporarily
            await tempRegistrationService.storeTempRegistration({
                sessionId,
                attendees,
                registration,
                selectedTickets,
                selectedProducts,
                orders,
                eventId: registration.eventId,
            });
        }

        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
            sessionId: sessionId
        };
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }
        throw new CustomError(`Failed to create payment intent: ${error.message}`, 400);
    }
};

// Update PaymentIntent flexibly: update amount only, or include shipping details if provided
exports.updatePaymentIntentWithShipping = async ({
    paymentIntentId,
    baseAmount,
    shippingOption,
    eventId,
    shippingAddress
}) => {
    try {
        let updateParams = {};
        let response = { clientSecret: undefined, shippingCost: undefined, totalAmount: undefined };

        // If only amount is provided (no shippingOption/eventId), update amount only
        if (typeof baseAmount === 'number' && (!shippingOption || !eventId)) {
            updateParams.amount = Math.round(baseAmount);
        }

        // If shipping info is provided, compute shipping cost and total
        if (typeof baseAmount === 'number' && shippingOption && eventId) {
            const event = await eventService.getEventById({ eventId });
            const defaultShippingRates = { delivery: 500, pickup: 0 };
            const shippingRates = event?.config?.shippingRates || defaultShippingRates;
            const shippingCost = shippingRates[shippingOption] || 0;
            const totalAmount = Math.round(baseAmount) + shippingCost;

            updateParams.amount = totalAmount;
            updateParams.metadata = {
                type: 'shipping_payment',
                baseAmount: String(baseAmount),
                shippingOption: shippingOption,
                shippingCost: String(shippingCost),
                totalAmount: String(totalAmount),
            };
            if (shippingAddress) {
                updateParams.metadata.shippingAddress = JSON.stringify(shippingAddress);
            }

            response.shippingCost = shippingCost;
            response.totalAmount = totalAmount;
        }

        // If nothing to update, just fetch to return client secret
        const paymentIntent = Object.keys(updateParams).length
            ? await stripe.paymentIntents.update(paymentIntentId, updateParams)
            : await stripe.paymentIntents.retrieve(paymentIntentId);

        response.clientSecret = paymentIntent.client_secret;
        if (response.totalAmount === undefined && typeof baseAmount === 'number' && (!shippingOption || !eventId)) {
            response.totalAmount = Math.round(baseAmount);
        }

        return response;
    } catch (error) {
        throw new CustomError(`Failed to update payment intent: ${error.message}`, 400);
    }
};

// Update temp_registration.orders flexibly by merging provided fields while preserving existing keys
// Accepts optional fields and maps them into orders JSON (snake_case keys)
exports.updateTempRegistrationOrders = async ({
    sessionId,
    // financials
    shippingCost,
    totalAmount,
    baseAmount, // used as subtotal if provided
    taxAmount,
    // identifiers / status
    orderNumber,
    currency,
    paymentStatus,
    stripePaymentIntentId,
    productStatus,
    // items
    itemsTicket,
    itemsProduct,
    // shipping
    shippingAddress,
    shippingType,
    // promo/discount
    promoCode,
    discountAmount,
}) => {
    try {
        const tempRegistrationService = require('./tempRegistration');

        // Get current temp registration data
        const tempReg = await tempRegistrationService.getTempRegistration(sessionId);

        if (!tempReg || !tempReg.orders) {
            throw new CustomError("Temp registration or orders not found", 404);
        }

        const existing = tempReg.orders || {};
        const updatedOrders = { ...existing };

        // Merge identifiers / status if provided
        if (orderNumber !== undefined) updatedOrders.order_number = orderNumber;
        if (currency !== undefined) updatedOrders.currency = currency;
        if (paymentStatus !== undefined) updatedOrders.payment_status = paymentStatus;
        if (stripePaymentIntentId !== undefined) updatedOrders.stripe_payment_intent_id = stripePaymentIntentId;
        if (productStatus !== undefined) updatedOrders.product_status = productStatus;

        // Merge items if provided
        if (itemsTicket !== undefined) updatedOrders.items_ticket = itemsTicket;
        if (itemsProduct !== undefined) updatedOrders.items_product = itemsProduct;

        // Merge shipping if provided
        if (shippingCost !== undefined) updatedOrders.shipping_cost = shippingCost;
        if (shippingAddress !== undefined) updatedOrders.shipping_address = shippingAddress; // expected to be JSON object
        if (shippingType !== undefined) updatedOrders.shipping_type = shippingType;

        // Merge financials
        if (baseAmount !== undefined) updatedOrders.subtotal = baseAmount;
        if (totalAmount !== undefined) updatedOrders.total_amount = totalAmount;
        if (discountAmount !== undefined) updatedOrders.discount_amount = discountAmount;
        if (promoCode !== undefined) updatedOrders.promo_code = promoCode;

        // Compute or set tax amount
        if (taxAmount !== undefined) {
            updatedOrders.tax_amount = taxAmount;
        } else if (
            typeof updatedOrders.total_amount === 'number' &&
            typeof updatedOrders.subtotal === 'number'
        ) {
            const sc = typeof updatedOrders.shipping_cost === 'number' ? updatedOrders.shipping_cost : 0;
            updatedOrders.tax_amount = updatedOrders.total_amount - updatedOrders.subtotal - sc;
        }

        // Update temp_registration.orders column
        const { query } = require('../db');
        const updateSql = `
            UPDATE temp_registration
            SET orders = $1
            WHERE session_id = $2
        `;

        await query(updateSql, [JSON.stringify(updatedOrders), sessionId]);

        return updatedOrders;
    } catch (error) {
        console.error("Error updating temp registration orders:", error);
        throw error;
    }
};

exports.webhook = async (req) => {
    let data;
    let eventType;
    const isDev = process.env.NODE_ENV !== "production";
    // Check if webhook signing is configured.
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!isDev && !webhookSecret) {
        throw new CustomError("Missing STRIPE_WEBHOOK_SECRET in production", 500);
    }
    if (webhookSecret) {
        // Retrieve the event by verifying the signature using the raw body and secret.
        let event;
        let signature = req.headers["stripe-signature"];

        try {
            event = stripe.webhooks.constructEvent(
                req.body,
                signature,
                webhookSecret,
            );
        } catch (err) {
            throw new CustomError(err.message, 400, err);
        }
        // Extract the object from the event.
        data = event.data;
        eventType = event.type;
    } else if (isDev) {
        // Webhook signing is recommended, but if the secret is not configured in `config.js`,
        // retrieve the event data directly from the request body.
        data = req.body.data;
        eventType = req.body.type;
    } else {
        throw new CustomError(
            "Invalid webhook configuration. Check environment and STRIPE_WEBHOOK_SECRET.",
            500,
        );
    }

    let responseMsg = "";
    switch (eventType) {
        // payment intent succeeded
        case "payment_intent.succeeded":
            const paymentIntentSucceeded = data.object;

            // Validate metadata types - ensure all values are strings
            const metadata = paymentIntentSucceeded.metadata;
            for (const [key, value] of Object.entries(metadata)) {
                if (typeof value !== "string") {
                    // Skip processing this payment intent if metadata is invalid
                    responseMsg = `Invalid metadata type for key ${key}`;
                    break;
                }
            }

            if (responseMsg) {
                break;
            }

            // Handle new temporary storage approach
            if (paymentIntentSucceeded.metadata.sessionId) {
                // Check if this payment has already been processed (idempotency)
                if (paymentIntentSucceeded.metadata.processed === "true") {
                    responseMsg = "Payment already processed";
                    break;
                }

                // Check if this is a free registration that was already processed
                if (paymentIntentSucceeded.metadata.paymentType === "free") {
                    responseMsg = "Free registration already processed by frontend";
                    break;
                }
                try {
                    // Retrieve and destructure temporary registration data
                    let sessionData;
                    try {
                        sessionData = await tempRegistrationService.getTempRegistration(
                            paymentIntentSucceeded.metadata.sessionId,
                        );
                    } catch (tempRegError) {
                        // If temp registration is missing/expired, check if payment was already processed
                        if (paymentIntentSucceeded.metadata.registrationId) {
                            // Payment already processed, registration exists - this is a retry, skip
                            console.log(
                                `[Webhook] Temp registration expired but payment already processed (registrationId: ${paymentIntentSucceeded.metadata.registrationId}). Skipping.`
                            );
                            responseMsg = "Payment already processed (temp registration expired)";
                            break;
                        }
                        // Temp registration missing and payment not processed - this is an error
                        console.error(
                            "No temporary registration data found for session:",
                            paymentIntentSucceeded.metadata.sessionId,
                            tempRegError
                        );
                        throw new CustomError(
                            "No registration data found in payment intent",
                            400,
                        );
                    }

                    if (!sessionData) {
                        console.error(
                            "No temporary registration data found for session:",
                            paymentIntentSucceeded.metadata.sessionId,
                        );
                        throw new CustomError(
                            "No registration data found in payment intent",
                            400,
                        );
                    }

                    // Destructure all table data from temp registration
                    const { attendees, registration, selectedTickets, selectedProducts, orders, eventId } =
                        sessionData;

                    // Get event data to access currency
                    const event = await eventService.getEventById({ eventId });
                    if (!event) {
                        throw new CustomError("Event not found", 404);
                    }

                    // Validate attendees data
                    if (
                        !attendees ||
                        !Array.isArray(attendees) ||
                        attendees.length === 0
                    ) {
                        throw new CustomError("Invalid attendees data structure", 400);
                    }

                    // Check if this payment intent has already been processed (idempotency check)
                    // 1. Check for existing order with this payment intent ID
                    const existingOrderCheck = await query(
                        `SELECT id, registration_id FROM orders WHERE stripe_payment_intent_id = $1 LIMIT 1`,
                        [paymentIntentSucceeded.id]
                    );

                    if (existingOrderCheck.rows.length > 0) {
                        // Payment already processed - this is a retry, skip gracefully
                        const existingOrder = existingOrderCheck.rows[0];
                        console.log(
                            `[Webhook] Payment intent ${paymentIntentSucceeded.id} already processed. Order ID: ${existingOrder.id}, Registration ID: ${existingOrder.registrationId}. Skipping.`
                        );
                        responseMsg = `Payment already processed (order ID: ${existingOrder.id})`;
                        break;
                    }

                    // 2. Check if attendees with this sessionId already exist (prevent duplicates)
                    const existingAttendeesCheck = await query(
                        `SELECT id, registration_id FROM attendees WHERE session_id = $1 LIMIT 1`,
                        [paymentIntentSucceeded.metadata.sessionId]
                    );

                    if (existingAttendeesCheck.rows.length > 0) {
                        // Attendees already created for this session - this is a retry, skip gracefully
                        const existingAttendee = existingAttendeesCheck.rows[0];
                        console.log(
                            `[Webhook] Attendees already exist for session ${paymentIntentSucceeded.metadata.sessionId}. Attendee ID: ${existingAttendee.id}, Registration ID: ${existingAttendee.registrationId}. Skipping.`
                        );
                        responseMsg = `Registration already processed (attendees exist for this session)`;
                        break;
                    }

                    // 1. Save registration first with timezone data
                    const registrationResult = await registrationService.save({
                        eventId: eventId,
                        status: true,
                        additionalFields: registration?.additionalFields || {},
                        userTimezone: registration?.userTimezone || 'UTC',
                        timezoneOffset: registration?.timezoneOffset || 0,
                    });

                    // 2. Update attendees with registration_id and save
                    const attendeesWithRegistrationId = attendees.map((attendee) => ({
                        ...attendee,
                        registrationId: registrationResult.id,
                        sessionId: paymentIntentSucceeded.metadata.sessionId,
                    }));
                    const savedAttendees = await attendeesService.createAttendees({
                        registrationId: registrationResult.id,
                        attendees: attendeesWithRegistrationId,
                    });

                    // 3. Update orders data with registrationId and save
                    let orderResult;
                    if (orders) {
                        // Extract shipping information from payment intent metadata
                        const shippingCost = parseInt(paymentIntentSucceeded.metadata.shippingCost || '0');
                        const shippingType = paymentIntentSucceeded.metadata.shippingOption || 'pickup';

                        // Extract shipping address from Stripe PaymentIntent (where it's stored when confirmPayment is called)
                        // This is more reliable than metadata since Stripe handles the address validation
                        let shippingAddress = null;
                        if (paymentIntentSucceeded.shipping && paymentIntentSucceeded.shipping.address) {
                            shippingAddress = paymentIntentSucceeded.shipping.address;
                        } else if (paymentIntentSucceeded.metadata.shippingAddress) {
                            // Fallback to metadata if available
                            try {
                                shippingAddress = JSON.parse(paymentIntentSucceeded.metadata.shippingAddress);
                            } catch (error) {
                                console.warn('Failed to parse shipping address from metadata:', error);
                            }
                        }

                        // Use prepared orders data with proper separation
                        const orderData = {
                            ...orders,
                            itemsTicket: selectedTickets, // Only tickets go to items_ticket
                            itemsProduct: selectedProducts, // Only products go to items_product
                            registrationId: registrationResult.id,
                            paymentStatus: "paid",
                            shippingCost: shippingCost,
                            shippingAddress: shippingAddress,
                            shippingType: shippingType,
                        };

                        orderResult = await orderService.save({
                            payload: orderData,
                        });
                    } else {

                        // Recalculate or use metadata
                        const totalAmount = Math.round(paymentIntentSucceeded.amount);

                        // Extract shipping information from payment intent metadata
                        const shippingCost = parseInt(paymentIntentSucceeded.metadata.shippingCost || '0');
                        const shippingType = paymentIntentSucceeded.metadata.shippingOption || 'pickup';
                        const taxAmount = parseInt(paymentIntentSucceeded.metadata.taxAmount || '0');
                        const promoCode = paymentIntentSucceeded.metadata.promoCode || null;
                        const discountAmount = parseInt(paymentIntentSucceeded.metadata.discountAmount || '0');

                        // Extract shipping address from Stripe PaymentIntent (where it's stored when confirmPayment is called)
                        let shippingAddress = null;
                        if (paymentIntentSucceeded.shipping && paymentIntentSucceeded.shipping.address) {
                            shippingAddress = paymentIntentSucceeded.shipping.address;
                        } else if (paymentIntentSucceeded.metadata.shippingAddress) {
                            try {
                                shippingAddress = JSON.parse(paymentIntentSucceeded.metadata.shippingAddress);
                            } catch (error) {
                                console.warn('Failed to parse shipping address from metadata:', error);
                            }
                        }

                        const orderData = {
                            orderNumber: orderService.generateOrderNumber(),
                            totalAmount: totalAmount,
                            currency: event.currency,
                            paymentStatus: "paid",
                            stripePaymentIntentId: paymentIntentSucceeded.id,
                            itemsTicket: selectedTickets, // Only tickets
                            itemsProduct: selectedProducts, // Only products
                            productStatus: "pending",
                            registrationId: registrationResult.id,
                            eventId: eventId,
                            shippingCost: shippingCost,
                            shippingAddress: shippingAddress,
                            shippingType: shippingType,
                            taxAmount,
                            promoCode,
                            discountAmount
                        };

                        orderResult = await orderService.save({
                            payload: orderData,
                        });
                    }

                    // Update payment intent metadata with new data
                    // Note: Temp registration already expires in 7 days, no need to extend
                    await stripe.paymentIntents.update(paymentIntentSucceeded.id, {
                        metadata: {
                            registrationId: registrationResult.id.toString(),
                            qrUuid: savedAttendees[0]?.qrUuid || "",
                            orderId: orderResult.id.toString(),
                            orderNumber: orderResult.orderNumber,
                            totalAmount: orderResult.totalAmount,
                            eventId: eventId.toString(),
                            processed: "true", // Mark as processed
                        },
                    });

                    // Reduce ticket stock using selectedTickets directly
                    for (const item of selectedTickets || []) {
                        if (item.ticketId && item.quantity) {
                            await ticketService.updateStock({
                                ticketId: item.ticketId,
                                quantity: item.quantity,
                                salesChannel: "online"
                            });
                        }
                    }

                    // Reduce product stock using selectedProducts directly
                    const productService = require('./product');
                    for (const item of selectedProducts || []) {
                        if (item.productId && item.quantity) {
                            try {
                                await productService.updateStock({
                                    productId: item.productId,
                                    quantity: item.quantity,
                                });
                            } catch (stockError) {
                                console.error(`Failed to reduce stock for product ${item.productId}:`, stockError);
                                // Log error but don't fail the entire payment - stock issue can be handled manually
                                // The order is already created and payment is successful
                            }
                        }
                    }

                    // Increase registration count in event
                    await eventService.increaseRegistrationCount({
                        eventId: eventId,
                    });

                    // Mark visitor as converted (if they were a visitor)
                    // Use primary attendee email to mark visitor as converted
                    if (savedAttendees && savedAttendees.length > 0) {
                        const primaryAttendee = savedAttendees.find(a => a.is_primary) || savedAttendees[0];
                        if (primaryAttendee && primaryAttendee.email) {
                            try {
                                await eventVisitorService.markVisitorConverted({
                                    eventId: eventId,
                                    email: primaryAttendee.email,
                                });
                            } catch (error) {
                                // Don't fail registration if visitor marking fails
                                console.warn(`Failed to mark visitor as converted:`, error);
                            }
                        }
                    }

                    // Send confirmation emails to all attendees (async, don't wait)
                    emailService
                        .sendTicketsByRegistrationId({
                            registrationId: registrationResult.id,
                        })
                        .catch((error) => {
                            console.error(
                                `Failed to send emails for registration ${registrationResult.id}:`,
                                error,
                            );
                        });

                    // Don't delete temp registration immediately - keep it for success page retrieval
                    // It will be cleaned up by the cronjob after 7 days (expires_at < NOW())                    
                } catch (error) {
                    console.error(
                        "Error processing payment intent with temporary storage:",
                        error,
                    );
                    // LOG FULL STACK TRACE FOR DEBUGGING
                    if (error.stack) {
                        console.error("WEBHOOK ERROR STACK:", error.stack);
                    }
                    if (error instanceof CustomError) {
                        throw error;
                    }
                    throw new CustomError(
                        `Failed to process registration from payment intent: ${error.message}`,
                        500,
                    );
                }
            }

            // Handle sponsorship payment
            if (paymentIntentSucceeded.metadata.type === "sponsorship") {
                // For new sponsorship flow, we need to create the sponsorship record
                // The frontend will handle this after successful payment
            }

            // Handle extras-only payment
            if (paymentIntentSucceeded.metadata.type === "extras") {
                const extrasIds = JSON.parse(paymentIntentSucceeded.metadata.extrasIds);
                const registrationId = paymentIntentSucceeded.metadata.registrationId;

                // Create extras purchase record
                await eventService.saveExtrasPurchase({
                    extrasIds: extrasIds,
                    registrationId: registrationId,
                    status: true,
                });

                // Send confirmation email (async, don't wait)
                emailService
                    .sendTicketsByRegistrationId({
                        registrationId: registrationId,
                    })
                    .catch((error) => {
                        console.error("Failed to send email for extras payment:", error);
                    });
            }

            responseMsg = "Payment successful!";
            break;

        // fired immediately when customer cancel subscription
        case "customer.subscription.updated":
            break;

        // fired at end of period when subscription expired
        case "customer.subscription.deleted":
            break;

        // subscription auto renewal succeeded
        case "invoice.paid":
            break;

        // subscription auto renewal failed
        case "invoice.payment_failed":
            break;

        // ... handle other event types
        default:
            console.error(`Unhandled event type ${eventType}`);
    }

    return responseMsg;
};

// Check payment status and get processed registration data
exports.checkPaymentStatus = async ({ paymentIntent }) => {
    if (!paymentIntent) {
        throw new CustomError("Payment intent ID required", 400);
    }

    try {
        // Get payment intent from Stripe
        const stripePaymentIntent =
            await stripe.paymentIntents.retrieve(paymentIntent);

        // Check if payment has been processed by webhook
        if (
            stripePaymentIntent.metadata.processed === "true" &&
            stripePaymentIntent.metadata.registrationId
        ) {
            // Get registration data from database
            const registration = await registrationService.getRegistrationById({
                registrationId: stripePaymentIntent.metadata.registrationId,
            });

            if (!registration) {
                throw new CustomError("Registration not found", 404);
            }

            return {
                processed: true,
                registrationId: registration.id,
                eventId: registration.eventId,
                organizationId: registration.organizationId,
                status: registration.status,
                attendees: registration.attendees || [],
                orderId: stripePaymentIntent.metadata.orderId,
                orderNumber: stripePaymentIntent.metadata.orderNumber,
                totalAmount: stripePaymentIntent.metadata.totalAmount,
            };
        } else {
            // Payment not yet processed
            return {
                processed: false,
                message: "Payment is being processed",
            };
        }
    } catch (error) {
        if (error instanceof CustomError) {
            throw error;
        }
        throw new CustomError("Failed to check payment status", 500);
    }
};

exports.createExtrasPaymentIntent = async ({
    payload: { extrasIds, registrationId, customerEmail, eventId },
}) => {
    // Get event currency and tax configuration
    const event = await eventService.getEventById({
        eventId: eventId,
    });
    const eventCurrency = event?.currency || 'USD';

    // Get extras prices
    const extras = await eventService.getExtrasByIds({ extrasIds });
    let subtotal = 0;

    extras.forEach((item) => {
        if (item.price > 0) {
            subtotal += item.price;
        }
    });

    if (subtotal <= 0) {
        return { clientSecret: "no-stripe" };
    }

    // Calculate tax if configured
    let totalAmount = subtotal;
    const taxType = event.taxType || event.tax_type;
    const taxAmountConfig = event.taxAmount || event.tax_amount;

    if (taxType && taxAmountConfig && subtotal > 0) {
        const type = taxType.toLowerCase();
        const amount = Number(taxAmountConfig);

        if (type === 'percent' && amount > 0) {
            const taxAmount = Math.round((subtotal * amount) / 100);
            totalAmount += taxAmount;
        } else if (type === 'fixed' && amount > 0) {
            // amount expected in cents
            totalAmount += Math.round(amount);
        }
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Convert to cents
        currency: eventCurrency,
        receipt_email: customerEmail,
        metadata: {
            registrationId: registrationId,
            extrasIds: extrasIds,
            eventId: eventId,
            type: "extras",
        },
    });

    return { clientSecret: paymentIntent.client_secret };
};

// Create extras payment intent with validation
exports.createExtrasPaymentIntentWithValidation = async (payload) => {
    const { extrasIds, registrationId, customerEmail, eventId } = payload;

    // Validate inputs
    if (!extrasIds || !Array.isArray(extrasIds) || extrasIds.length === 0) {
        throw new CustomError("Extras IDs are required", 400);
    }
    if (!registrationId) {
        throw new CustomError("Registration ID is required", 400);
    }
    if (!customerEmail) {
        throw new CustomError("Customer email is required", 400);
    }
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    // Create Stripe payment intent
    const { clientSecret } = await exports.createExtrasPaymentIntent({
        payload: {
            extrasIds,
            registrationId,
            customerEmail,
            eventId,
        },
    });

    return { clientSecret };
};

// Create sponsorship payment intent
exports.createSponsorshipPaymentIntent = async ({
    packageId,
    amount,
    currency,
    sponsorEmail,
    eventId,
}) => {
    if (amount <= 0) {
        return { clientSecret: "no-stripe" };
    }

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        receipt_email: sponsorEmail,
        metadata: {
            packageId: packageId,
            eventId: eventId,
            type: "sponsorship",
        },
        automatic_payment_methods: {
            enabled: true,
        },
    });

    return { clientSecret: paymentIntent.client_secret };
};
exports.applyPromoCode = async ({ paymentIntentId, promoCode, sessionId, eventId }) => {
    const promoCodeService = require("./promoCode");
    const tempRegistrationService = require('./tempRegistration');

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
        discountAmount = dV; // Fixed amount in cents or free (0)
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    // 4. Recalculate Tax based on discounted subtotal
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
    if (isNaN(newTotal)) {
        console.error("Nan calculation error info:", { netSubtotal, newTaxAmount, shippingCost, subtotal, discountAmount, dT, dV });
        throw new CustomError("Invalid calculation for total amount", 500);
    }

    // 5. Update Stripe Payment Intent
    await stripe.paymentIntents.update(paymentIntentId, {
        amount: Math.round(newTotal),
        metadata: {
            promoCode: promoCode.toUpperCase(),
            discountAmount: discountAmount.toString(),
            netSubtotal: netSubtotal.toString(),
            taxAmount: newTaxAmount.toString(),
            totalAmount: Math.round(newTotal).toString()
        }
    });

    // 6. Update temp_registration orders with discount info
    await exports.updateTempRegistrationOrders({
        sessionId,
        totalAmount: newTotal,
        taxAmount: newTaxAmount,
        discountAmount,
        promoCode: promoCode.toUpperCase()
    });

    return {
        discountAmount,
        newTaxAmount,
        newTotal,
        promoCode: validatedPromo.code,
        discountType: validatedPromo.discount_type,
        discountValue: validatedPromo.discount_value
    };
};
