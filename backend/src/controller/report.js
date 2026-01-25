const router = require("express").Router();
const reportService = require("../service/report");
const ApiResponse = require("../model/ApiResponse");
const { auth, isOrganizationManager, isOrganizerEventAuthor } = require("../middleware/auth");

router.get("/overview", auth, async (req, res, next) => {
    try {
        const { eventId, organizationId } = req.query;
        const result = await reportService.getSalesOverview({ eventId, organizationId });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

router.get("/by-counter", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const { eventId, organizationId } = req.query;
        const results = await reportService.getSalesByTicketCounter({ eventId, organizationId });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/by-cashier", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const { eventId, organizationId } = req.query;
        const results = await reportService.getSalesByCashier({ eventId, organizationId });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/daily", auth, async (req, res, next) => {
    try {
        const { eventId, organizationId, days } = req.query;
        const results = await reportService.getDailySales({
            eventId,
            organizationId,
            days: parseInt(days) || 30,
            timezone: req.currentUser.timezone
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/attendance", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const { eventId } = req.query;
        const result = await reportService.getAttendanceOverview({ eventId });
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

router.get("/export/excel", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const { type, eventId, organizationId } = req.query;
        let data;
        let sheetName = "Report";

        if (type === 'counter') {
            data = await reportService.getSalesByTicketCounter({ eventId, organizationId });
            sheetName = "Sales by Counter";
        } else if (type === 'cashier') {
            data = await reportService.getSalesByCashier({ eventId, organizationId });
            sheetName = "Sales by Cashier";
        } else {
            data = await reportService.getDailySales({ eventId, organizationId });
            sheetName = "Daily Sales";
        }

        const workbook = await reportService.exportToExcel({ data, sheetName });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader(
            "Content-Disposition",
            "attachment; filename=" + `report-${Date.now()}.xlsx`,
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        next(err);
    }
});

// New comprehensive reporting endpoints
router.get("/summary", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const { reportType, eventIds, startDate, endDate, tableOnly } = req.query;
        const organizationId = req.currentUser.organizationId;
        const isTableOnly = tableOnly === 'true';

        // Parse eventIds if provided
        const parsedEventIds = eventIds ? (Array.isArray(eventIds) ? eventIds : eventIds.split(',').map(id => parseInt(id))) : null;

        let summary = null;
        let capacity = null;
        let channels = null;

        if (!isTableOnly) {
            // Get summary statistics
            summary = await reportService.getReportSummary({
                eventIds: parsedEventIds,
                startDate,
                endDate,
                organizationId
            });

            // Get capacity data
            capacity = await reportService.getTicketCapacity({
                eventIds: parsedEventIds,
                organizationId
            });

            // Get sales channel breakdown
            channels = await reportService.getSalesChannelBreakdown({
                eventIds: parsedEventIds,
                startDate,
                endDate,
                organizationId
            });
        }

        // Get table data based on report type
        let tableData = [];
        switch (reportType) {
            case 'event':
                tableData = await reportService.getSalesByEvent({
                    eventIds: parsedEventIds,
                    startDate,
                    endDate,
                    organizationId
                });
                break;
            case 'day':
                tableData = await reportService.getDailySales({
                    eventIds: parsedEventIds,
                    organizationId,
                    days: 30
                });
                break;
            case 'counter':
                tableData = await reportService.getSalesByTicketCounter({
                    eventIds: parsedEventIds,
                    organizationId
                });
                break;
            case 'cashier':
                tableData = await reportService.getSalesByCashier({
                    eventIds: parsedEventIds,
                    organizationId
                });
                break;
            case 'payment':
                tableData = await reportService.getSalesByPaymentMethod({
                    eventIds: parsedEventIds,
                    organizationId,
                    startDate,
                    endDate
                });
                break;
        }

        res.status(200).json(new ApiResponse(null, {
            summary,
            capacity,
            channels,
            tableData
        }));
    } catch (err) {
        next(err);
    }
});

router.get("/export", auth, isOrganizationManager, async (req, res, next) => {
    try {
        const { format, reportType, eventIds, startDate, endDate } = req.query;
        const organizationId = req.currentUser.organizationId;

        const parsedEventIds = eventIds ? eventIds.split(',').map(id => parseInt(id)) : null;

        let data = [];
        let sheetName = "Report";

        // Get data based on report type
        switch (reportType) {
            case 'event':
                data = await reportService.getSalesByEvent({
                    eventIds: parsedEventIds,
                    startDate,
                    endDate,
                    organizationId
                });
                sheetName = "Sales by Event";
                break;
            case 'day':
                data = await reportService.getDailySales({
                    eventIds: parsedEventIds,
                    organizationId,
                    startDate,
                    endDate
                });
                sheetName = "Daily Sales";
                break;
            case 'counter':
                data = await reportService.getSalesByTicketCounter({
                    eventIds: parsedEventIds,
                    organizationId,
                    startDate,
                    endDate
                });
                sheetName = "Sales by Counter";
                break;
            case 'cashier':
                data = await reportService.getSalesByCashier({
                    eventIds: parsedEventIds,
                    organizationId,
                    startDate,
                    endDate
                });
                sheetName = "Sales by Cashier";
                break;
            case 'payment':
                data = await reportService.getSalesByPaymentMethod({
                    eventIds: parsedEventIds,
                    organizationId,
                    startDate,
                    endDate
                });
                sheetName = "Sales by Payment Method";
                break;
        }

        if (format === 'excel') {
            const workbook = await reportService.exportToExcel({ data, sheetName });

            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            );
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=report-${reportType}-${Date.now()}.xlsx`,
            );

            await workbook.xlsx.write(res);
            res.end();
        } else if (format === 'pdf') {
            const pdfBuffer = await reportService.exportToPDF({ data, title: sheetName });

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=report-${reportType}-${Date.now()}.pdf`,
            );

            res.send(pdfBuffer);
        } else {
            // Default to JSON for other formats
            res.status(200).json(new ApiResponse(null, { data, reportType }));
        }
    } catch (err) {
        next(err);
    }
});

module.exports = router;
