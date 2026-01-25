const CustomError = require("../model/CustomError");
const {query} = require("../db");

// Get product orders for an event with pagination
exports.getEventProductOrders = async ({eventId, page, limit, searchKeyword, fetchTotalCount = false}) => {
    try {
        if (!eventId) {
            throw new CustomError("Event ID is required", 400);
        }

        const offset = (page - 1) * limit;

        // Build search conditions
        let searchConditions = '';
        let searchParams = [eventId];

        if (searchKeyword && searchKeyword.trim()) {
            const searchTerm = `%${searchKeyword.trim()}%`;
            searchConditions = `
                AND (
                    o.order_number ILIKE $2
                    OR a.first_name ILIKE $2
                    OR a.last_name ILIKE $2
                    OR a.email ILIKE $2
                )
            `;
            searchParams.push(searchTerm);
        }

        // Get total count of orders with products for this event (only if requested)
        let total = 0;
        if (fetchTotalCount) {
            const countQuery = `
                SELECT COUNT(*) as total
                FROM orders o
                         INNER JOIN registration r ON o.registration_id = r.id
                         INNER JOIN attendees a ON r.id = a.registration_id AND a.is_primary = true
                WHERE o.event_id = $1
                  AND o.items_product IS NOT NULL
                  AND jsonb_array_length(o.items_product) > 0
                    ${searchConditions}
            `;

            const countResult = await query(countQuery, searchParams);
            total = parseInt(countResult.rows[0].total);
        }

        // Get paginated product orders with attendee and registration details
        const ordersQuery = `
            SELECT o.id         as order_id,
                   o.order_number,
                   o.total_amount,
                   o.currency,
                   o.payment_status,
                   o.items_product,
                   o.product_status,
                   o.shipping_cost,
                   o.shipping_address,
                   o.shipping_type,
                   o.created_at as order_created_at,
                   r.id         as registration_id,
                   r.status     as registration_status,
                   r.created_at as registration_created_at,
                   a.id         as attendee_id,
                   a.first_name,
                   a.last_name,
                   a.email,
                   a.phone,
                   a.is_primary,
                   e.name       as event_name
            FROM orders o
                     INNER JOIN registration r ON o.registration_id = r.id
                     INNER JOIN attendees a ON r.id = a.registration_id AND a.is_primary = true
                     INNER JOIN event e ON o.event_id = e.id
            WHERE o.event_id = $1
              AND o.items_product IS NOT NULL
              AND jsonb_array_length(o.items_product) > 0
                ${searchConditions}
            ORDER BY o.created_at DESC
                LIMIT $${searchParams.length + 1}
            OFFSET $${searchParams.length + 2}
        `;

        const ordersResult = await query(ordersQuery, [...searchParams, limit, offset]);

        // Process the results to include product details
        const orders = ordersResult.rows.map(row => {
            const products = row.itemsProduct || [];
            const productDetails = products.map(product => ({
                productId: product.productId,
                name: product.title || product.name,
                price: product.price,
                quantity: product.quantity,
                totalPrice: product.price * product.quantity
            }));

            return {
                orderId: row.orderId,
                orderNumber: row.orderNumber,
                totalAmount: row.totalAmount,
                currency: row.currency,
                paymentStatus: row.paymentStatus,
                productStatus: row.productStatus,
                shippingCost: row.shippingCost || 0,
                shippingAddress: row.shippingAddress,
                shippingType: row.shippingType,
                orderCreatedAt: row.orderCreatedAt,
                registrationId: row.registrationId,
                registrationStatus: row.registrationStatus,
                registrationCreatedAt: row.registrationCreatedAt,
                attendee: {
                    id: row.attendeeId,
                    firstName: row.firstName,
                    lastName: row.lastName,
                    email: row.email,
                    phone: row.phone,
                    isPrimary: row.isPrimary
                },
                eventName: row.eventName,
                products: productDetails,
                totalProducts: products.length,
                totalProductQuantity: products.reduce((sum, p) => sum + (p.quantity || 0), 0)
            };
        });

        return {
            orders,
            totalItems: total,
            page: page,
            itemsPerPage: limit,
            totalPages: Math.ceil(total / limit)
        };
    } catch (error) {
        console.error("Error in getEventProductOrders:", error);
        throw error;
    }
};

