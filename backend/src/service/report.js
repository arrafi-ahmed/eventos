const { query } = require("../db");
const CustomError = require("../model/CustomError");
const exceljs = require("exceljs");
const pdf = require('html-pdf-node');

/**
 * Get sales overview for an event or organization
 */
exports.getSalesOverview = async ({ eventIds, organizationId }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free')";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause = `JOIN event e ON o.event_id = e.id WHERE e.organization_id = $${paramIndex} AND o.payment_status IN ('paid', 'free')`;
        params.push(organizationId);
        paramIndex++;
    } else {
        throw new CustomError("Event ID(s) or Organization ID is required", 400);
    }

    const sql = `
        SELECT 
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(o.total_amount), 0) as total_revenue,
            COALESCE(SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END), 0) as collected_revenue,
            COUNT(DISTINCT CASE WHEN o.sales_channel = 'counter' THEN o.id END) as counter_orders,
            COUNT(DISTINCT CASE WHEN o.sales_channel = 'online' THEN o.id END) as online_orders
        FROM orders o
        ${whereClause.includes("JOIN") ? whereClause : "WHERE " + whereClause.split("WHERE")[1]}
    `;

    const result = await query(sql, params);
    const row = result.rows[0] || {};

    return {
        totalOrders: parseInt(row.totalOrders) || 0,
        totalRevenue: parseInt(row.totalRevenue) || 0,
        collectedRevenue: parseInt(row.collectedRevenue) || 0,
        counterOrders: parseInt(row.counterOrders) || 0,
        onlineOrders: parseInt(row.onlineOrders) || 0
    };
};

/**
 * Get sales breakdown by ticket counter
 */
exports.getSalesByTicketCounter = async ({ eventIds, organizationId, startDate, endDate }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free') AND o.ticket_counter_id IS NOT NULL";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause += ` AND e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND o.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND o.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    const sql = `
        SELECT 
            tc.name as counter_name,
            tc.location as location,
            o.currency,
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(o.total_amount), 0) as total_revenue
        FROM orders o
        JOIN event e ON o.event_id = e.id
        LEFT JOIN ticket_counter tc ON o.ticket_counter_id = tc.id
        ${whereClause}
        GROUP BY tc.id, tc.name, tc.location, o.currency
        ORDER BY total_revenue DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(row => ({
        counterName: row.counterName,
        location: row.location || '-',
        currency: row.currency,
        totalOrders: parseInt(row.totalOrders) || 0,
        totalRevenue: parseInt(row.totalRevenue) || 0
    }));
};

/**
 * Get sales breakdown by cashier
 */
exports.getSalesByCashier = async ({ eventIds, organizationId, startDate, endDate }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free') AND o.cashier_id IS NOT NULL";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause += ` AND e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND o.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND o.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    const sql = `
        SELECT 
            u.full_name as cashier_name,
            tc.name as counter_name,
            o.currency,
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(o.total_amount), 0) as total_revenue
        FROM orders o
        JOIN event e ON o.event_id = e.id
        LEFT JOIN app_user u ON o.cashier_id = u.id
        LEFT JOIN ticket_counter tc ON o.ticket_counter_id = tc.id
        ${whereClause}
        GROUP BY u.id, u.full_name, tc.name, o.currency
        ORDER BY total_revenue DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(row => ({
        cashierName: row.cashierName,
        counterName: row.counterName || '-',
        currency: row.currency,
        totalOrders: parseInt(row.totalOrders) || 0,
        totalRevenue: parseInt(row.totalRevenue) || 0
    }));
};

/**
 * Get daily sales breakdown
 */
exports.getDailySales = async ({ eventIds, organizationId, startDate, endDate, days = 30, timezone = 'UTC' }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free')";
    const params = [timezone];
    let paramIndex = 2;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause += ` AND e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND o.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    } else if (days && !endDate) {
        whereClause += ` AND o.created_at >= NOW() - interval '$${paramIndex} days'`;
        params.push(days);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND o.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    const sql = `
        SELECT 
            DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE $1) as sale_date,
            o.currency,
            COUNT(DISTINCT o.id) as total_orders,
            COALESCE(SUM(o.total_amount), 0) as total_revenue
        FROM orders o
        JOIN event e ON o.event_id = e.id
        ${whereClause}
        GROUP BY DATE(o.created_at AT TIME ZONE 'UTC' AT TIME ZONE $1), o.currency
        ORDER BY sale_date DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(row => ({
        saleDate: row.saleDate,
        currency: row.currency,
        totalOrders: parseInt(row.totalOrders) || 0,
        totalRevenue: parseInt(row.totalRevenue) || 0
    }));
};

