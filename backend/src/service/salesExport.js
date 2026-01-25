const CustomError = require("../model/CustomError");
const { formatDateOnly } = require("../utils/date");
const { query } = require("../db");

/**
 * Get sales data formatted for Billit export
 * Flattens orders into line items (one row per ticket/product)
 */
exports.getSalesForExport = async ({ eventId = null, startDate = null, endDate = null }) => {
    let whereConditions = ["o.payment_status = 'paid'"]; // Only export paid orders
    const params = [];
    let paramIndex = 1;

    if (eventId) {
        whereConditions.push(`o.event_id = $${paramIndex++}`);
        params.push(eventId);
    }

    if (startDate) {
        whereConditions.push(`o.created_at >= $${paramIndex++}`);
        params.push(startDate);
    }

    if (endDate) {
        whereConditions.push(`o.created_at <= $${paramIndex++}`);
        params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Query orders with customer and event data
    const sql = `
        SELECT 
            o.id as order_id,
            o.order_number,
            o.total_amount,
            o.currency,
            o.payment_status,
            o.items_ticket,
            o.items_product,
            o.tax_amount,
            o.shipping_cost,
            o.shipping_address,
            o.shipping_type,
            o.created_at as order_date,
            o.stripe_payment_intent_id,
            e.id as event_id,
            e.name as event_name,
            r.id as registration_id,
            a.id as attendee_id,
            a.first_name,
            a.last_name,
            a.email,
            a.phone,
            a.is_primary
        FROM orders o
        INNER JOIN event e ON o.event_id = e.id
        INNER JOIN registration r ON o.registration_id = r.id
        INNER JOIN attendees a ON r.id = a.registration_id AND a.is_primary = true
        ${whereClause}
        ORDER BY o.created_at DESC, o.order_number
    `;

    const result = await query(sql, params);
    return result.rows;
};

/**
 * Transform sales data into Billit-ready format
 * Returns array of line items (one per ticket/product)
 */
exports.formatForBillit = (orders, timezone = 'UTC') => {
    const lineItems = [];

    for (const order of orders) {
        const customerName = `${order.firstName || ''} ${order.lastName || ''}`.trim();
        const customerEmail = order.email || '';
        const shippingAddress = order.shippingAddress || {};
        const addressParts = [];
        if (shippingAddress.street) addressParts.push(shippingAddress.street);
        if (shippingAddress.city) addressParts.push(shippingAddress.city);
        if (shippingAddress.postalCode) addressParts.push(shippingAddress.postalCode);
        if (shippingAddress.country) addressParts.push(shippingAddress.country);
        const customerAddress = addressParts.join(', ') || null;

        // Calculate tax rate (percentage)
        const subtotal = order.totalAmount - (order.taxAmount || 0) - (order.shippingCost || 0);
        const taxRate = subtotal > 0 ? ((order.taxAmount || 0) / subtotal * 100).toFixed(2) : '0.00';

        // Process ticket items
        if (order.itemsTicket && Array.isArray(order.itemsTicket)) {
            for (const ticket of order.itemsTicket) {
                const price = ticket.price || 0;
                const quantity = ticket.quantity || 1;
                const itemTotal = price * quantity;
                const itemTax = Math.round((itemTotal / subtotal) * (order.taxAmount || 0));

                lineItems.push({
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_address: customerAddress,
                    customer_phone: order.phone || null,
                    event_name: order.eventName || '',
                    order_number: order.orderNumber || '',
                    order_date: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
                    item_name: ticket.title || ticket.name || 'Ticket',
                    item_type: 'ticket',
                    item_quantity: quantity,
                    item_unit_price: (price / 100).toFixed(2), // Convert cents to decimal
                    tax_rate: taxRate,
                    tax_amount: (itemTax / 100).toFixed(2),
                    item_total_amount: (itemTotal / 100).toFixed(2),
                    order_total_amount: (order.totalAmount / 100).toFixed(2),
                    payment_status: order.paymentStatus || 'paid',
                    payment_method: order.stripePaymentIntentId ? 'stripe' : 'other',
                    currency: order.currency || 'USD',
                    shipping_cost: order.shippingCost ? (order.shippingCost / 100).toFixed(2) : '0.00',
                    shipping_type: order.shippingType || 'pickup',
                });
            }
        }

        // Process product items
        if (order.itemsProduct && Array.isArray(order.itemsProduct)) {
            for (const product of order.itemsProduct) {
                const price = product.price || 0;
                const quantity = product.quantity || 1;
                const itemTotal = price * quantity;
                const itemTax = Math.round((itemTotal / subtotal) * (order.taxAmount || 0));

                lineItems.push({
                    customer_name: customerName,
                    customer_email: customerEmail,
                    customer_address: customerAddress,
                    customer_phone: order.phone || null,
                    event_name: order.eventName || '',
                    order_number: order.orderNumber || '',
                    order_date: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
                    item_name: product.name || product.title || 'Product',
                    item_type: 'product',
                    item_quantity: quantity,
                    item_unit_price: (price / 100).toFixed(2),
                    tax_rate: taxRate,
                    tax_amount: (itemTax / 100).toFixed(2),
                    item_total_amount: (itemTotal / 100).toFixed(2),
                    order_total_amount: (order.totalAmount / 100).toFixed(2),
                    payment_status: order.paymentStatus || 'paid',
                    payment_method: order.stripePaymentIntentId ? 'stripe' : 'other',
                    currency: order.currency || 'USD',
                    shipping_cost: order.shippingCost ? (order.shippingCost / 100).toFixed(2) : '0.00',
                    shipping_type: order.shippingType || 'pickup',
                });
            }
        }

        // If no items, still create a line item for the order total
        if ((!order.itemsTicket || order.itemsTicket.length === 0) &&
            (!order.itemsProduct || order.itemsProduct.length === 0)) {
            lineItems.push({
                customer_name: customerName,
                customer_email: customerEmail,
                customer_address: customerAddress,
                customer_phone: order.phone || null,
                event_name: order.eventName || '',
                order_number: order.orderNumber || '',
                order_date: order.orderDate ? new Date(order.orderDate).toISOString().split('T')[0] : '',
                item_name: 'Order Total',
                item_type: 'other',
                item_quantity: 1,
                item_unit_price: (order.totalAmount / 100).toFixed(2),
                tax_rate: taxRate,
                tax_amount: (order.taxAmount / 100).toFixed(2),
                item_total_amount: (order.totalAmount / 100).toFixed(2),
                order_total_amount: (order.totalAmount / 100).toFixed(2),
                payment_status: order.paymentStatus || 'paid',
                payment_method: order.stripePaymentIntentId ? 'stripe' : 'other',
                currency: order.currency || 'USD',
                shipping_cost: order.shippingCost ? (order.shippingCost / 100).toFixed(2) : '0.00',
                shipping_type: order.shippingType || 'pickup',
            });
        }
    }

    return lineItems;
};

/**
 * Convert line items to CSV format
 */
exports.toCSV = (lineItems) => {
    if (lineItems.length === 0) {
        return '';
    }

    // Get all unique keys from all items
    const headers = Object.keys(lineItems[0]);

    // Create CSV header
    const csvRows = [headers.join(',')];

    // Add data rows
    for (const item of lineItems) {
        const values = headers.map(header => {
            const value = item[header];
            // Escape commas and quotes in CSV
            if (value === null || value === undefined) {
                return '';
            }
            const stringValue = String(value);
            if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                return `"${stringValue.replace(/"/g, '""')}"`;
            }
            return stringValue;
        });
        csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
};

/**
 * Convert line items to JSON format
 */
exports.toJSON = (lineItems) => {
    return JSON.stringify(lineItems, null, 2);
};

