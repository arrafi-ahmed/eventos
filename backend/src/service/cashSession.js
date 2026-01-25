const { query } = require("../db");
const CustomError = require("../model/CustomError");

exports.startSession = async ({ cashierId, eventId, organizationId, ticketCounterId, openingCash, timezone }) => {
    // Check if there's already an active session for this cashier or ticket counter
    const activeSessionCheck = `
        SELECT id FROM cash_session
        WHERE (cashier_id = $1 OR ticket_counter_id = $2) AND status = 'open'
    `;
    const activeSession = await query(activeSessionCheck, [cashierId, ticketCounterId]);
    if (activeSession.rows.length > 0) {
        throw new CustomError("An active session already exists for this cashier or ticket counter", 400);
    }

    // Also update the user's global timezone
    const authService = require("./auth");
    await authService.updateUserTimezone({ userId: cashierId, timezone });

    const sql = `
        INSERT INTO cash_session (cashier_id, ticket_counter_id, event_id, organization_id, opening_cash, status, opening_time, timezone)
        VALUES ($1, $2, $3, $4, $5, 'open', NOW(), $6)
        RETURNING *;
    `;
    const result = await query(sql, [cashierId, ticketCounterId, eventId, organizationId, openingCash || 0, timezone]);
    return result.rows[0];
};

exports.closeSession = async ({ sessionId, closingCash, notes }) => {
    const sql = `
        UPDATE cash_session
        SET closing_cash = $1,
            status = 'closed',
            closing_time = NOW()
        WHERE id = $2 AND status = 'open'
        RETURNING *;
    `;
    const result = await query(sql, [closingCash, sessionId]);
    if (result.rows.length === 0) {
        throw new CustomError("Active session not found", 404);
    }
    return result.rows[0];
};

exports.getSessionById = async ({ id }) => {
    const sql = `SELECT * FROM cash_session WHERE id = $1`;
    const result = await query(sql, [id]);
    return result.rows[0];
};

exports.getActiveSessionByCashierId = async ({ cashierId }) => {
    const sql = `
        SELECT cs.*, e.name as event_name, tc.name as ticket_counter_name
        FROM cash_session cs
        JOIN event e ON cs.event_id = e.id
        LEFT JOIN ticket_counter tc ON cs.ticket_counter_id = tc.id
        WHERE cs.cashier_id = $1 AND cs.status = 'open'
        ORDER BY cs.opening_time DESC
        LIMIT 1;
    `;
    const result = await query(sql, [cashierId]);
    return result.rows[0];
};

exports.getSessionsByTicketCounterId = async ({ ticketCounterId }) => {
    const sql = `
        SELECT cs.*, u.full_name as cashier_name
        FROM cash_session cs
        JOIN app_user u ON cs.cashier_id = u.id
        WHERE cs.ticket_counter_id = $1
        ORDER BY cs.opening_time DESC;
    `;
    const result = await query(sql, [ticketCounterId]);
    return result.rows;
};

exports.getSessionStats = async ({ sessionId }) => {
    // Get session info
    const session = await exports.getSessionById({ id: sessionId });
    if (!session) throw new CustomError("Session not found", 404);

    // Get total sales (split by payment method)
    const sql = `
        SELECT payment_method, SUM(total_amount) as total
        FROM orders
        WHERE cash_session_id = $1 AND payment_status = 'paid'
        GROUP BY payment_method;
    `;
    const result = await query(sql, [sessionId]);

    const stats = {
        openingCash: parseInt(session.openingCash || 0),
        cashSales: 0,
        cardSales: 0,
        freeSales: 0,
        totalSales: 0,
    };

    result.rows.forEach(row => {
        const total = parseInt(row.total || 0);
        if (row.paymentMethod === 'cash') stats.cashSales = total;
        else if (row.paymentMethod === 'card') stats.cardSales = total;
        else if (row.paymentMethod === 'free') stats.freeSales = total;
        stats.totalSales += total;
    });

    stats.expectedCash = stats.openingCash + stats.cashSales;

    return stats;
};

exports.getSessionReport = async ({ sessionId }) => {
    const sql = `
        SELECT 
            cs.id,
            cs.opening_cash,
            cs.closing_cash,
            cs.opening_time,
            cs.closing_time,
            cs.status,
            cs.timezone,
            u.full_name as cashier_name,
            u.email as cashier_email,
            tc.name as box_office_name,
            e.name as event_name,
            e.location as event_location,
            e.start_datetime as event_start,
            e.currency,
            (SELECT COUNT(*) FROM orders WHERE cash_session_id = cs.id AND payment_status = 'paid') as total_orders,
            (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE cash_session_id = cs.id AND payment_status = 'paid' AND payment_method = 'cash') as cash_total,
            (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE cash_session_id = cs.id AND payment_status = 'paid' AND payment_method = 'card') as card_total,
            (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE cash_session_id = cs.id AND payment_status = 'paid' AND payment_method = 'free') as free_total,
            (SELECT COALESCE(SUM((item->>'quantity')::int), 0) FROM orders o, jsonb_array_elements(o.items_ticket) item WHERE o.cash_session_id = cs.id AND o.payment_status = 'paid') as total_tickets_sold,
            (SELECT COALESCE(SUM((item->>'quantity')::int), 0) FROM orders o, jsonb_array_elements(o.items_product) item WHERE o.cash_session_id = cs.id AND o.payment_status = 'paid') as total_products_sold
        FROM cash_session cs
        JOIN app_user u ON cs.cashier_id = u.id
        JOIN event e ON cs.event_id = e.id
        LEFT JOIN ticket_counter tc ON cs.ticket_counter_id = tc.id
        WHERE cs.id = $1
    `;

    const result = await query(sql, [sessionId]);

    if (!result.rows[0]) {
        throw new CustomError("Session not found", 404);
    }

    const report = result.rows[0];

    // Parse integers
    report.openingCash = parseInt(report.openingCash || 0);
    report.closingCash = parseInt(report.closingCash || 0);
    report.cashTotal = parseInt(report.cashTotal || 0);
    report.cardTotal = parseInt(report.cardTotal || 0);
    report.freeTotal = parseInt(report.freeTotal || 0);
    report.totalTicketsSold = parseInt(report.totalTicketsSold || 0);
    report.totalProductsSold = parseInt(report.totalProductsSold || 0);

    // Calculate totals
    report.totalSales = report.cashTotal + report.cardTotal + report.freeTotal;
    report.expectedCash = report.openingCash + report.cashTotal;
    report.discrepancy = report.closingCash - report.expectedCash;

    return report;
};

exports.getSessions = async ({ cashierId, eventId, organizationId, status }) => {
    let sql = `
        SELECT cs.*, u.full_name as cashier_name, tc.name as ticket_counter_name, e.name as event_name, e.currency
        FROM cash_session cs
        JOIN app_user u ON cs.cashier_id = u.id
        JOIN event e ON cs.event_id = e.id
        LEFT JOIN ticket_counter tc ON cs.ticket_counter_id = tc.id
        WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (cashierId) {
        sql += ` AND cs.cashier_id = $${paramCount++}`;
        params.push(cashierId);
    }

    if (eventId) {
        sql += ` AND cs.event_id = $${paramCount++}`;
        params.push(eventId);
    }

    if (organizationId) {
        sql += ` AND cs.organization_id = $${paramCount++}`;
        params.push(organizationId);
    }

    if (status) {
        sql += ` AND cs.status = $${paramCount++}`;
        params.push(status);
    }

    sql += ` ORDER BY cs.opening_time DESC`;

    const result = await query(sql, params);
    return result.rows;
};
