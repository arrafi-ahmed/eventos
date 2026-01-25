const CustomError = require("../model/CustomError");

const adapters = {
    stripe: require("./adapters/stripe"),
    orange_money: require("./adapters/orangeMoney"),
};

/**
 * Payment Service Dispatcher
 * Routes payment requests to the appropriate gateway adapter.
 */
class PaymentDispatcher {
    /**
     * Get adapter instance for a specific gateway
     * @param {string} gatewayName 
     * @returns {Object} Adapter instance
     */
    static getAdapter(gatewayName) {
        const adapter = adapters[gatewayName.toLowerCase()];
        if (!adapter) {
            throw new CustomError(`Payment gateway '${gatewayName}' not supported`, 400);
        }
        return adapter;
    }

    /**
     * Initiate a payment
     * @param {string} gatewayName 
     * @param {Object} params 
     * @returns {Promise<Object>} Action object for frontend
     */
    static async initiatePayment(gatewayName, params) {
        const adapter = this.getAdapter(gatewayName);
        return await adapter.initiatePayment(params);
    }

    /**
     * Verify a payment status (Manual check)
     * @param {string} gatewayName 
     * @param {string} transactionId 
     * @returns {Promise<Object>} Standardized status object
     */
    static async verifyPayment(gatewayName, transactionId) {
        const adapter = this.getAdapter(gatewayName);
        return await adapter.verifyPayment(transactionId);
    }

    /**
     * Handle incoming webhook
     * @param {string} gatewayName 
     * @param {Object} payload 
     * @param {Object} headers 
     * @param {string} storedNotifToken Optional - for Orange Money verification
     * @returns {Promise<Object>} Standardized status object
     */
    static async handleWebhook(gatewayName, payload, headers, storedNotifToken = null) {
        const adapter = this.getAdapter(gatewayName);
        return await adapter.handleWebhook(payload, headers, storedNotifToken);
    }

    static async updateAmount(gatewayName, transactionId, amount, metadata) {
        const adapter = this.getAdapter(gatewayName);
        return await adapter.updateAmount(transactionId, amount, metadata);
    }

    static async applyPromoCode(gatewayName, transactionId, promoData, amountUpdates) {
        const adapter = this.getAdapter(gatewayName);
        return await adapter.applyPromoCode(transactionId, promoData, amountUpdates);
    }
}

module.exports = PaymentDispatcher;
