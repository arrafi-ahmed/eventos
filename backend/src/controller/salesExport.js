const router = require("express").Router();
const salesExportService = require("../service/salesExport");
const ApiResponse = require("../model/ApiResponse");
const { auth, isAdmin } = require("../middleware/auth");

/**
 * Export sales data in Billit-ready format
 * GET /admin/sales-export?format=csv|json&eventId=123&startDate=2024-01-01&endDate=2024-12-31
 */
router.get("/", auth, isAdmin, async (req, res, next) => {
    try {
        const { format = 'csv', eventId, startDate, endDate } = req.query;

        if (!['csv', 'json'].includes(format.toLowerCase())) {
            return res.status(400).json(new ApiResponse("Format must be 'csv' or 'json'"));
        }

        // Parse dates if provided
        let parsedStartDate = null;
        let parsedEndDate = null;

        if (startDate) {
            parsedStartDate = new Date(startDate);
            if (isNaN(parsedStartDate.getTime())) {
                return res.status(400).json(new ApiResponse("Invalid startDate format. Use YYYY-MM-DD"));
            }
        }

        if (endDate) {
            parsedEndDate = new Date(endDate);
            if (isNaN(parsedEndDate.getTime())) {
                return res.status(400).json(new ApiResponse("Invalid endDate format. Use YYYY-MM-DD"));
            }
            // Set to end of day
            parsedEndDate.setHours(23, 59, 59, 999);
        }

        // Get sales data
        const orders = await salesExportService.getSalesForExport({
            eventId: eventId ? parseInt(eventId) : null,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
        });

        // Format for Billit
        const lineItems = salesExportService.formatForBillit(orders, req.currentUser.timezone);

        if (lineItems.length === 0) {
            return res.status(404).json(new ApiResponse("No sales data found for the specified criteria"));
        }

        // Generate file content
        let content;
        let contentType;
        let filename;

        if (format.toLowerCase() === 'json') {
            content = salesExportService.toJSON(lineItems);
            contentType = 'application/json';
            filename = `sales-export-${Date.now()}.json`;
        } else {
            content = salesExportService.toCSV(lineItems);
            contentType = 'text/csv';
            filename = `sales-export-${Date.now()}.csv`;
        }

        // Set headers for file download
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', Buffer.byteLength(content, 'utf8'));

        // Send file
        res.send(content);
    } catch (err) {
        next(err);
    }
});

module.exports = router;