/**
 * Get attendance overview
 */
exports.getAttendanceOverview = async ({ eventId }) => {
    if (!eventId) throw new CustomError("Event ID is required", 400);

    const sql = `
        SELECT 
            COUNT(a.id) as total_attendees,
            COUNT(c.id) as checked_in_count,
            (COUNT(a.id) - COUNT(c.id)) as remaining_count
        FROM registration r
        JOIN attendees a ON r.id = a.registration_id
        LEFT JOIN checkin c ON a.id = c.attendee_id
        WHERE r.event_id = $1 AND r.status = true
    `;

    const result = await query(sql, [eventId]);
    const row = result.rows[0] || {};

    return {
        totalAttendees: parseInt(row.totalAttendees) || 0,
        checkedInCount: parseInt(row.checkedInCount) || 0,
        remainingCount: parseInt(row.remainingCount) || 0
    };
};

/**
 * Export report to Excel
 */
exports.exportToExcel = async ({ data, sheetName = "Report" }) => {
    const workbook = new exceljs.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data && data.length > 0) {
        const columns = Object.keys(data[0]).map(key => ({
            header: key.replace(/([A-Z])/g, ' $1').toUpperCase(),
            key: key,
            width: 20
        }));
        worksheet.columns = columns;
        worksheet.addRows(data);
    }

    return workbook;
};

/**
 * Export report to PDF
 */
