/**
 * Cron Job Definitions
 *
 * This file contains all scheduled job configurations.
 * Each job should have:
 * - name: Descriptive name for logging
 * - schedule: Cron expression (https://crontab.guru/)
 * - task: Async function to execute
 * - enabled: Whether the job is enabled (default: true)
 * - envKey: Optional environment variable to control enablement
 */

const abandonedCartService = require("../service/abandonedCart");

/**
 * All scheduled jobs configuration
 * Add new jobs here following the same pattern
 */
const jobs = [
    {
        name: "Abandoned Cart Reminder",
        schedule: "0 */6 * * *", // Every 6 hours
        task: async () => {
            await abandonedCartService.processAbandonedCarts({
                batchSize: 50,
                dryRun: false
            });
        },
        enabled: true,
        envKey: "ENABLE_ABANDONED_CART_CRON" // Set to "false" to disable
    },
    {
        name: "Cleanup Expired Carts",
        schedule: "0 2 * * *", // Daily at 2:00 AM UTC
        task: async () => {
            await abandonedCartService.cleanupExpiredCarts();
        },
        enabled: true,
        envKey: "ENABLE_CLEANUP_EXPIRED_CARTS_CRON" // Set to "false" to disable
    },
    // Add more jobs here as needed:
    // {
    //     name: "Daily Report",
    //     schedule: "0 9 * * *", // Every day at 9:00 AM UTC
    //     task: async () => {
    //         await dailyReportJob.generateReport();
    //     },
    //     enabled: true,
    //     envKey: "ENABLE_DAILY_REPORT_CRON"
    // },
    {
        name: "Orange Money Payment Verification",
        schedule: "*/15 * * * *", // Every 15 minutes
        task: async () => {
            const omChecker = require("../jobs/checkPendingOrangeMoneyPayments");
            await omChecker.execute();
        },
        enabled: true,
        envKey: "ENABLE_ORANGE_MONEY_CHECK_CRON"
    },
];

module.exports = jobs;

