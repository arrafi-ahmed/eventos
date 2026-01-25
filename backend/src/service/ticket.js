const CustomError = require("../model/CustomError");
const { query } = require("../db");

exports.save = async ({ payload, currentUser }) => {
    if (!payload) {
        throw new CustomError("Payload is required", 400);
    }

    // Remove id from payload if it's null or undefined to let database auto-generate
    const { id, ...ticketData } = payload;

    // Validate required fields (only NOT NULL columns from DB schema)
    if (!ticketData.title || !ticketData.title.trim()) {
        throw new CustomError("Title is required", 400);
    }

    if (ticketData.price == null || ticketData.price < 0) {
        throw new CustomError("Valid price is required", 400);
    }

    if (!ticketData.eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const newTicket = {
        ...ticketData,
        eventId: payload.eventId,
        // Map camelCase to snake_case for database
        current_stock: payload.currentStock || payload.current_stock || 0,
        max_stock: payload.maxStock || payload.max_stock || 100,
        on_site_quota: payload.onSiteQuota || payload.on_site_quota || 0,
        low_stock_threshold: payload.lowStockThreshold || payload.low_stock_threshold || 5,
        low_stock_alert_sent: payload.lowStockAlertSent || payload.low_stock_alert_sent || false,
        sale_start_date: payload.saleStartDate || payload.sale_start_date || null,
        sale_end_date: payload.saleEndDate || payload.sale_end_date || null,
        original_price: payload.originalPrice || payload.original_price || null,
    };

    // If updating existing ticket (id exists), use upsert
    if (id) {
        const sql = `
            INSERT INTO ticket(id, title, description, price, current_stock, max_stock, on_site_quota, low_stock_threshold, low_stock_alert_sent, sale_start_date, sale_end_date, original_price, event_id, created_at)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) ON CONFLICT(id) DO
            UPDATE SET
        title = EXCLUDED.title,
            description = EXCLUDED.description,
            price = EXCLUDED.price,
            current_stock = EXCLUDED.current_stock,
            max_stock = EXCLUDED.max_stock,
            on_site_quota = EXCLUDED.on_site_quota,
            low_stock_threshold = EXCLUDED.low_stock_threshold,
            low_stock_alert_sent = CASE 
                    WHEN EXCLUDED.current_stock > ticket.current_stock THEN false 
                    ELSE ticket.low_stock_alert_sent
        END,
            sale_start_date = EXCLUDED.sale_start_date,
            sale_end_date = EXCLUDED.sale_end_date,
            original_price = EXCLUDED.original_price,
            event_id = EXCLUDED.event_id
        RETURNING
        id,
            title,
            description,
            price,
            current_stock as "currentStock",
            max_stock as "maxStock",
            on_site_quota as "onSiteQuota",
            low_stock_threshold as "lowStockThreshold",
            low_stock_alert_sent as "lowStockAlertSent",
            sale_start_date as "saleStartDate",
            sale_end_date as "saleEndDate",
            original_price as "originalPrice",
            event_id as "eventId",
            created_at as "createdAt"
        `;
        const values = [
            id,
            newTicket.title,
            newTicket.description,
            newTicket.price,
            newTicket.current_stock,
            newTicket.max_stock,
            newTicket.on_site_quota,
            newTicket.low_stock_threshold,
            newTicket.low_stock_alert_sent,
            newTicket.sale_start_date,
            newTicket.sale_end_date,
            newTicket.original_price,
            newTicket.eventId,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to update ticket", 500);
        }

        return result.rows[0];
    } else {
        // If creating new ticket, don't include id
        const sql = `
            INSERT INTO ticket(title, description, price, current_stock, max_stock, on_site_quota, low_stock_threshold, sale_start_date, sale_end_date, original_price, event_id, created_at)
        VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()) RETURNING
        id,
            title,
            description,
            price,
            current_stock as "currentStock",
            max_stock as "maxStock",
            on_site_quota as "onSiteQuota",
            low_stock_threshold as "lowStockThreshold",
            low_stock_alert_sent as "lowStockAlertSent",
            sale_start_date as "saleStartDate",
            sale_end_date as "saleEndDate",
            original_price as "originalPrice",
            event_id as "eventId",
            created_at as "createdAt"
        `;
        const values = [
            newTicket.title,
            newTicket.description,
            newTicket.price,
            newTicket.current_stock,
            newTicket.max_stock,
            newTicket.on_site_quota,
            newTicket.low_stock_threshold,
            newTicket.sale_start_date,
            newTicket.sale_end_date,
            newTicket.original_price,
            newTicket.eventId,
        ];
        const result = await query(sql, values);

        if (!result.rows[0]) {
            throw new CustomError("Failed to create ticket", 500);
        }

        return result.rows[0];
    }
};

exports.getTicketsByEventId = async ({ eventId }) => {
    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        SELECT id,
            title,
            description,
            price,
            current_stock as "currentStock",
            max_stock as "maxStock",
            on_site_quota as "onSiteQuota",
            low_stock_threshold as "lowStockThreshold",
            low_stock_alert_sent as "lowStockAlertSent",
            sale_start_date as "saleStartDate",
            sale_end_date as "saleEndDate",
            original_price as "originalPrice",
            event_id as "eventId",
            created_at as "createdAt"
        FROM ticket
        WHERE event_id = $1
        ORDER BY price ASC
            `;
    const result = await query(sql, [eventId]);
    return result.rows;
};

exports.getTicketById = async ({ ticketId }) => {
    if (!ticketId) {
        throw new CustomError("Ticket ID is required", 400);
    }

    const sql = `
        SELECT id,
            title,
            description,
            price,
            current_stock as "currentStock",
            max_stock as "maxStock",
            on_site_quota as "onSiteQuota",
            low_stock_threshold as "lowStockThreshold",
            low_stock_alert_sent as "lowStockAlertSent",
            sale_start_date as "saleStartDate",
            sale_end_date as "saleEndDate",
            original_price as "originalPrice",
            event_id as "eventId",
            created_at as "createdAt"
        FROM ticket
        WHERE id = $1
            `;
    const result = await query(sql, [ticketId]);

    if (!result.rows[0]) {
        throw new CustomError("Ticket not found", 404);
    }

    return result.rows[0];
};

exports.updateStock = async ({ ticketId, quantity, salesChannel = 'online' }) => {
    if (!ticketId) {
        throw new CustomError("Ticket ID is required", 400);
    }

    if (!quantity || quantity <= 0) {
        throw new CustomError("Valid quantity is required", 400);
    }

    let sql;
    if (salesChannel === 'online') {
        // Online sales must respect the on_site_quota
        sql = `
            UPDATE ticket
            SET current_stock = current_stock - $1
            WHERE id = $2
        AND(current_stock - $1) >= on_site_quota
        RETURNING
        id,
            title,
            current_stock as "currentStock",
            max_stock as "maxStock",
            on_site_quota as "onSiteQuota",
            low_stock_threshold as "lowStockThreshold",
            low_stock_alert_sent as "lowStockAlertSent",
            event_id as "eventId"
        `;
    } else {
        // Counter sales can use all stock (until 0)
        sql = `
            UPDATE ticket
            SET current_stock = current_stock - $1
            WHERE id = $2
              AND current_stock >= $1
        RETURNING
        id,
            title,
            current_stock as "currentStock",
            max_stock as "maxStock",
            on_site_quota as "onSiteQuota",
            low_stock_threshold as "lowStockThreshold",
            low_stock_alert_sent as "lowStockAlertSent",
            event_id as "eventId"
        `;
    }

    const result = await query(sql, [quantity, ticketId]);

    if (result.rows.length === 0) {
        if (salesChannel === 'online') {
            // Check if it failed because of quota or absolute stock
            const checkSql = 'SELECT current_stock, on_site_quota FROM ticket WHERE id = $1';
            const checkResult = await query(checkSql, [ticketId]);
            if (checkResult.rows[0] && checkResult.rows[0].currentStock < (checkResult.rows[0].onSiteQuota + quantity)) {
                throw new CustomError("Online tickets sold out (reserved quota reached)", 400);
            }
        }
        throw new CustomError("Insufficient stock or ticket not found", 400);
    }

    const ticket = result.rows[0];

    // Trigger low stock alert if threshold reached and not already sent
    if (ticket.currentStock <= ticket.lowStockThreshold && !ticket.lowStockAlertSent) {
        // We'll mark it as sent first to prevent race conditions
        await query('UPDATE ticket SET low_stock_alert_sent = true WHERE id = $1', [ticket.id]);

        // Trigger alert asynchronously
        // Note: we'll implement triggerLowStockAlert below
        triggerLowStockAlert(ticket).catch(err => console.error("Low stock alert failed:", err));
    }

    return ticket;
};

// Helper to trigger low stock alert email
async function triggerLowStockAlert(ticket) {
    try {
        const emailService = require("./email");
        const eventService = require("./event");

        const event = await eventService.getEventById({ eventId: ticket.eventId });
        if (!event) return;

        // Get organization users (specifically organizers/admins) to send the alert to
        const sql = `
            SELECT email FROM app_user 
            WHERE organization_id = $1 AND role <= 30
            `;
        const users = await query(sql, [event.organizationId]);

        if (users.rows.length === 0) return;

        for (const user of users.rows) {
            await emailService.sendLowStockAlert({
                to: user.email,
                eventName: event.name,
                ticketTitle: ticket.title,
                currentStock: ticket.currentStock,
                threshold: ticket.lowStockThreshold
            });
        }
    } catch (err) {
        console.error("Error in triggerLowStockAlert:", err);
    }
}

exports.removeTicket = async ({ ticketId, eventId }) => {
    if (!ticketId) {
        throw new CustomError("Ticket ID is required", 400);
    }

    if (!eventId) {
        throw new CustomError("Event ID is required", 400);
    }

    const sql = `
        DELETE
        FROM ticket
        WHERE id = $1
          AND event_id = $2 RETURNING *
            `;
    const result = await query(sql, [ticketId, eventId]);

    if (!result.rows[0]) {
        throw new CustomError("Ticket not found or access denied", 404);
    }

    return result.rows[0];
};
