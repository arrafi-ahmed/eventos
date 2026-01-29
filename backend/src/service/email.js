const handlebars = require("handlebars");
const fs = require("fs");
const path = require("path");
const { generateQrCode, appInfo, generateQrData } = require("../utils/common");
const { formatTime } = require("../utils/common");
const {
    formatInTimezone,
    formatLongDate,
    formatEventDateTimeRange,
    getTimezoneAbbreviation,
} = require("../utils/date");
const {
    isGroupTicket,
    getQrMessage,
    getEmailSubject,
    isRegistrantDetails,
} = require("../utils/ticket");
const { createTransport } = require("nodemailer");
const registrationService = require("./registration");
const CustomError = require("../model/CustomError");
const attendeesService = require("./attendees");
const { query } = require("../db");

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, VUE_BASE_URL } = process.env;
const SENDER_EMAIL = process.env.SENDER_EMAIL || process.env.SMTP_USER || "support@ticketi.com";
const SENDER_NAME = process.env.SENDER_NAME || process.env.EMAIL_SENDER || "Ticketi";

// Only create transporter if SMTP credentials are provided
let transporter = null;
if (SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS) {
    transporter = createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: true,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
    });
}
const processAttachments = async (attachments = []) => {
    const result = [];

    for (const attachment of attachments) {
        if (attachment?.type === "qrcode") {
            result.push({
                filename: attachment.filename || "qrcode.png",
                content: attachment.content,
                cid: attachment.cid || "attachmentQrCode", // must match src="cid:attachmentQrCode"
                encoding: attachment.encoding || "base64",
            });
        } else if (attachment?.type === "pdf") {
            result.push({
                filename: attachment.filename || "attachment.pdf",
                content: Buffer.from(attachment.content.output(), "binary"),
            });
        } else {
            result.push(attachment); // add as-is if not QR
        }
    }
    return result;
};

const { getBrandingData } = require("../utils/branding");

exports.sendMail = async ({ to, subject, html, attachments }) => {
    // If no SMTP configuration, log the email instead of sending
    if (!transporter) {
        return { messageId: "mock-message-id" };
    }

    const mailOptions = {
        from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
        to,
        // bcc: '',
        subject,
        html,
        attachments: attachments?.length
            ? await processAttachments(attachments)
            : [],
    };
    return transporter.sendMail(mailOptions);
};

const emailTemplatePath = path.join(
    __dirname,
    "..",
    "templates",
    "eventTicketEmail.html",
);
const emailTemplateSource = fs.readFileSync(emailTemplatePath, "utf8");

// Register Handlebars helper for currency formatting
handlebars.registerHelper('formatCurrency', function (amount, currency) {
    const currencySymbols = {
        'USD': '$',
        'GBP': '£',
        'EUR': '€',
        'JPY': '¥',
        'INR': '₹',
    };
    const symbol = currencySymbols[currency] || currency;
    const value = (amount / 100).toFixed(2);
    return `${symbol} ${value}`;
});

const compileTicketTemplate = handlebars.compile(emailTemplateSource);

const lowStockAlertTemplatePath = path.join(
    __dirname,
    "..",
    "templates",
    "lowStockAlertEmail.html",
);
const lowStockAlertTemplateSource = fs.readFileSync(lowStockAlertTemplatePath, "utf8");
const compileLowStockAlertTemplate = handlebars.compile(lowStockAlertTemplateSource);

const passwordResetTemplatePath = path.join(
    __dirname,
    "..",
    "templates",
    "passwordResetEmail.html",
);
const passwordResetTemplateSource = fs.readFileSync(passwordResetTemplatePath, "utf8");
const compilePasswordResetTemplate = handlebars.compile(passwordResetTemplateSource);

