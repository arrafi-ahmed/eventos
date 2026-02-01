const html_to_pdf = require('html-pdf-node');
const { generateQrData } = require("../utils/common");
const { getBrandingData } = require("../utils/branding");
const CustomError = require("../model/CustomError");
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');
const { formatInTimezone, formatDateOnly, formatTimeOnly, formatDateTime } = require('../utils/date');

/**
 * Generate a premium PDF ticket for an attendee using HTML template
 */
exports.generateTicketPdf = async ({ attendee, event, organization }) => {
    try {
        const qrData = await generateQrData({
            registrationId: attendee.registrationId,
            attendeeId: attendee.id,
            qrUuid: attendee.qrUuid,
        });

        const qrCodeWithPrefix = `data:image/png;base64,${qrData}`;

        // Load and compile template
        const templatePath = path.join(__dirname, '..', 'templates', 'premiumTicket.html');
        const templateSource = fs.readFileSync(templatePath, 'utf8');
        const template = handlebars.compile(templateSource);

        const userTimezone = attendee.userTimezone || 'UTC';

        const header = await getBrandingData();

        const html = template({
            header,
            organizationName: organization?.name || 'Ticketi Organization',
            eventName: event.name,
            eventDateTime: event.startDate ? formatDateTime(event.startDate, userTimezone) : 'Date TBA',
            location: event.location || 'Online',
            attendeeName: `${attendee.firstName} ${attendee.lastName}`,
            attendeeEmail: attendee.email || attendee.phone || '',
            isEmail: !!attendee.email,
            ticketTitle: attendee.ticket?.title || attendee.ticketTitle || 'General Admission',
            qrCode: qrCodeWithPrefix,
            ticketUuid: (attendee.qrUuid || 'N/A').split('-')[0].toUpperCase(),
        });

        const options = {
            format: 'A4',
            printBackground: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
        const file = { content: html };

        // Generate PDF buffer
        const pdfBuffer = await new Promise((resolve, reject) => {
            html_to_pdf.generatePdf(file, options, (err, buffer) => {
                if (err) reject(err);
                else resolve(buffer);
            });
        });

        return pdfBuffer;
    } catch (error) {
        console.error("PDF Generation Detailed Error:", error);
        throw new CustomError(`Failed to generate PDF ticket: ${error.message}`, 500);
    }
};

/**
 * Generate cash session report as Excel with detailed transaction logs
 */
exports.generateSessionReportExcel = async ({ reportData, transactions }) => {
    try {
        const exceljs = require('exceljs');
        const workbook = new exceljs.Workbook();

        // Summary Sheet
        const summarySheet = workbook.addWorksheet('Session Summary');

        // Header styling
        const headerStyle = {
            font: { bold: true, size: 12 },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } },
            font: { bold: true, color: { argb: 'FFFFFFFF' } },
            alignment: { vertical: 'middle', horizontal: 'left' }
        };

        // Session Information
        summarySheet.addRow(['CASH SESSION REPORT']).font = { bold: true, size: 16 };
        summarySheet.addRow([]);
        summarySheet.addRow(['Session Information']);
        summarySheet.getRow(3).font = { bold: true, size: 14 };

        const sessionInfo = [
            ['Cashier:', reportData.cashierName],
            ['Box Office:', reportData.boxOfficeName || 'N/A'],
            ['Event:', reportData.eventName],
            ['Location:', reportData.eventLocation || 'N/A'],
            ['Opening Time:', new Date(reportData.openingTime).toLocaleString('en-US', { timeZone: reportData.timezone })],
            ['Closing Time:', reportData.closingTime ? new Date(reportData.closingTime).toLocaleString('en-US', { timeZone: reportData.timezone }) : 'Still Open'],
        ];

        sessionInfo.forEach(row => {
            const addedRow = summarySheet.addRow(row);
            addedRow.getCell(1).font = { bold: true };
        });

        summarySheet.addRow([]);

        // Sales Summary
        summarySheet.addRow(['Sales Summary']);
        summarySheet.getRow(summarySheet.lastRow.number).font = { bold: true, size: 14 };

        const salesInfo = [
            ['Total Orders:', reportData.totalOrders],
            ['Tickets Sold:', reportData.totalTicketsSold],
            ['Products Sold:', reportData.totalProductsSold],
            [''],
            ['Cash Payments:', `$${(reportData.cashTotal / 100).toFixed(2)}`],
            ['Card Payments:', `$${(reportData.cardTotal / 100).toFixed(2)}`],
            ['Free/Comp:', `$${(reportData.freeTotal / 100).toFixed(2)}`],
            ['Total Sales:', `$${(reportData.totalSales / 100).toFixed(2)}`],
        ];

        salesInfo.forEach(row => {
            const addedRow = summarySheet.addRow(row);
            if (row[0]) addedRow.getCell(1).font = { bold: true };
        });

        summarySheet.addRow([]);

        // Cash Reconciliation
        summarySheet.addRow(['Cash Reconciliation']);
        summarySheet.getRow(summarySheet.lastRow.number).font = { bold: true, size: 14 };

        const reconciliation = [
            ['Opening Cash:', `$${(reportData.openingCash / 100).toFixed(2)}`],
            ['Cash Sales:', `$${(reportData.cashTotal / 100).toFixed(2)}`],
            ['Expected Cash:', `$${(reportData.expectedCash / 100).toFixed(2)}`],
            ['Counted Cash:', `$${(reportData.closingCash / 100).toFixed(2)}`],
            [''],
            ['Discrepancy:', `$${(Math.abs(reportData.discrepancy) / 100).toFixed(2)}`],
            ['Status:', reportData.discrepancy === 0 ? 'Balanced' : (reportData.discrepancy > 0 ? 'Over' : 'Short')],
        ];

        reconciliation.forEach(row => {
            const addedRow = summarySheet.addRow(row);
            addedRow.getCell(1).font = { bold: true };
            if (row[0] === 'Discrepancy:' || row[0] === 'Status:') {
                const color = reportData.discrepancy === 0 ? 'FF00B050' : (reportData.discrepancy > 0 ? 'FFFFC000' : 'FFFF0000');
                addedRow.getCell(2).font = { bold: true, color: { argb: color } };
            }
        });

        // Set column widths
        summarySheet.getColumn(1).width = 25;
        summarySheet.getColumn(2).width = 30;

        // Transaction Logs Sheet
        if (transactions && transactions.length > 0) {
            const logsSheet = workbook.addWorksheet('Transaction Logs');

            logsSheet.columns = [
                { header: 'Order #', key: 'orderNumber', width: 20 },
                { header: 'Date/Time', key: 'createdAt', width: 20 },
                { header: 'Payment Method', key: 'paymentMethod', width: 15 },
                { header: 'Amount', key: 'totalAmount', width: 12 },
                { header: 'Tickets', key: 'ticketCount', width: 10 },
                { header: 'Products', key: 'productCount', width: 10 },
                { header: 'Customer Email', key: 'customerEmail', width: 30 },
            ];

            // Style header row
            logsSheet.getRow(1).eachCell(cell => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            // Add transaction data
            transactions.forEach(tx => {
                logsSheet.addRow({
                    orderNumber: tx.orderNumber,
                    createdAt: new Date(tx.createdAt).toLocaleString('en-US', { timeZone: reportData.timezone }),
                    paymentMethod: tx.paymentMethod.toUpperCase(),
                    totalAmount: `$${(tx.totalAmount / 100).toFixed(2)}`,
                    ticketCount: tx.ticketCount || 0,
                    productCount: tx.productCount || 0,
                    customerEmail: tx.customerEmail || 'N/A',
                });
            });

            // Add borders to all cells
            logsSheet.eachRow((row, rowNumber) => {
                row.eachCell(cell => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });
            });
        }

        return workbook;
    } catch (error) {
        console.error("Session Report Excel Generation Error:", error);
        throw new CustomError("Failed to generate session report Excel", 500);
    }
};

