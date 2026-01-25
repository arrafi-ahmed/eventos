/**
 * Order model class
 */
export class Order {
  constructor (data = {}) {
    this.id = data.id || null
    this.orderNumber = data.orderNumber || ''
    this.totalAmount = data.totalAmount || 0
    this.currency = data.currency || 'USD'
    this.paymentStatus = data.paymentStatus || 'pending'
    this.stripePaymentIntentId = data.stripePaymentIntentId || null
    this.items = data.items || []
    this.registrationId = data.registrationId || null
    this.eventId = data.eventId || null
    this.createdAt = data.createdAt || null
    this.updatedAt = data.updatedAt || null
  }

  /**
   * Payment status constants
   */
  static get PAYMENT_STATUSES () {
    return {
      PENDING: 'pending',
      PAID: 'paid',
      FAILED: 'failed',
      REFUNDED: 'refunded',
    }
  }

  /**
   * Common currencies
   */
  static get CURRENCIES () {
    return {
      USD: 'USD',
      EUR: 'EUR',
      GBP: 'GBP',
      JPY: 'JPY',
      CAD: 'CAD',
      AUD: 'AUD',
    }
  }

  /**
   * Check if order is pending
   */
  isPending () {
    return this.paymentStatus === Order.PAYMENT_STATUSES.PENDING
  }

  /**
   * Check if order is paid
   */
  isPaid () {
    return this.paymentStatus === Order.PAYMENT_STATUSES.PAID
  }

  /**
   * Check if order failed
   */
  isFailed () {
    return this.paymentStatus === Order.PAYMENT_STATUSES.FAILED
  }

  /**
   * Check if order is refunded
   */
  isRefunded () {
    return this.paymentStatus === Order.PAYMENT_STATUSES.REFUNDED
  }

  /**
   * Check if order is completed (paid)
   */
  isCompleted () {
    return this.isPaid()
  }

  /**
   * Check if order has Stripe payment intent
   */
  hasStripePaymentIntent () {
    return this.stripePaymentIntentId !== null
  }

  /**
   * Check if order has items
   */
  hasItems () {
    return this.items && Array.isArray(this.items) && this.items.length > 0
  }

  /**
   * Get items array
   */
  getItems () {
    if (!this.hasItems()) {
      return []
    }
    return this.items
  }

  /**
   * Get item count
   */
  getItemCount () {
    return this.getItems().length
  }

  /**
   * Get total amount in cents
   */
  getTotalAmountInCents () {
    return this.totalAmount
  }

  /**
   * Get total amount in dollars
   */
  getTotalAmountInDollars () {
    return this.totalAmount / 100
  }

  /**
   * Format total amount for display
   */
  formatTotalAmount () {
    if (this.totalAmount === 0) {
      return 'Free'
    }

    switch (this.currency) {
      case 'USD': {
        return `$${this.getTotalAmountInDollars().toFixed(2)}`
      }
      case 'EUR': {
        return `€${this.getTotalAmountInDollars().toFixed(2)}`
      }
      case 'GBP': {
        return `£${this.getTotalAmountInDollars().toFixed(2)}`
      }
      default: {
        return `${this.getTotalAmountInDollars().toFixed(2)} ${this.currency}`
      }
    }
  }

  /**
   * Check if order is free
   */
  isFree () {
    return this.totalAmount === 0
  }

  /**
   * Validates the order data
   */
  validate () {
    const errors = []

    if (!this.orderNumber || this.orderNumber.trim().length === 0) {
      errors.push('Order number is required')
    }

    if (this.orderNumber && this.orderNumber.length > 50) {
      errors.push('Order number must be 50 characters or less')
    }

    if (this.totalAmount < 0) {
      errors.push('Total amount cannot be negative')
    }

    if (!this.currency || this.currency.length !== 3) {
      errors.push('Currency must be a 3-character code')
    }

    if (
      !this.paymentStatus
      || !Object.values(Order.PAYMENT_STATUSES).includes(this.paymentStatus)
    ) {
      errors.push('Invalid payment status')
    }

    if (this.items && !Array.isArray(this.items)) {
      errors.push('Items must be an array')
    }

    if (!this.registrationId) {
      errors.push('Registration ID is required')
    }

    if (!this.eventId) {
      errors.push('Event ID is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Returns a plain object (for API requests/responses)
   */
  toJSON () {
    return {
      id: this.id,
      orderNumber: this.orderNumber,
      totalAmount: this.totalAmount,
      currency: this.currency,
      paymentStatus: this.paymentStatus,
      stripePaymentIntentId: this.stripePaymentIntentId,
      items: this.items,
      registrationId: this.registrationId,
      eventId: this.eventId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
