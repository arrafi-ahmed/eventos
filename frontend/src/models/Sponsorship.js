/**
 * Sponsorship model class
 */
export class Sponsorship {
  constructor (data = {}) {
    this.id = data.id || null
    this.sponsorData = data.sponsorData || null
    this.packageType = data.packageType || ''
    this.amount = data.amount || 0
    this.currency = data.currency || 'USD'
    this.paymentStatus = data.paymentStatus || 'pending'
    this.stripePaymentIntentId = data.stripePaymentIntentId || null
    this.eventId = data.eventId || null
    this.organizationId = data.organizationId || null
    this.registrationId = data.registrationId || null
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
   * Check if sponsorship is pending
   */
  isPending () {
    return this.paymentStatus === Sponsorship.PAYMENT_STATUSES.PENDING
  }

  /**
   * Check if sponsorship is paid
   */
  isPaid () {
    return this.paymentStatus === Sponsorship.PAYMENT_STATUSES.PAID
  }

  /**
   * Check if sponsorship failed
   */
  isFailed () {
    return this.paymentStatus === Sponsorship.PAYMENT_STATUSES.FAILED
  }

  /**
   * Check if sponsorship is refunded
   */
  isRefunded () {
    return this.paymentStatus === Sponsorship.PAYMENT_STATUSES.REFUNDED
  }

  /**
   * Check if sponsorship is completed (paid)
   */
  isCompleted () {
    return this.isPaid()
  }

  /**
   * Check if sponsorship has Stripe payment intent
   */
  hasStripePaymentIntent () {
    return this.stripePaymentIntentId !== null
  }

  /**
   * Check if sponsorship has sponsor data
   */
  hasSponsorData () {
    return this.sponsorData && Object.keys(this.sponsorData).length > 0
  }

  /**
   * Get sponsor data field
   */
  getSponsorField (key) {
    if (!this.hasSponsorData()) {
      return null
    }
    return this.sponsorData[key]
  }

  /**
   * Get sponsor name
   */
  getSponsorName () {
    return this.getSponsorField('name') || 'Unknown Sponsor'
  }

  /**
   * Get sponsor email
   */
  getSponsorEmail () {
    return this.getSponsorField('email') || null
  }

  /**
   * Get sponsor organization
   */
  getSponsorOrganization () {
    return this.getSponsorField('organization') || null
  }

  /**
   * Get amount in cents
   */
  getAmountInCents () {
    return this.amount
  }

  /**
   * Get amount in dollars
   */
  getAmountInDollars () {
    return this.amount / 100
  }

  /**
   * Format amount for display
   */
  formatAmount () {
    if (this.amount === 0) {
      return 'Free'
    }

    switch (this.currency) {
      case 'USD': {
        return `$${this.getAmountInDollars().toFixed(2)}`
      }
      case 'EUR': {
        return `€${this.getAmountInDollars().toFixed(2)}`
      }
      case 'GBP': {
        return `£${this.getAmountInDollars().toFixed(2)}`
      }
      default: {
        return `${this.getAmountInDollars().toFixed(2)} ${this.currency}`
      }
    }
  }

  /**
   * Check if sponsorship is free
   */
  isFree () {
    return this.amount === 0
  }

  /**
   * Check if sponsorship is linked to a registration
   */
  hasRegistration () {
    return this.registrationId !== null
  }

  /**
   * Validates the sponsorship data
   */
  validate () {
    const errors = []

    if (!this.sponsorData || typeof this.sponsorData !== 'object') {
      errors.push('Sponsor data is required and must be an object')
    }

    if (!this.packageType || this.packageType.trim().length === 0) {
      errors.push('Package type is required')
    }

    if (this.packageType && this.packageType.length > 50) {
      errors.push('Package type must be 50 characters or less')
    }

    if (this.amount < 0) {
      errors.push('Amount cannot be negative')
    }

    if (!this.currency || this.currency.length !== 3) {
      errors.push('Currency must be a 3-character code')
    }

    if (
      !this.paymentStatus
      || !Object.values(Sponsorship.PAYMENT_STATUSES).includes(this.paymentStatus)
    ) {
      errors.push('Invalid payment status')
    }

    if (!this.eventId) {
      errors.push('Event ID is required')
    }

    if (!this.organizationId) {
      errors.push('Organization ID is required')
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
      sponsorData: this.sponsorData,
      packageType: this.packageType,
      amount: this.amount,
      currency: this.currency,
      paymentStatus: this.paymentStatus,
      stripePaymentIntentId: this.stripePaymentIntentId,
      eventId: this.eventId,
      organizationId: this.organizationId,
      registrationId: this.registrationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