/**
 * Generate cash session report PDF
 */
exports.generateSessionReport = async ({ reportData }) => {
    try {
        const {
            cashierName,
            boxOfficeName,
            eventName,
            eventLocation,
            openingTime,
            closingTime,
            openingCash,
            closingCash,
            cashTotal,
            cardTotal,
            freeTotal,
            totalSales,
            totalTicketsSold,
            totalProductsSold,
            totalOrders,
            expectedCash,
            discrepancy,
            currency
        } = reportData;

        const formatCurrency = (amount) => {
            const code = (currency || 'USD').toUpperCase();
            return `${code} ${(amount / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        };

        const formatDateHelper = (date) => {
            return formatDateTime(date, reportData.timezone);
        };

        const discrepancyClass = discrepancy === 0 ? 'balanced' : (discrepancy > 0 ? 'over' : 'short');
        const discrepancyLabel = discrepancy === 0 ? 'Balanced' : (discrepancy > 0 ? 'Over' : 'Short');

        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; background: #fff; line-height: 1.4; color: #333; }
        .report { max-width: 800px; margin: 0 auto; padding: 20px; border: 1px solid #eee; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1976D2; padding-bottom: 10px; margin-bottom: 20px; }
        .header h1 { color: #1976D2; font-size: 22px; }
        .header .subtitle { color: #666; font-size: 11px; }
        .section { margin-bottom: 15px; }
        .section-title { background: #f8fbff; padding: 6px 12px; font-weight: 600; color: #1976D2; margin-bottom: 10px; border-left: 3px solid #1976D2; font-size: 13px; text-transform: uppercase; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
        .info-item { padding: 8px; background: #fafafa; border-radius: 4px; border: 1px solid #f0f0f0; }
        .info-label { font-size: 10px; color: #666; margin-bottom: 2px; text-transform: uppercase; }
        .info-value { font-size: 13px; font-weight: 600; color: #333; }
        .stats-summary { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 15px; }
        .stat-small-card { flex: 1; background: #fff; padding: 10px; border-radius: 6px; border: 1px solid #e0e0e0; text-align: center; }
        .stat-small-label { font-size: 10px; color: #666; margin-bottom: 2px; }
        .stat-small-value { font-size: 18px; font-weight: bold; color: #1976D2; }
        .reconciliation-box { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .reconciliation-table { width: 100%; border: 1px solid #e0e0e0; border-radius: 4px; overflow: hidden; }
        .reconciliation-row { display: flex; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid #f0f0f0; font-size: 12px; }
        .reconciliation-row:last-child { border-bottom: none; }
        .reconciliation-row.highlight { background: #E3F2FD; font-weight: bold; color: #1976D2; font-size: 14px; }
        .discrepancy-card { padding: 15px; border-radius: 6px; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; }
        .discrepancy-card.balanced { background: #E8F5E9; border: 1px solid #2E7D32; color: #1B5E20; }
        .discrepancy-card.over { background: #FFF3E0; border: 1px solid #EF6C00; color: #E65100; }
        .discrepancy-card.short { background: #FFEBEE; border: 1px solid #C62828; color: #B71C1C; }
        .discrepancy-title { font-size: 11px; text-transform: uppercase; margin-bottom: 5px; opacity: 0.8; }
        .discrepancy-amount { font-size: 24px; font-weight: 800; }
        .footer { margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; text-align: center; color: #bbb; font-size: 10px; }
        table.sales-table { width: 100%; border-collapse: collapse; font-size: 12px; }
        table.sales-table th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-weight: 600; color: #666; border-bottom: 2px solid #e0e0e0; }
        table.sales-table td { padding: 8px 12px; border-bottom: 1px solid #f0f0f0; }
        .text-right { text-align: right; }
        .font-bold { font-weight: bold; }
    </style>
</head>
<body>
    <div class="report">
        <div class="header">
            <h1>Cash Session Report</h1>
            <div class="subtitle">Generated on ${formatDateHelper(new Date())}</div>
        </div>

        <div class="section">
            <div class="section-title">Session Information</div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">Cashier</div>
                    <div class="info-value">${cashierName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Box Office</div>
                    <div class="info-value">${boxOfficeName || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Event</div>
                    <div class="info-value">${eventName}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Location</div>
                    <div class="info-value">${eventLocation || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Opening Time</div>
                    <div class="info-value">${formatDateHelper(openingTime)}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Closing Time</div>
                    <div class="info-value">${closingTime ? formatDateHelper(closingTime) : 'Still Open'}</div>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-title">Sales Summary</div>
            <div class="stats-summary">
                <div class="stat-small-card">
                    <div class="stat-small-label">Orders</div>
                    <div class="stat-small-value">${totalOrders}</div>
                </div>
                <div class="stat-small-card">
                    <div class="stat-small-label">Tickets Sold</div>
                    <div class="stat-small-value">${totalTicketsSold}</div>
                </div>
                <div class="stat-small-card">
                    <div class="stat-small-label">Products Sold</div>
                    <div class="stat-small-value">${totalProductsSold}</div>
                </div>
            </div>

            <table class="sales-table">
                <thead>
                    <tr>
                        <th>Payment Method</th>
                        <th class="text-right">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Cash Payments</td>
                        <td class="text-right">${formatCurrency(cashTotal)}</td>
                    </tr>
                    <tr>
                        <td>Card Payments</td>
                        <td class="text-right">${formatCurrency(cardTotal)}</td>
                    </tr>
                    ${freeTotal > 0 ? `
                    <tr>
                        <td>Free/Comp</td>
                        <td class="text-right">${formatCurrency(freeTotal)}</td>
                    </tr>
                    ` : ''}
                    <tr class="highlight font-bold" style="background: #fdfdfd;">
                        <td>Total Sales</td>
                        <td class="text-right">${formatCurrency(totalSales)}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="section">
            <div class="section-title">Cash Reconciliation</div>
            <div class="reconciliation-box">
                <div class="reconciliation-table">
                    <div class="reconciliation-row">
                        <span>Opening Cash Balance</span>
                        <span>${formatCurrency(openingCash)}</span>
                    </div>
                    <div class="reconciliation-row">
                        <span>Total Cash Sales</span>
                        <span>${formatCurrency(cashTotal)}</span>
                    </div>
                    <div class="reconciliation-row highlight">
                        <span>Expected Cash</span>
                        <span>${formatCurrency(expectedCash)}</span>
                    </div>
                    <div class="reconciliation-row">
                        <span>Actual Counted Cash</span>
                        <span>${formatCurrency(closingCash)}</span>
                    </div>
                </div>
                
                <div class="discrepancy-card ${discrepancyClass}">
                    <div class="discrepancy-title">${discrepancyLabel}</div>
                    <div class="discrepancy-amount">${formatCurrency(Math.abs(discrepancy))}</div>
                </div>
            </div>
        </div>

        <div class="footer">
            This is an automated report. For questions, please contact your supervisor.
        </div>
    </div>
</body>
</html>
        `;

        const options = {
            format: 'A4',
            printBackground: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        };
        const file = { content: html };

        const pdfBuffer = await new Promise((resolve, reject) => {
            html_to_pdf.generatePdf(file, options, (err, buffer) => {
                if (err) reject(err);
                else resolve(buffer);
            });
        });

        return pdfBuffer;
    } catch (error) {
        console.error("Session Report PDF Generation Error:", error);
        throw new CustomError("Failed to generate session report PDF", 500);
    }
};
