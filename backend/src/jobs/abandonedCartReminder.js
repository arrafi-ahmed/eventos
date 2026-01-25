const abandonedCartService = require("../service/abandonedCart");

/**
 * Process abandoned carts and send reminder emails
 * This function should be called by a cron job every 6-12 hours
 *
 * See ABANDONED_CART_SETUP.md for setup instructions
 */
exports.processAbandonedCarts = async () => {
    try {
        const result = await abandonedCartService.processAbandonedCarts({
            batchSize: 50, // Process 50 carts at a time
            dryRun: false, // Set to true for testing (won't send emails or delete)
        });

        if (result.errors.length > 0) {
            console.error("Errors encountered:", result.errors);
        }

        return result;
    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error in abandoned cart reminder job:`, error);
        throw error;
    }
};

/**
 * Get statistics about abandoned carts (for monitoring)
 */
exports.getStats = async () => {
    try {
        const stats = await abandonedCartService.getAbandonedCartStats();
        return stats;
    } catch (error) {
        console.error("Error getting abandoned cart stats:", error);
        throw error;
    }
};

// If running directly (for testing or manual execution)
if (require.main === module) {
    exports.processAbandonedCarts()
        .then((result) => {
            process.exit(0);
        })
        .catch((error) => {
            console.error("Job failed:", error);
            process.exit(1);
        });
}

