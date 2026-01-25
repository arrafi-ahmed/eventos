/**
 * SponsorshipPackage model class
 */
export class SponsorshipPackage {
  constructor (data = {}) {
    this.id = data.id || null
    this.name = data.name || ''
    this.description = data.description || ''
    this.price = data.price || 0
    this.currency = data.currency || 'USD'
    this.availableCount = data.availableCount || -1
    this.features = data.features || []
    this.isActive = data.isActive || true
    this.eventId = data.eventId || null
    this.organizationId = data.organizationId || null
    this.createdAt = data.createdAt || null
    this.updatedAt = data.updatedAt || null
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
   * Check if package is active
   */
  isActive () {
    return this.isActive === true
  }

  /**
   * Check if package is inactive
   */
  isInactive () {
    return !this.isActive()
  }

  /**
   * Check if package is free
   */
  isFree () {
    return this.price === 0
  }

  /**
   * Check if package has unlimited availability
   */
  hasUnlimitedAvailability () {
    return this.availableCount === -1
  }

  /**
   * Check if package is available for purchase
   */
  isAvailable () {
    if (this.isInactive()) {
      return false
    }
    if (this.hasUnlimitedAvailability()) {
      return true
    }
    return this.availableCount > 0
  }

  /**
   * Get remaining availability
   */
  getRemainingAvailability () {
    if (this.hasUnlimitedAvailability()) {
      return null
    } // Unlimited
    return Math.max(0, this.availableCount)
  }

  /**
   * Decrease availability by specified count
   */
  decreaseAvailability (count = 1) {
    if (this.hasUnlimitedAvailability()) {
      return true
    } // Unlimited

    if (this.availableCount >= count) {
      this.availableCount -= count
      this.updatedAt = new Date()
      return true
    }

    return false // Not enough availability
  }

  /**
   * Increase availability by specified count
   */
  increaseAvailability (count = 1) {
    if (this.hasUnlimitedAvailability()) {
      return true
    } // Unlimited

    this.availableCount += count
    this.updatedAt = new Date()
    return true
  }

  /**
   * Check if package has features
   */
  hasFeatures () {
    return this.features && Array.isArray(this.features) && this.features.length > 0
  }

  /**
   * Get features array
   */
  getFeatures () {
    if (!this.hasFeatures()) {
      return []
    }
    return this.features
  }

  /**
   * Get feature by name
   */
  getFeature (name) {
    if (!this.hasFeatures()) {
      return null
    }

    return this.features.find(feature => feature.name === name) || null
  }

  /**
   * Check if package includes a specific feature
   */
  includesFeature (name) {
    const feature = this.getFeature(name)
    return feature ? feature.included === true : false
  }

  /**
   * Get price in cents
   */
  getPriceInCents () {
    return this.price
  }

  /**
   * Get price in dollars
   */
  getPriceInDollars () {
    return this.price / 100
  }

  /**
   * Format price for display
   */
  formatPrice () {
    if (this.isFree()) {
      return 'Free'
    }

    switch (this.currency) {
      case 'USD': {
        return `$${this.getPriceInDollars().toFixed(2)}`
      }
      case 'EUR': {
        return `€${this.getPriceInDollars().toFixed(2)}`
      }
      case 'GBP': {
        return `£${this.getPriceInDollars().toFixed(2)}`
      }
      default: {
        return `${this.getPriceInDollars().toFixed(2)} ${this.currency}`
      }
    }
  }

  /**
   * Get availability status text
   */
  getAvailabilityStatus () {
    if (this.isInactive()) {
      return 'Inactive'
    }
    if (this.hasUnlimitedAvailability()) {
      return 'Unlimited'
    }
    if (this.availableCount === 0) {
      return 'Sold Out'
    }
    if (this.availableCount <= 5) {
      return 'Limited'
    }
    return 'Available'
  }

  /**
   * Validates the sponsorship package data
   */
  validate () {
    const errors = []

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required')
    }

    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less')
    }

    if (this.price < 0) {
      errors.push('Price cannot be negative')
    }

    if (!this.currency || this.currency.length !== 3) {
      errors.push('Currency must be a 3-character code')
    }

    if (this.availableCount !== -1 && this.availableCount < 0) {
      errors.push('Available count cannot be negative (use -1 for unlimited)')
    }

    if (this.features && !Array.isArray(this.features)) {
      errors.push('Features must be an array')
    }

    if (this.features && Array.isArray(this.features)) {
      for (const [index, feature] of this.features.entries()) {
        if (!feature.name || typeof feature.name !== 'string') {
          errors.push(`Feature ${index + 1} must have a valid name`)
        }
        if (typeof feature.included !== 'boolean') {
          errors.push(`Feature ${index + 1} must have a valid included boolean`)
        }
      }
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
      name: this.name,
      description: this.description,
      price: this.price,
      currency: this.currency,
      availableCount: this.availableCount,
      features: this.features,
      isActive: this.isActive,
      eventId: this.eventId,
      organizationId: this.organizationId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
