const { STRIPE_SECRET } = process.env;
const stripe = require("stripe")(STRIPE_SECRET);
const CustomError = require("../../model/CustomError");

/**
 * Stripe Payment Adapter
 */
class StripeAdapter {
    /**
     * Initiate Stripe Payment (Elements flow)
     * @param {Object} params 
     * @returns {Object} Action object
     */
    async initiatePayment({ amount, currency, metadata, receiptEmail }) {
        try {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount),
                currency: currency.toLowerCase(),
                receipt_email: receiptEmail,
                automatic_payment_methods: { enabled: true },
                metadata: metadata,
            });

            return {
                action: 'elements',
                clientSecret: paymentIntent.client_secret,
                transactionId: paymentIntent.id
            };
        } catch (error) {
            throw new CustomError(`Stripe Payment Initiation Failed: ${error.message}`, 400);
        }
    }

    /**
     * Verify Payment Status
     * @param {string} transactionId 
     * @returns {Object} Standardized status
     */
    async verifyPayment(transactionId) {
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(transactionId);
            return {
                status: paymentIntent.status === 'succeeded' ? 'paid' : 'pending',
                transactionId: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                metadata: paymentIntent.metadata
            };
        } catch (error) {
            throw new CustomError(`Stripe Verification Failed: ${error.message}`, 400);
        }
    }

    /**
     * Handle Stripe Webhook
     * @param {Object} payload 
     * @param {Object} headers 
     * @returns {Object} Standardized order data
     */
    async updateAmount(transactionId, amount, metadata = {}) {
        await stripe.paymentIntents.update(transactionId, {
            amount: Math.round(amount),
            metadata
        });
        return { success: true };
    }

    async applyPromoCode(transactionId, promoData, amountUpdates) {
        const { newTotal, discountAmount, netSubtotal, newTaxAmount, promoCode } = amountUpdates;

        await stripe.paymentIntents.update(transactionId, {
            amount: Math.round(newTotal),
            metadata: {
                promoCode: promoCode.toUpperCase(),
                discountAmount: discountAmount.toString(),
                netSubtotal: netSubtotal.toString(),
                taxAmount: newTaxAmount.toString(),
                totalAmount: Math.round(newTotal).toString()
            }
        });

        return {
            success: true,
            discountAmount,
            newTaxAmount,
            newTotal,
            promoCode: promoData.code,
            discountType: promoData.discount_type,
            discountValue: promoData.discount_value
        };
    }

    async handleWebhook(payload, headers, storedNotifToken = null) {
        const sig = headers['stripe-signature'];
        let event;

        try {
            event = stripe.webhooks.constructEvent(
                payload,
                sig,
                process.env.STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            throw new CustomError(`Webhook Error: ${err.message}`, 400);
        }

        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;
            return {
                status: 'paid',
                transactionId: paymentIntent.id,
                metadata: paymentIntent.metadata,
                amount: paymentIntent.amount,
                shippingAddress: paymentIntent.shipping?.address || null,
                shippingCost: paymentIntent.metadata?.shippingCost ? parseInt(paymentIntent.metadata.shippingCost) : 0,
                shippingType: paymentIntent.metadata?.shippingOption || 'pickup',
                rawResponse: paymentIntent
            };
        }

        return { status: 'ignored' };
    }
}

module.exports = new StripeAdapter();