// Get detailed product order information
exports.getProductOrderDetails = async ({orderId}) => {
    try {
        if (!orderId) {
            throw new CustomError("Order ID is required", 400);
        }

        const orderQuery = `
            SELECT o.id             as order_id,
                   o.order_number,
                   o.total_amount,
                   o.currency,
                   o.payment_status,
                   o.items_ticket,
                   o.items_product,
                   o.product_status,
                   o.shipping_cost,
                   o.shipping_address,
                   o.shipping_type,
                   o.created_at     as order_created_at,
                   o.updated_at     as order_updated_at,
                   r.id             as registration_id,
                   r.status         as registration_status,
                   r.additional_fields,
                   r.created_at     as registration_created_at,
                   e.id             as event_id,
                   e.name           as event_name,
                   e.location       as event_location,
                   e.start_datetime as event_start_datetime,
                   e.end_datetime   as event_end_datetime
            FROM orders o
                     INNER JOIN registration r ON o.registration_id = r.id
                     INNER JOIN event e ON o.event_id = e.id
            WHERE o.id = $1
        `;

        const orderResult = await query(orderQuery, [orderId]);

        if (orderResult.rows.length === 0) {
            throw new CustomError("Order not found", 404);
        }

        const order = orderResult.rows[0];

        // Get all attendees for this registration
        const attendeesQuery = `
            SELECT a.id,
                   a.first_name,
                   a.last_name,
                   a.email,
                   a.phone,
                   a.is_primary,
                   a.ticket_id,
                   a.qr_uuid,
                   t.title as ticket_title,
                   t.price as ticket_price
            FROM attendees a
                     LEFT JOIN ticket t ON a.ticket_id = t.id
            WHERE a.registration_id = $1
            ORDER BY a.is_primary DESC, a.created_at ASC
        `;

        const attendeesResult = await query(attendeesQuery, [order.registration_id]);

        // Process products
        const products = (order.items_product || []).map(product => ({
            productId: product.productId,
            name: product.title || product.name,
            price: product.price,
            quantity: product.quantity,
            totalPrice: product.price * product.quantity
        }));

        // Process tickets
        const tickets = (order.items_ticket || []).map(ticket => ({
            ticketId: ticket.ticketId,
            title: ticket.title,
            price: ticket.price,
            quantity: ticket.quantity,
            totalPrice: ticket.price * ticket.quantity
        }));

        const result = {
            order: {
                id: order.order_id,
                orderNumber: order.order_number,
                totalAmount: order.total_amount,
                currency: order.currency,
                paymentStatus: order.payment_status,
                productStatus: order.product_status,
                shippingCost: order.shipping_cost || 0,
                shippingAddress: order.shipping_address,
                shippingType: order.shipping_type,
                createdAt: order.order_created_at,
                updatedAt: order.order_updated_at
            },
            registration: {
                id: order.registration_id,
                status: order.registration_status,
                additionalFields: order.additional_fields,
                createdAt: order.registration_created_at
            },
            event: {
                id: order.event_id,
                name: order.event_name,
                location: order.event_location,
                startDate: order.event_start_date,
                endDate: order.event_end_date
            },
            attendees: attendeesResult.rows.map(attendee => ({
                id: attendee.id,
                firstName: attendee.first_name,
                lastName: attendee.last_name,
                email: attendee.email,
                phone: attendee.phone,
                isPrimary: attendee.is_primary,
                ticketId: attendee.ticket_id,
                qrUuid: attendee.qr_uuid,
                ticketTitle: attendee.ticket_title,
                ticketPrice: attendee.ticket_price
            })),
            products,
            tickets,
            summary: {
                totalProducts: products.length,
                totalProductQuantity: products.reduce((sum, p) => sum + p.quantity, 0),
                totalProductAmount: products.reduce((sum, p) => sum + p.totalPrice, 0),
                totalTickets: tickets.length,
                totalTicketQuantity: tickets.reduce((sum, t) => sum + t.quantity, 0),
                totalTicketAmount: tickets.reduce((sum, t) => sum + t.totalPrice, 0)
            }
        };

        return result;
    } catch (error) {
        console.error("Error in getProductOrderDetails:", error);
        throw error;
    }
};

// Update product order status
exports.updateProductOrderStatus = async ({orderId, productStatus}) => {
    try {
        if (!orderId) {
            throw new CustomError("Order ID is required", 400);
        }

        if (!productStatus) {
            throw new CustomError("Product status is required", 400);
        }

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(productStatus)) {
            throw new CustomError(`Invalid product status. Must be one of: ${validStatuses.join(', ')}`, 400);
        }

        const updateQuery = `
            UPDATE orders
            SET product_status = $1,
                updated_at     = NOW()
            WHERE id = $2 RETURNING *
        `;

        const result = await query(updateQuery, [productStatus, orderId]);

        if (result.rows.length === 0) {
            throw new CustomError("Order not found", 404);
        }

        return {
            orderId: result.rows[0].id,
            productStatus: result.rows[0].product_status,
            updatedAt: result.rows[0].updated_at
        };
    } catch (error) {
        console.error("Error in updateProductOrderStatus:", error);
        throw error;
    }
};