exports.sendTicketByAttendeeId = async ({ attendeeId }) => {
    // Get the specific attendee by attendeeId first
    const attendee = await attendeesService.getAttendeeById({ attendeeId });

    if (!attendee) {
        throw new CustomError("Attendee not found", 404);
    }

    // Now get the registration data using the registrationId from the attendee
    const { registration, event, extrasPurchase } =
        await registrationService.getRegistrationWEventWExtrasPurchase({
            registrationId: attendee.registrationId,
        });

    // Get user timezone from registration dedicated columns
    const userTimezone = registration.userTimezone || 'UTC';
    const timezoneAbbr = getTimezoneAbbreviation(userTimezone);

    // Get order details and total quantity
    const orderSql = `
        SELECT o.total_amount,
               o.shipping_cost,
               COALESCE(SUM((item ->>'quantity')::int), 0) AS total_tickets,
               jsonb_agg(
                       jsonb_build_object(
                               'ticketTitle', COALESCE(item ->>'title', 'Ticket'),
                               'quantity', COALESCE((item ->>'quantity')::int, 0),
                               'price', COALESCE((item ->>'price')::int, 0)
                       )
               )                                           AS items_detail
        FROM orders o,
             jsonb_array_elements(o.items_ticket) AS item
        WHERE o.registration_id = $1
        GROUP BY o.total_amount, o.shipping_cost
    `;
    const orderResult = await query(orderSql, [registration.id]);
    const totalTickets = orderResult.rows[0]?.totalTickets || 1;
    const orderItems = orderResult.rows[0]?.itemsDetail || [];
    const hasMultipleTicketTypes = orderItems.length > 1;

    // Calculate payment summary
    const subtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalAmount = orderResult.rows[0]?.totalAmount || subtotal;

    // Get shipping cost from order metadata or calculate from total
    const shippingAmount = orderResult.rows[0]?.shipping_cost || 0;

    // No tax on free orders
    const taxAmount = subtotal === 0 ? 0 : totalAmount - subtotal - shippingAmount;

    // Determine if group ticket using utility
    const isGroup = isGroupTicket({
        saveAllAttendeesDetails: event?.config?.saveAllAttendeesDetails,
        totalQuantity: totalTickets
    });

    // Generate QR code
    const attachments = [];
    const qrCodeMain = await generateQrData({
        registrationId: attendee.registrationId,
        attendeeId: attendee.id,
        qrUuid: attendee.qrUuid,
    });
    attachments.push({ type: "qrcode", content: qrCodeMain, cid: "qrCodeMain" });

    // Add extras QR if primary attendee
    if (attendee.isPrimary && extrasPurchase?.id && extrasPurchase.extrasData?.length) {
        const qrCodeExtras = await generateQrCode({ id: extrasPurchase.id, qrUuid: extrasPurchase.qrUuid });
        attachments.push({ type: "qrcode", content: qrCodeExtras, cid: "qrCodeExtras" });
    }

    // Format dates
    const eventDateDisplay = formatEventDateTimeRange(
        event.startDate,
        event.endDate,
        userTimezone,
        event.config || {}
    );
    const registrationTime = formatLongDate(registration.createdAt, userTimezone);

    // Build email template data
    const header = await getBrandingData();
    const html = compileTicketTemplate({
        header,
        eventName: event.name,
        name: `${attendee.firstName} ${attendee.lastName}`,
        email: attendee.email,
        phone: attendee.phone || "",
        location: event.location,
        registrationTime,
        eventDateDisplay,
        ticketType: hasMultipleTicketTypes ? null : (attendee.ticket?.title || orderItems[0]?.ticketTitle),
        quantity: hasMultipleTicketTypes ? null : (isGroup ? totalTickets : 1),
        isGroupTicket: isGroup,
        isRegistrantDetails: isRegistrantDetails(isGroup),
        hasMultipleTicketTypes,
        showTicketsSection: isGroup && hasMultipleTicketTypes, // Only show for group tickets with multiple types
        groupMessage: getQrMessage(isGroup),
        orderItems,
        currency: event.currency || 'USD',
        subtotal,
        shippingAmount,
        taxAmount,
        totalAmount,
        extrasList: attendee.isPrimary ? extrasPurchase?.extrasData || [] : [],
        appName: appInfo.name,
        userTimezone,
        timezoneAbbr,
    });

    return exports.sendMail({
        to: attendee.email,
        subject: getEmailSubject(isGroup, event.name),
        html,
        attachments,
    });
};

