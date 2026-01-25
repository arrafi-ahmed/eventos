const PaymentDispatcher = require('../payment');
const paymentService = require('../service/payment');
const tempRegistrationService = require('../service/tempRegistration');

/**
 * Background Job: Check Pending Orange Money Payments
 * 
 * This job checks for Orange Money payments that are stuck in "pending" status
 * for more than 10 minutes and verifies their actual status with Orange Money API.
 * 
 * Schedule: Run every 15 minutes
 */
class OrangeMoneyPaymentChecker {
    constructor() {
        this.PENDING_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
    }

    /**
     * Main job execution
     */
    async execute() {
        try {
            console.log('[Orange Money Checker] Starting payment verification...');

            // Get all temporary registrations
            const sessions = await tempRegistrationService.getAllTempRegistrations();

            // Filter for Orange Money pending payments older than 10 minutes
            const pendingOmPayments = sessions.filter(session => {
                const orders = session.orders;
                if (!orders) return false;

                const isOrangeMoney = orders.omTransactionId && orders.omPayToken;
                const isPending = orders.paymentStatus === 'pending';
                const createdAt = new Date(session.createdAt || session.created_at);
                const isOld = (Date.now() - createdAt.getTime()) > this.PENDING_THRESHOLD_MS;

                return isOrangeMoney && isPending && isOld;
            });

            console.log(`[Orange Money Checker] Found ${pendingOmPayments.length} stuck payments`);

            // Check each payment
            for (const session of pendingOmPayments) {
                await this.checkPaymentStatus(session);
            }

            console.log('[Orange Money Checker] Verification complete');
        } catch (error) {
            console.error('[Orange Money Checker] Error:', error);
        }
    }

    /**
     * Check individual payment status
     */
    async checkPaymentStatus(session) {
        try {
            const transactionId = session.orders.omTransactionId;
            console.log(`[Orange Money Checker] Checking transaction: ${transactionId}`);

            // Call Orange Money API to verify status
            const result = await PaymentDispatcher.verifyPayment('orange_money', transactionId);

            if (result.status === 'paid') {
                console.log(`[Orange Money Checker] Payment confirmed for ${transactionId}`);

                // Check if order already exists to prevent duplicate attendees
                const existingOrder = await paymentService.getOrderByGatewayTransactionId(transactionId);
                if (existingOrder) {
                    console.log(`[Orange Money Checker] Order for transaction ${transactionId} already finalized. Cleaning up temp registration.`);
                    await tempRegistrationService.deleteTempRegistration(session.sessionId);
                    return;
                }

                // Finalize the payment
                await paymentService.finalizePayment({
                    ...result,
                    gateway: 'orange_money',
                    metadata: {
                        sessionId: session.sessionId
                    }
                });

                // Clean up temp registration
                await tempRegistrationService.deleteTempRegistration(session.sessionId);
            } else if (result.status === 'failed' || result.status === 'expired') {
                console.log(`[Orange Money Checker] Payment ${result.status} for ${transactionId}`);
                // Delete failed/expired registrations to stop checking them
                await tempRegistrationService.deleteTempRegistration(session.sessionId);
            } else {
                console.log(`[Orange Money Checker] Payment still pending for ${transactionId}`);
            }
        } catch (error) {
            console.error(`[Orange Money Checker] Error checking ${session.orders?.omTransactionId}:`, error.message);
        }
    }

    /**
     * Schedule this job to run periodically
     * Call this method from your scheduler/cron setup
     */
    static schedule(scheduler) {
        const checker = new OrangeMoneyPaymentChecker();

        // Run every 15 minutes
        scheduler.scheduleJob('*/15 * * * *', async () => {
            await checker.execute();
        });

        console.log('[Orange Money Checker] Scheduled to run every 15 minutes');
    }
}

module.exports = new OrangeMoneyPaymentChecker();
