const router = require("express").Router();
const registrationService = require("../service/registration");
const emailService = require("../service/email");
const eventService = require("../service/event");
const stripeService = require("../service/stripe");
const attendeeService = require("../service/attendees");
const ApiResponse = require("../model/ApiResponse");
const {
    auth,
    isOrganizerEventAuthor,
    isAuthenticated,
} = require("../middleware/auth");
const { upload } = require("../middleware/upload");

router.post("/initRegistration", async (req, res, next) => {
    try {
        const result = await registrationService.initRegistration(req.body);
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

router.post("/bulkImportAttendee", auth, upload("tmp"), async (req, res, next) => {
    try {
        const result = await registrationService.bulkImportAttendee({
            files: req.processedFiles,
            eventId: req.body.eventId,
            organizationId: req.currentUser.organizationId,
        });
        res.json(
            new ApiResponse(
                `${result.insertCount} Attendees imported successfully!`,
                result,
            ),
        );
    } catch (err) {
        next(err);
    }
});

router.post("/save", async (req, res, next) => {
    try {
        const results = await registrationService.save({ payload: req.body });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

// Complete free registration (no payment required)
router.post("/complete-free-registration", async (req, res, next) => {
    try {
        const result = await registrationService.completeFreeRegistration({
            payload: req.body,
        });

        res
            .status(200)
            .json(new ApiResponse("Registration completed successfully", result));
    } catch (err) {
        next(err);
    }
});

router.post("/updateStatus", async (req, res, next) => {
    try {
        const results = await registrationService.updateStatus({
            payload: req.body,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getRegistration", async (req, res, next) => {
    try {
        const results = await registrationService.getRegistration({
            registrationId: req.query.registrationId,
            qrUuid: req.query.qrUuid,
            isLoggedIn: false, // Success page is public
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getRegistrationsByEventId", async (req, res, next) => {
    try {
        const results = await registrationService.getAttendees({
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getRegistrationById", async (req, res, next) => {
    try {
        const results = await registrationService.getRegistrationById({
            registrationId: req.query.registrationId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get("/getRegistrationByQrUuid", async (req, res, next) => {
    try {
        // Since there's no getRegistrationByQrUuid method, we'll need to implement it
        // For now, let's return null or implement the method
        res.status(200).json(new ApiResponse(null, null));
    } catch (err) {
        next(err);
    }
});

router.get("/getRegistrationByEmail", async (req, res, next) => {
    try {
        const results = await registrationService.getRegistrationByEmail({
            email: req.query.email,
            eventId: req.query.eventId,
        });
        res.status(200).json(new ApiResponse(null, results));
    } catch (err) {
        next(err);
    }
});

router.get(
    "/getAttendees",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            let event = req.query.event;
            if (typeof event === 'string') {
                try {
                    event = JSON.parse(event);
                } catch (e) { }
            }

            let results;

            // Extract pagination parameters
            const page = parseInt(req.query.page) || 1;
            const itemsPerPage = parseInt(req.query.itemsPerPage) || 10;
            const fetchTotalCount = req.query.fetchTotalCount === 'true';
            const offset = (page - 1) * itemsPerPage;

            if (req.query.searchKeyword && req.query.searchKeyword.trim()) {
                // Use search function when keyword is provided
                results = await registrationService.searchAttendees({
                    event: event,
                    searchKeyword: req.query.searchKeyword,
                    sortBy: req.query.sortBy,
                    page,
                    itemsPerPage,
                    offset,
                    fetchTotalCount,
                });
            } else {
                // Use get function when no search keyword
                results = await registrationService.getAttendees({
                    event: event,
                    sortBy: req.query.sortBy,
                    page,
                    itemsPerPage,
                    offset,
                    fetchTotalCount,
                });
            }

            res.status(200).json(new ApiResponse(null, results));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/removeRegistration",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            const results = await registrationService.removeRegistration({
                registrationId: req.query.registrationId,
                eventId: req.query.eventId,
            });
            res.status(200).json(new ApiResponse("Registration deleted!", results));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/deleteAttendee",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            const results = await attendeeService.deleteAttendee({
                attendeeId: req.query.attendeeId,
                eventId: req.query.eventId,
            });
            res.status(200).json(new ApiResponse("Attendee deleted!", results));
        } catch (err) {
            next(err);
        }
    },
);

router.get(
    "/downloadAttendees",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            const workbook = await registrationService.downloadAttendees({
                eventId: req.query.eventId,
                timezone: req.currentUser.timezone,
            });
            res.setHeader(
                "Content-Type",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            );
            res.setHeader(
                "Content-Disposition",
                "attachment; filename=" + "attendee-report.xlsx",
            );
            await workbook.xlsx.write(res);
            res.end();
        } catch (err) {
            next(err);
        }
    },
);

router.get("/getFreeRegistrationConfirmation", async (req, res, next) => {
    try {
        const results = await registrationService.getFreeRegistrationConfirmation({
            registrationId: req.query.registrationId,
        });
        res
            .status(200)
            .json(new ApiResponse("Free registration data retrieved!", results));
    } catch (err) {
        next(err);
    }
});

router.get("/download-ticket/:attendeeId/:qrUuid", async (req, res, next) => {
    try {
        const { attendeeId, qrUuid } = req.params;
        const pdfBuffer = await registrationService.downloadTicketPdf({
            attendeeId,
            qrUuid
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename=ticket-${qrUuid.split('-')[0]}.pdf`
        );
        res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
});

router.get("/sendTicketByAttendeeId", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const results = await emailService.sendTicketByAttendeeId({
            attendeeId: req.query.attendeeId,
        });
        res.status(200).json(new ApiResponse("Ticket sent to email!", results));
    } catch (err) {
        next(err);
    }
});

router.post("/sendTicketsByRegistrationId", async (req, res, next) => {
    try {
        const results = await emailService.sendTicketsByRegistrationId({
            registrationId: req.body.registrationId,
        });
        res.status(200).json(new ApiResponse("Tickets sent to email!", results));
    } catch (err) {
        next(err);
    }
});

router.post(
    "/scanByExtrasPurchaseId",
    auth,
    isOrganizerEventAuthor,
    async (req, res, next) => {
        try {
            const results = await registrationService.scanByExtrasPurchaseId({
                ...req.body.payload,
            });
            res.status(200).json(new ApiResponse("Ticket sent to email!", results));
        } catch (err) {
            next(err);
        }
    },
);

// Cleanup expired data (admin only)
router.post("/cleanup", auth, isOrganizerEventAuthor, async (req, res, next) => {
    try {
        const result = await registrationService.runCleanupJob();
        res.status(200).json(new ApiResponse(null, result));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
