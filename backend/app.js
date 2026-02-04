require("dotenv").config({
    path:
        process.env.NODE_ENV === "production"
            ? ".env.production"
            : ".env.development",
});
process.env.TZ = "UTC";

const express = require("express");
const imageFallback = require("./src/middleware/imageFallback");

const app = express();
const path = require("path");

const customHelmet = require("./src/middleware/customHelmet");
const customCors = require("./src/middleware/customCors");
const {
    globalErrHandler,
    uncaughtErrHandler,
} = require("./src/middleware/errHandler");
const suppressToastMiddleware = require("./src/middleware/suppressToast");
const { appInfo } = require("./src/utils/common");
const ApiResponse = require("./src/model/ApiResponse");
const { initializeScheduler } = require("./src/scheduler");
const port = process.env.PORT || 3001;

// Unified Stripe webhook route (Needs raw body for signature verification)
app.post(
    "/payment/webhook/stripe",
    express.raw({ type: "application/json" }),
    (req, res, next) => {
        req.params.gateway = 'stripe';
        next();
    },
    require("./src/controller/payment").webhook,
);

//middlewares
app.use(customHelmet);
app.use(customCors);

app.use(imageFallback);
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply suppress toast middleware globally
app.use(suppressToastMiddleware);

//routes
app.use("/auth", require("./src/controller/auth"));
app.use("/organization", require("./src/controller/organization"));
app.use("/event", require("./src/controller/event"));
app.use("/registration", require("./src/controller/registration"));
app.use("/checkin", require("./src/controller/checkin"));
app.use("/form", require("./src/controller/form"));
app.use("/appUser", require("./src/controller/appUser"));
app.use("/payment", require("./src/controller/payment").router);
app.use("/stripe", require("./src/controller/stripe").router);
app.use("/ticket", require("./src/controller/ticket"));
app.use("/order", require("./src/controller/order"));
app.use("/temp-registration", require("./src/controller/tempRegistration"));
app.use("/product", require("./src/controller/product"));
app.use("/product-order", require("./src/controller/productOrder"));
app.use("/organizer", require("./src/controller/organizer"));
app.use("/admin/sales-export", require("./src/controller/salesExport"));
app.use("/admin", require("./src/controller/admin"));
app.use("/abandoned-cart", require("./src/controller/abandonedCart"));
app.use("/event-visitor", require("./src/controller/eventVisitor"));
app.use("/profile", require("./src/controller/profile"));
app.use("/user-settings", require("./src/controller/userSettings"));
app.use("/system-settings", require("./src/controller/systemSettings"));
app.use("/layout-cache", require("./src/controller/layoutCache"));
app.use("/homepage", require("./src/controller/homepage"));
app.use("/layout", require("./src/controller/layout"));
app.use("/scheduler", require("./src/controller/scheduler"));
app.use("/support", require("./src/controller/support"));
app.use("/ticket-counter", require("./src/controller/ticketCounter"));
app.use("/counter", require("./src/controller/counter"));
app.use("/attendee-order", require("./src/controller/attendeeOrder"));
app.use("/promo-code", require("./src/controller/promoCode"));
app.use("/staff", require("./src/controller/staff"));
app.use("/user", require("./src/controller/user"));
app.use("/report", require("./src/controller/report"));
app.get("/info", (req, res) => {
    res.status(200).json(new ApiResponse('Request successful!', appInfo));
});

app.listen(port, (err) => {
    if (err) return console.error(err);
    console.log(`Server started at ${port} - ${new Date()}`);

    // Initialize all scheduled cron jobs
    initializeScheduler();
});

uncaughtErrHandler();
app.use(globalErrHandler);