exports.sendTicketsByRegistrationId = async ({ registrationId, orderId = null }) => {
    // Get registration data with event and extras
    const { registration, event, extrasPurchase } = await registrationService.getRegistrationWEventWExtrasPurchase({
        registrationId,
    });

    // Get user timezone from registration
    const userTimezone = registration.userTimezone || 'UTC';
    const timezoneAbbr = getTimezoneAbbreviation(userTimezone);

    // Get attendees for this specific registration/order
    const attendeesSql = `
        SELECT a.*, a.ticket->>'title' as ticket_title
        FROM attendees a
        WHERE a.registration_id = $1
        ${orderId ? 'AND a.order_id = $2' : ''}
        ORDER BY a.is_primary DESC, a.id ASC;`;

    const attendeesResult = await query(attendeesSql, orderId ? [registrationId, orderId] : [registrationId]);
    const attendees = attendeesResult.rows;

    if (!attendees || attendees.length === 0) {
        throw new CustomError("No attendees found for this confirmation", 404);
    }

    // Get order details and total quantity from orders table
    const orderSql = `
        SELECT o.total_amount,
               o.shipping_cost,
               COALESCE(SUM((item ->>'quantity')::int), 0) AS total_tickets,
               jsonb_agg(
                       jsonb_build_object(
                               'ticketTitle', COALESCE(item ->>'title', 'Ticket'),
                               'quantity', COALESCE((item ->>'quantity')::int, 0),
                               'price', COALESCE((item ->>'price')::int, 0)
                       )
               )                                           AS items_detail,
               o.items_product,
               o.product_status
        FROM orders o,
             jsonb_array_elements(o.items_ticket) AS item
        WHERE ${orderId ? 'o.id = $1' : 'o.registration_id = $1'}
        GROUP BY o.total_amount, o.shipping_cost, o.items_product, o.product_status
    `;
    const orderResult = await query(orderSql, [orderId || registration.id]);
    const totalTickets = orderResult.rows[0]?.totalTickets || 1;
    const orderItems = orderResult.rows[0]?.itemsDetail || [];
    const productItems = orderResult.rows[0]?.itemsProduct || [];
    const productStatus = orderResult.rows[0]?.productStatus || 'pending';
    const hasMultipleTicketTypes = orderItems.length > 1;
    const hasProducts = productItems && productItems.length > 0;

    // Calculate payment summary
    const ticketSubtotal = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const productSubtotal = productItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const subtotal = ticketSubtotal + productSubtotal;
    const totalAmount = orderResult.rows[0]?.totalAmount || subtotal;

    // Get shipping cost from order metadata or calculate from total
    const shippingAmount = orderResult.rows[0]?.shipping_cost || 0;

    // No tax on free orders
    const taxAmount = subtotal === 0 ? 0 : totalAmount - subtotal - shippingAmount;

    // Determine if group ticket using utility
    const isGroup = isGroupTicket({
        saveAllAttendeesDetails: event?.config?.saveAllAttendeesDetails,
        totalQuantity: totalTickets
    });

    // Format dates
    const eventDateDisplay = formatEventDateTimeRange(
        event.startDate,
        event.endDate,
        userTimezone,
        event.config || {}
    );
    const registrationTime = formatLongDate(registration.createdAt, userTimezone);

    // If group ticket, send single email to primary
    if (isGroup) {
        const primary = attendees.find(a => a.isPrimary) || attendees[0];
        if (!primary) {
            throw new CustomError("Primary attendee not found", 404);
        }

        // Generate QR code
        const attachments = [];
        const qrCodeMain = await generateQrData({
            registrationId: primary.registrationId,
            attendeeId: primary.id,
            qrUuid: primary.qrUuid,
        });
        attachments.push({ type: 'qrcode', content: qrCodeMain, cid: 'qrCodeMain' });

        // Add extras QR if applicable
        if (extrasPurchase?.id && extrasPurchase.extrasData?.length) {
            const qrCodeExtras = await generateQrCode({ id: extrasPurchase.id, qrUuid: extrasPurchase.qrUuid });
            attachments.push({ type: 'qrcode', content: qrCodeExtras, cid: 'qrCodeExtras' });
        }

        const header = await getBrandingData();
        const html = compileTicketTemplate({
            header,
            eventName: event.name,
            name: `${primary.firstName} ${primary.lastName}`,
            email: primary.email,
            phone: primary.phone || "",
            location: event.location,
            registrationTime,
            eventDateDisplay,
            ticketType: hasMultipleTicketTypes ? null : (primary.ticket?.title || orderItems[0]?.ticketTitle),
            quantity: hasMultipleTicketTypes ? null : totalTickets,
            isGroupTicket: isGroup,
            isRegistrantDetails: isRegistrantDetails(isGroup),
            hasMultipleTicketTypes,
            showTicketsSection: isGroup && hasMultipleTicketTypes, // Only show for group tickets with multiple types
            groupMessage: getQrMessage(isGroup),
            orderItems,
            productItems,
            productStatus,
            hasProducts,
            currency: event.currency || 'USD',
            subtotal,
            shippingAmount,
            taxAmount,
            totalAmount,
            extrasList: extrasPurchase?.extrasData || [],
            appName: appInfo.name,
            userTimezone,
            timezoneAbbr,
        });

        const sent = await exports.sendMail({
            to: primary.email,
            subject: getEmailSubject(isGroup, event.name),
            html,
            attachments,
        });

        return {
            registrationId,
            totalAttendees: totalTickets,
            successfulEmails: 1,
            failedEmails: 0,
            results: [{ attendeeId: primary.id, email: primary.email, messageId: sent.messageId, success: true }],
        };
    }

    // Send individual emails to each attendee
    const results = [];
    for (const attendee of attendees) {
        try {
            // Generate QR code
            const attachments = [];
            const qrCodeMain = await generateQrData({
                registrationId: attendee.registrationId,
                attendeeId: attendee.id,
                qrUuid: attendee.qrUuid,
            });
            attachments.push({ type: "qrcode", content: qrCodeMain, cid: "qrCodeMain" });

            // Add extras QR if primary attendee
            if (attendee.isPrimary && extrasPurchase?.id && extrasPurchase.extrasData?.length) {
                const qrCodeExtras = await generateQrCode({ id: extrasPurchase.id, qrUuid: extrasPurchase.qrUuid });
                attachments.push({ type: "qrcode", content: qrCodeExtras, cid: "qrCodeExtras" });
            }

            // Find the attendee's specific ticket price
            const attendeeTicket = orderItems.find(item => item.ticketTitle === attendee.ticketTitle) || orderItems[0];
            const attendeeTicketPrice = attendeeTicket?.price || 0;

            const header = await getBrandingData();
            const html = compileTicketTemplate({
                header,
                eventName: event.name,
                name: `${attendee.firstName} ${attendee.lastName}`,
                email: attendee.email,
                phone: attendee.phone || "",
                location: event.location,
                registrationTime,
                eventDateDisplay,
                ticketType: attendee.ticket?.title || attendeeTicket?.ticketTitle,
                quantity: 1,
                isGroupTicket: false,
                isRegistrantDetails: isRegistrantDetails(false),
                hasMultipleTicketTypes,
                showTicketsSection: false, // Never show tickets section for individual attendee emails
                groupMessage: getQrMessage(false),
                orderItems,
                currency: event.currency || 'USD',
                subtotal: attendeeTicketPrice,
                taxAmount: 0,
                totalAmount: attendeeTicketPrice,
                extrasList: attendee.isPrimary ? extrasPurchase?.extrasData || [] : [],
                appName: appInfo.name,
                userTimezone,
                timezoneAbbr,
            });

            const result = await exports.sendMail({
                to: attendee.email,
                subject: getEmailSubject(false, event.name),
                html,
                attachments,
            });

            results.push({
                attendeeId: attendee.id,
                email: attendee.email,
                messageId: result.messageId,
                success: true,
            });
        } catch (error) {
            console.error(`Failed to send email to attendee ${attendee.id}:`, error);
            results.push({
                attendeeId: attendee.id,
                email: attendee.email,
                error: error.message,
                success: false,
            });
        }
    }

    return {
        registrationId,
        totalAttendees: attendees.length,
        successfulEmails: results.filter(r => r.success).length,
        failedEmails: results.filter(r => !r.success).length,
        results,
    };
};