exports.exportToPDF = async ({ data, title = "Report" }) => {
    let html = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1 { text-align: center; color: #333; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                th { background-color: #1867C0; color: white; font-weight: bold; text-transform: uppercase; font-size: 10px; }
                tr:nth-child(even) { background-color: #f9f9f9; }
                .footer { margin-top: 30px; font-size: 10px; color: #777; text-align: right; }
            </style>
        </head>
        <body>
            <h1>${title}</h1>
            <table>
                <thead>
                    <tr>
    `;

    if (data && data.length > 0) {
        const keys = Object.keys(data[0]);
        keys.forEach(key => {
            const header = key.replace(/([A-Z])/g, ' $1').toUpperCase();
            html += `<th>${header}</th>`;
        });
        html += `</tr></thead><tbody>`;

        data.forEach(row => {
            html += `<tr>`;
            keys.forEach(key => {
                let val = row[key];
                if (val === null || val === undefined) val = '-';
                html += `<td>${val}</td>`;
            });
            html += `</tr>`;
        });
        html += `</tbody></table>`;
    } else {
        html += `</tr></thead><tbody><tr><td colspan="100%">No data available</td></tr></tbody></table>`;
    }

    html += `
            <div class="footer">Generated on ${new Date().toLocaleString()}</div>
        </body>
        </html>
    `;

    let options = {
        format: 'A4',
        landscape: true,
        margin: { top: 20, right: 20, bottom: 20, left: 20 }
    };
    let file = { content: html };

    return await pdf.generatePdf(file, options);
};

/**
 * Get sales breakdown by payment method
 */
exports.getSalesByPaymentMethod = async ({ eventIds, organizationId, startDate, endDate }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free')";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause += ` AND e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND o.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND o.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    const sql = `
        SELECT 
            o.payment_method,
            o.currency,
            COUNT(DISTINCT o.id) as total_orders,
            SUM(o.total_amount) as total_revenue,
            ROUND((COUNT(DISTINCT o.id)::numeric / NULLIF((SELECT COUNT(*) FROM orders o2 JOIN event e2 ON o2.event_id = e2.id ${whereClause.replace(/o\./g, 'o2.').replace(/e\./g, 'e2.')}), 0) * 100), 2) as percentage
        FROM orders o
        JOIN event e ON o.event_id = e.id
        ${whereClause}
        GROUP BY o.payment_method, o.currency
        ORDER BY total_revenue DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(row => ({
        paymentMethod: row.paymentMethod,
        currency: row.currency,
        totalOrders: parseInt(row.totalOrders) || 0,
        totalRevenue: parseInt(row.totalRevenue) || 0,
        percentage: parseFloat(row.percentage) || 0
    }));
};

/**
 * Get ticket capacity breakdown
 */
exports.getReportSummary = async ({ eventIds, startDate, endDate, organizationId }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free')";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause += ` AND e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND o.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND o.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    // Query for orders, tickets, and check-ins (based on orders)
    const summarySql = `
        SELECT 
            COUNT(DISTINCT o.id) as total_orders,
            COUNT(DISTINCT a.id) as total_tickets,
            COUNT(DISTINCT c.id) as checked_in
        FROM orders o
        JOIN event e ON o.event_id = e.id
        LEFT JOIN registration r ON o.registration_id = r.id
        LEFT JOIN attendees a ON r.id = a.registration_id
        LEFT JOIN checkin c ON a.id = c.attendee_id
        ${whereClause}
    `;

    // Separate query for total events (not dependent on orders)
    let eventWhereClause = "WHERE 1=1";
    const eventParams = [];
    let eventParamIndex = 1;

    if (eventIds && eventIds.length > 0) {
        eventWhereClause += ` AND e.id = ANY($${eventParamIndex})`;
        eventParams.push(eventIds);
        eventParamIndex++;
    } else if (organizationId) {
        eventWhereClause += ` AND e.organization_id = $${eventParamIndex}`;
        eventParams.push(organizationId);
        eventParamIndex++;
    }

    const eventCountSql = `
        SELECT 
            COUNT(DISTINCT e.id) as total_events,
            COUNT(DISTINCT e.organization_id) as total_organizers
        FROM event e
        ${eventWhereClause}
    `;

    const revenueSql = `
        SELECT o.currency, COALESCE(SUM(o.total_amount), 0) as total_revenue
        FROM orders o
        JOIN event e ON o.event_id = e.id
        ${whereClause}
        GROUP BY o.currency
    `;

    const summaryResult = await query(summarySql, params);
    const eventCountResult = await query(eventCountSql, eventParams);
    const revenueResult = await query(revenueSql, params);

    const row = summaryResult.rows[0] || {};
    const eventRow = eventCountResult.rows[0] || {};
    const revenues = revenueResult.rows.map(r => ({
        currency: r.currency,
        amount: parseInt(r.totalRevenue) || 0
    }));

    return {
        orders: parseInt(row.totalOrders) || 0,
        tickets: parseInt(row.totalTickets) || 0,
        attendees: parseInt(row.totalTickets) || 0,
        checkedIn: parseInt(row.checkedIn) || 0,
        events: parseInt(eventRow.totalEvents) || 0,
        organizers: parseInt(eventRow.totalOrganizers) || 0,
        revenues
    };
};

/**
 * Get ticket capacity breakdown
 */
exports.getTicketCapacity = async ({ eventIds, organizationId }) => {
    let whereClause = "";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause = `WHERE e.id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause = `WHERE e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    const sql = `
        SELECT 
            t.title as ticket_name,
            e.name as event_name,
            COALESCE(t.max_stock, 0) as total_capacity,
            t.current_stock as remaining,
            (COALESCE(t.max_stock, 0) - t.current_stock) as sold
        FROM ticket t
        JOIN event e ON t.event_id = e.id
        ${whereClause}
        ORDER BY sold DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(row => ({
        ticketName: row.ticketName,
        eventName: row.eventName,
        totalCapacity: parseInt(row.totalCapacity),
        remaining: parseInt(row.remaining),
        sold: parseInt(row.sold)
    }));
};

/**
 * Get sales channel breakdown (online vs counter)
 */
exports.getSalesChannelBreakdown = async ({ eventIds, startDate, endDate, organizationId }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free')";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause += ` AND e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND o.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND o.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    const sql = `
        SELECT 
            o.sales_channel,
            COUNT(DISTINCT o.id) as count,
            COALESCE(SUM(o.total_amount), 0) as revenue
        FROM orders o
        JOIN event e ON o.event_id = e.id
        ${whereClause}
        GROUP BY o.sales_channel
    `;

    const result = await query(sql, params);
    const channelMap = {
        'online': { name: 'Online', value: 0, revenue: 0 },
        'counter': { name: 'Counter', value: 0, revenue: 0 }
    };

    result.rows.forEach(row => {
        const channel = row.salesChannel === 'online' ? 'online' : 'counter';
        channelMap[channel].value += parseInt(row.count) || 0;
        channelMap[channel].revenue += parseInt(row.revenue) || 0;
    });

    return Object.values(channelMap);
};

/**
/**
 * Get sales by event
 */
exports.getSalesByEvent = async ({ eventIds, startDate, endDate, organizationId }) => {
    let whereClause = "";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause = `WHERE e.id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause = `WHERE e.organization_id = $${paramIndex} `;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += (whereClause.includes('WHERE') ? " AND " : "WHERE ") + `o.created_at >= $${paramIndex} `;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += (whereClause.includes('WHERE') ? " AND " : "WHERE ") + `o.created_at <= $${paramIndex} `;
        params.push(endDate);
        paramIndex++;
    }

    const sql = `
    SELECT
    e.name as event_name,
        e.start_datetime as event_date,
        e.currency,
        COUNT(DISTINCT o.id) as total_orders,
        COALESCE(SUM(o.total_amount), 0) as total_revenue,
        COUNT(DISTINCT CASE WHEN o.sales_channel = 'online' THEN o.id END) as online_orders,
        COUNT(DISTINCT CASE WHEN o.sales_channel = 'counter' THEN o.id END) as counter_orders
        FROM event e
        LEFT JOIN orders o ON e.id = o.event_id AND o.payment_status IN('paid', 'free')
        ${whereClause}
        GROUP BY e.id, e.name, e.start_datetime, e.currency
        ORDER BY total_revenue DESC
        `;

    const result = await query(sql, params);
    return result.rows.map(row => ({
        eventName: row.eventName,
        eventDate: row.eventDate,
        currency: row.currency,
        totalOrders: parseInt(row.totalOrders) || 0,
        totalRevenue: parseInt(row.totalRevenue) || 0,
        onlineOrders: parseInt(row.onlineOrders) || 0,
        counterOrders: parseInt(row.counterOrders) || 0
    }));
};
/**
 * Get detailed sales logs for cashiers
 */
exports.getDetailedCashierSales = async ({ eventIds, organizationId, startDate, endDate }) => {
    let whereClause = "WHERE o.payment_status IN ('paid', 'free') AND o.sales_channel = 'counter'";
    const params = [];
    let paramIndex = 1;

    if (eventIds && eventIds.length > 0) {
        whereClause += ` AND o.event_id = ANY($${paramIndex})`;
        params.push(eventIds);
        paramIndex++;
    } else if (organizationId) {
        whereClause += ` AND e.organization_id = $${paramIndex}`;
        params.push(organizationId);
        paramIndex++;
    }

    if (startDate) {
        whereClause += ` AND o.created_at >= $${paramIndex}`;
        params.push(startDate);
        paramIndex++;
    }

    if (endDate) {
        whereClause += ` AND o.created_at <= $${paramIndex}`;
        params.push(endDate);
        paramIndex++;
    }

    const sql = `
        SELECT 
            o.order_number,
            o.created_at as sale_date,
            u.full_name as cashier_name,
            tc.name as counter_name,
            item->>'title' as ticket_title,
            (item->>'price')::int as ticket_price,
            (item->>'quantity')::int as quantity,
            o.payment_method,
            o.currency,
            o.total_amount
        FROM orders o
        JOIN event e ON o.event_id = e.id
        LEFT JOIN app_user u ON o.cashier_id = u.id
        LEFT JOIN ticket_counter tc ON o.ticket_counter_id = tc.id
        CROSS JOIN LATERAL jsonb_array_elements(o.items_ticket) item
        ${whereClause}
        ORDER BY o.created_at DESC
    `;

    const result = await query(sql, params);
    return result.rows.map(row => ({
        orderNumber: row.orderNumber,
        saleDate: row.saleDate,
        cashierName: row.cashierName || 'Online/System',
        counterName: row.counterName || '-',
        ticketTitle: row.ticketTitle,
        ticketPrice: parseInt(row.ticketPrice) || 0,
        quantity: parseInt(row.quantity) || 0,
        paymentMethod: row.paymentMethod,
        currency: row.currency,
        totalAmount: parseInt(row.totalAmount) || 0
    }));
};
