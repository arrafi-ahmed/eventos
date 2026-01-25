const axios = require('axios');
const CustomError = require('../../model/CustomError');

const {
    ORANGE_MONEY_CLIENT_ID,
    ORANGE_MONEY_CLIENT_SECRET,
    ORANGE_MONEY_MERCHANT_KEY,
    ORANGE_MONEY_API_BASE_URL,
    ORANGE_MONEY_ENVIRONMENT,
    ORANGE_MONEY_OAUTH_PATH,
    ORANGE_MONEY_COUNTRY,
    API_BASE_URL,
    VUE_BASE_URL
} = process.env;


/**
 * Orange Money Payment Adapter
 * Implements redirect-based payment flow with OAuth authentication
 */
class OrangeMoneyAdapter {
    constructor() {
        this.baseURL = ORANGE_MONEY_API_BASE_URL || 'https://api.orange.com';
        this.environment = ORANGE_MONEY_ENVIRONMENT || 'sandbox';
        this.merchantKey = ORANGE_MONEY_MERCHANT_KEY;
        // Default to 'dev' (sandbox) if not specified, use 'ml' etc for prod
        this.countryCode = ORANGE_MONEY_COUNTRY || 'dev';

        // Token cache (in-memory, consider Redis for production)
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    /**
     * Get OAuth Access Token (cached for 90 days)
     * @returns {Promise<string>} Bearer token
     */
    async getAccessToken() {
        // Return cached token if still valid (using 5-minute buffer)
        if (this.accessToken && this.tokenExpiry && Date.now() < (this.tokenExpiry - 300000)) {
            return this.accessToken;
        }

        // Prioritize v3 as per modern Orange documentation, but support override via env
        const oauthPath = ORANGE_MONEY_OAUTH_PATH || 'oauth/v3/token';
        const endpoints = [
            `${this.baseURL}/${oauthPath.startsWith('/') ? oauthPath.substring(1) : oauthPath}`,
            `${this.baseURL}/oauth/v2/token`
        ];
        let lastError = null;

        for (const endpoint of endpoints) {
            try {
                const credentials = Buffer.from(
                    `${ORANGE_MONEY_CLIENT_ID}:${ORANGE_MONEY_CLIENT_SECRET}`
                ).toString('base64');

                const response = await axios.post(
                    endpoint,
                    'grant_type=client_credentials',
                    {
                        headers: {
                            'Authorization': `Basic ${credentials}`,
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        timeout: 10000
                    }
                );

                this.accessToken = response.data.access_token;

                // Use expires_in from response (secs), default to 90 days if missing
                const expiresInSecs = parseInt(response.data.expires_in) || (90 * 24 * 60 * 60);
                this.tokenExpiry = Date.now() + (expiresInSecs * 1000);

                console.log(`[Orange Money] Authenticated successfully via ${endpoint}. Validity: ${Math.round(expiresInSecs / 3600)}h`);
                return this.accessToken;
            } catch (error) {
                lastError = error;
                console.warn(`[Orange Money] Auth failed at ${endpoint}:`, error.response?.data || error.message);
                if (error.response?.status === 401 || error.response?.status === 403) {
                    break;
                }
            }
        }

        console.error('Orange Money Final OAuth Error:', lastError.response?.data || lastError.message);
        throw new CustomError('Failed to authenticate with Orange Money. Check credentials and API subscriptions.', 500);
    }

    /**
     * Initiate Orange Money Payment
     * @param {Object} params 
     * @returns {Object} Action object with payment URL
     */
    async initiatePayment({ amount, currency, metadata, receiptEmail }, isRetry = false) {
        try {
            const token = await this.getAccessToken();

            // Use sessionId as the primary transaction identifier (exactly 30 hex chars)
            const orderId = metadata.sessionId || `OM_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`.substring(0, 30);

            // Use OUV for sandbox, actual currency for production
            const paymentCurrency = this.environment === 'sandbox' ? 'OUV' : currency.toUpperCase();

            // Localhost/127.0.0.1 is not allowed in callback URLs by Orange Money API
            const sanitizeUrl = (url) => url ? url.replace(/localhost|127\.0\.0\.1/g, 'lvh.me') : url;

            // Orange Money always expects amounts in major units (e.g., 1 GNF or 1 USD)
            // Ticketi stores everything in virtual cents (1/100th of major unit)
            const scaledAmount = Math.round(amount / 100);

            const payload = {
                merchant_key: this.merchantKey,
                currency: paymentCurrency,
                order_id: orderId,
                amount: scaledAmount,
                return_url: sanitizeUrl(`${VUE_BASE_URL}/${metadata.eventSlug || 'event'}/success?session_id=${orderId}`).substring(0, 120),
                cancel_url: sanitizeUrl(`${VUE_BASE_URL}/payment/cancel`).substring(0, 120),
                notif_url: sanitizeUrl(`${API_BASE_URL}/payment/webhook/orange_money`).substring(0, 120),
                lang: this.environment === 'sandbox' ? 'fr' : 'en',
                reference: (metadata.sessionId || orderId).substring(0, 30)
            };

            console.log(`[Orange Money] Initiating payment (retry: ${isRetry}) with payload:`, JSON.stringify(payload, null, 2));

            const response = await axios.post(
                `${this.baseURL}/orange-money-webpay/${this.countryCode}/v1/webpayment`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const { payment_url, pay_token, notif_token } = response.data;

            return {
                action: 'redirect',
                paymentUrl: payment_url,
                transactionId: orderId,
                payToken: pay_token,
                notifToken: notif_token,
                metadata: {
                    ...metadata,
                    sessionId: metadata.sessionId || orderId,
                    orderId,
                    currency: paymentCurrency
                }
            };
        } catch (error) {
            const errorData = error.response?.data || {};

            // Check for code 42 (Expired credentials) and retry once
            if (!isRetry && errorData.code === 42) {
                console.warn('[Orange Money] Token expired unexpectedly. Refreshing and retrying...');
                this.accessToken = null;
                this.tokenExpiry = null;
                return this.initiatePayment({ amount, currency, metadata, receiptEmail }, true);
            }

            console.error('Orange Money Payment Initiation Error:', errorData || error.message);
            throw new CustomError(
                `Orange Money Payment Initiation Failed: ${errorData.message || error.message}`,
                400
            );
        }
    }

    /**
     * Verify Payment Status
     * @param {string} transactionId Orange Money order_id
     * @param {Object} extraParams Optional extra parameters (amount, payToken)
     * @returns {Object} Standardized status
     */
    async verifyPayment(transactionId, extraParams = {}) {
        try {
            const token = await this.getAccessToken();

            let { amount, payToken } = extraParams;

            // If params missing, try a more robust lookup (check Orders first, then Drafs)
            if (!amount || !payToken) {
                try {
                    const tempRegistrationService = require('../../service/tempRegistration');
                    const paymentService = require('../../service/payment'); // Import to use getOrderByGatewayTransactionId
                    let sessionData = null;

                    // 1. Check if order ALREADY exists (priority fallback)
                    // The webhook deletes the temp registration immediately after finalization
                    const existingOrder = await paymentService.getOrderByGatewayTransactionId(transactionId);
                    if (existingOrder) {
                        console.log(`[Orange Money] Verification fallback: Found finalized order ${existingOrder.orderNumber || existingOrder.order_number}`);
                        amount = amount || (existingOrder.totalAmount || existingOrder.total_amount);

                        // Handle both possible casing depends on the db query wrapper
                        const meta = existingOrder.gatewayMetadata || existingOrder.gateway_metadata || {};
                        payToken = payToken || (meta.omPayToken || meta.pay_token);
                    }

                    // 2. Fallback to temp_registration if not found in orders
                    if (!payToken) {
                        try {
                            // Try Primary Key lookup (our 30-char hex)
                            sessionData = await tempRegistrationService.getTempRegistration(transactionId);
                        } catch (e) {
                            // Try searching by Orange Money internal ID
                            sessionData = await tempRegistrationService.getTempRegistrationByOmTransactionId(transactionId);
                        }

                        if (sessionData) {
                            console.log(`[Orange Money] Verification recovered session data for: ${sessionData.sessionId}`);
                            amount = amount || sessionData.orders?.totalAmount;
                            payToken = payToken || (sessionData.orders?.omPayToken || sessionData.orders?.om_pay_token);
                        }
                    }
                } catch (e) {
                    console.warn('[Orange Money] Fallback lookup failed during verification:', e.message);
                }
            }

            // CRITICAL: Ensure we have data to prevent "Missing body field" from Orange API
            if (!payToken) {
                console.error(`[Orange Money] Cannot verify ${transactionId}: Missing payToken`);
                return { status: 'error', message: 'Missing payment token' };
            }

            // Orange Money always expects amounts in major units (1000 cents -> 10)
            const scaledAmount = amount ? Math.round(amount / 100) : 0;

            const payload = {
                order_id: transactionId,
                amount: scaledAmount,
                pay_token: payToken
            };

            console.log(`[Orange Money] Verification Payload to Gateway:`, JSON.stringify(payload, null, 2));

            const apiResponse = await axios.post(
                `${this.baseURL}/orange-money-webpay/${this.countryCode}/v1/transactionstatus`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            const { status, currency: resCurrency, amount: resAmount } = apiResponse.data;
            console.log(`[Orange Money] Verification result for ${transactionId}: Status=${status}, Amount=${resAmount} ${resCurrency}`);

            let mappedStatus = 'pending';
            if (status === 'SUCCESS') mappedStatus = 'paid';
            else if (status === 'FAILED') mappedStatus = 'failed';
            else if (status === 'EXPIRED') mappedStatus = 'expired';

            return {
                status: mappedStatus,
                transactionId,
                // Scale back up to Ticketi's virtual cents
                amount: Math.round(parseFloat(resAmount || scaledAmount) * 100),
                currency: resCurrency || 'OUV',
                metadata: apiResponse.data
            };
        } catch (error) {
            console.error('[Orange Money] Verification API Error:', error.response?.data || error.message);
            throw new CustomError(
                `Orange Money Verification Failed: ${error.response?.data?.message || error.message}`,
                400
            );
        }
    }

    /**
     * Handle Orange Money Webhook
     * @param {Object} payload Webhook payload
     * @param {Object} headers Request headers
     * @param {string} storedNotifToken The notif_token stored during initialization
     * @returns {Object} Standardized order data
     */
    async handleWebhook(payload, headers, storedNotifToken) {
        try {
            const rawBody = payload || {};
            // Extract identifiers with fallback for various possible names
            const order_id = rawBody.order_id || rawBody.orderId || rawBody.txnid;
            const notif_token = rawBody.notif_token || rawBody.notifToken;
            const amount = rawBody.amount;
            const status = rawBody.status;

            console.log(`[Orange Money Webhook] Processing payload for order: ${order_id}`);

            // Security: Verify notif_token matches
            if (notif_token !== storedNotifToken) {
                console.error(`[Orange Money Webhook] Security mismatch! Received token: ${notif_token}, Expected: ${storedNotifToken}`);
                throw new CustomError('Invalid notification token', 403);
            }

            // Only process successful payments
            if (status === 'SUCCESS') {
                console.log(`[Orange Money Webhook] Order ${order_id} confirmed SUCCESS via webhook`);
                return {
                    status: 'paid',
                    transactionId: order_id,
                    amount: parseInt(amount),
                    metadata: {
                        ...payload,
                        sessionId: order_id // Restore original link
                    }
                };
            }

            console.log(`[Orange Money Webhook] Order ${order_id} has non-success status: ${status}`);
            let mappedStatus = 'pending';
            if (status === 'FAILED') mappedStatus = 'failed';
            else if (status === 'EXPIRED') mappedStatus = 'expired';

            return {
                status: mappedStatus,
                transactionId: order_id,
                metadata: payload
            };
        } catch (error) {
            console.error('[Orange Money Webhook] Logic Error:', error.message);
            throw new CustomError(`Webhook Error: ${error.message}`, 400);
        }
    }

    /**
     * Update amount (not supported by Orange Money after initialization)
     * @throws {CustomError} Not supported
     */
    async updateAmount(transactionId, amount, metadata = {}) {
        throw new CustomError(
            'Orange Money does not support amount updates after initialization',
            400
        );
    }

    /**
     * Apply promo code (not supported by Orange Money after initialization)
     * @throws {CustomError} Not supported
     */
    async applyPromoCode(transactionId, promoData, amountUpdates) {
        throw new CustomError(
            'Orange Money does not support promo codes after initialization. Apply discount before payment.',
            400
        );
    }
}

module.exports = new OrangeMoneyAdapter();