// Abandoned Cart Email Template
const abandonedCartTemplatePath = path.join(
    __dirname,
    "..",
    "templates",
    "abandonedCartEmail.html",
);
const abandonedCartTemplateSource = fs.readFileSync(abandonedCartTemplatePath, "utf8");
const compileAbandonedCartTemplate = handlebars.compile(abandonedCartTemplateSource);

/**
 * Send abandoned cart reminder email
 * @param {Object} params
 * @param {string} params.to - Recipient email
 * @param {string} params.firstName - Recipient first name
 * @param {Object} params.event - Event object
 * @param {Array} params.selectedTickets - Selected tickets array
 * @param {Array} params.selectedProducts - Selected products array
 * @param {number} params.totalAmount - Total amount in cents
 * @param {string} params.currency - Currency code
 * @param {string} params.sessionId - Session ID for checkout link
 */
exports.sendAbandonedCartReminder = async ({
    to,
    firstName,
    event,
    selectedTickets = [],
    selectedProducts = [],
    totalAmount = 0,
    currency = "USD",
    sessionId,
}) => {
    try {
        // Format tickets for email
        const tickets = (selectedTickets || []).map((ticket) => ({
            title: ticket.title || "Ticket",
            quantity: ticket.quantity || 1,
            price: ticket.price || 0,
            totalPrice: (ticket.price || 0) * (ticket.quantity || 1),
        }));

        // Format products for email
        const products = (selectedProducts || []).map((product) => ({
            name: product.name || "Product",
            quantity: product.quantity || 1,
            price: product.price || 0,
            totalPrice: (product.price || 0) * (product.quantity || 1),
        }));

        // Build checkout link - use slug if available, otherwise use event ID
        const eventSlug = event.slug;
        const checkoutLink = eventSlug
            ? `${VUE_BASE_URL}/${eventSlug}/checkout?session=${sessionId}`
            : `${VUE_BASE_URL}/event/${event.id}/checkout?session=${sessionId}`;

        // Format event date
        // For abandoned cart, we don't have user timezone, so use UTC or event timezone if available
        const { formatEventDateTimeRange } = require("../utils/date");
        const eventTimezone = event.timezone || event.config?.timezone || 'UTC';
        const eventDate = event.startDatetime
            ? formatEventDateTimeRange(event.startDatetime, event.endDatetime, eventTimezone, event.config || {})
            : null;

        // Build email template data
        const header = await getBrandingData();
        const html = compileAbandonedCartTemplate({
            header,
            firstName: firstName || "there",
            eventName: event.name || "Event",
            eventLocation: event.location || null,
            eventDate: eventDate,
            tickets: tickets,
            products: products,
            hasTickets: tickets.length > 0,
            hasProducts: products.length > 0,
            totalAmount: totalAmount,
            currency: currency,
            checkoutLink: checkoutLink,
            appName: appInfo.name,
            currentYear: new Date().getFullYear(),
        });

        // Send email
        const result = await exports.sendMail({
            to: to,
            subject: `Complete Your Registration - ${event.name || "Event"}`,
            html: html,
        });

        return {
            success: true,
            messageId: result.messageId,
            to: to,
        };
    } catch (error) {
        console.error("Error sending abandoned cart reminder:", error);
        throw error;
    }
};
exports.sendLowStockAlert = async ({
    to,
    eventName,
    ticketTitle,
    currentStock,
    threshold
}) => {
    try {
        const header = await getBrandingData();
        const html = compileLowStockAlertTemplate({
            header,
            eventName,
            ticketTitle,
            currentStock,
            threshold,
            appName: appInfo.name,
            currentYear: new Date().getFullYear(),
        });

        const result = await exports.sendMail({
            to,
            subject: `Low Stock Alert: ${ticketTitle} - ${eventName}`,
            html: html,
        });

        return {
            success: true,
            messageId: result.messageId,
            to: to,
        };
    } catch (error) {
        console.error("Error sending low stock alert:", error);
        throw error;
    }
};

exports.sendPasswordReset = async ({ to, token }) => {
    try {
        const header = await getBrandingData();
        const resetLink = `${VUE_BASE_URL}/auth/reset-password?token=${token}`;
        const html = compilePasswordResetTemplate({
            header,
            appName: appInfo.name,
            resetLink,
            currentYear: new Date().getFullYear(),
        });

        const result = await exports.sendMail({
            to,
            subject: `Reset Your Password - ${appInfo.name}`,
            html,
        });

        return {
            success: true,
            messageId: result.messageId,
            to,
        };
    } catch (error) {
        console.error("Error sending password reset email:", error);
        throw error;
    }
};
