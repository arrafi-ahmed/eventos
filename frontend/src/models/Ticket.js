/**
 * Ticket model class
 */
export class Ticket {
  constructor (data = {}) {
    this.id = data.id || null
    this.title = data.title || ''
    this.description = data.description || ''
    this.price = data.price || 0
    this.currentStock = data.currentStock || 0
    this.maxStock = data.maxStock || null
    this.eventId = data.eventId || null
    this.createdAt = data.createdAt || null
  }

  /**
   * Check if ticket is free
   */
  isFree () {
    return this.price === 0
  }

  /**
   * Check if ticket is available for purchase
   */
  isAvailable () {
    if (this.maxStock === null) {
      return true // Unlimited stock
    }
    return this.currentStock > 0
  }

  /**
   * Check if ticket has unlimited stock
   */
  hasUnlimitedStock () {
    return this.maxStock === null
  }

  /**
   * Get remaining stock count
   */
  getRemainingStock () {
    if (this.maxStock === null) {
      return null // Unlimited
    }
    return this.currentStock
  }

  /**
   * Decrease stock by specified quantity
   */
  decreaseStock (quantity = 1) {
    if (this.maxStock === null) {
      return true // Unlimited stock
    }

    if (this.currentStock >= quantity) {
      this.currentStock -= quantity
      return true
    }

    return false // Not enough stock
  }

  /**
   * Increase stock by specified quantity
   */
  increaseStock (quantity = 1) {
    if (this.maxStock === null) {
      return true // Unlimited stock
    }

    if (this.maxStock === null || this.currentStock + quantity <= this.maxStock) {
      this.currentStock += quantity
      return true
    }

    return false // Would exceed max stock
  }

  /**
   * Format price for display (requires currency parameter)
   */
  formatPrice (quantity = 1, currency = 'USD') {
    const total = this.price * quantity

    if (this.isFree()) {
      return 'Free'
    }

    // Basic formatting
    switch (currency) {
      case 'USD': {
        return `$${(total / 100).toFixed(2)}`
      }
      case 'EUR': {
        return `€${(total / 100).toFixed(2)}`
      }
      case 'GBP': {
        return `£${(total / 100).toFixed(2)}`
      }
      default: {
        return `${(total / 100).toFixed(2)} ${currency}`
      }
    }
  }

  /**
   * Get price in cents
   */
  getPriceInCents (quantity = 1) {
    return this.price * quantity
  }

  /**
   * Validates the ticket data
   */
  validate () {
    const errors = []

    if (!this.title || this.title.trim().length === 0) {
      errors.push('Title is required')
    }

    if (this.title && this.title.length > 100) {
      errors.push('Title must be 100 characters or less')
    }

    if (this.price < 0) {
      errors.push('Price cannot be negative')
    }

    if (this.currentStock < 0) {
      errors.push('Current stock cannot be negative')
    }

    if (this.maxStock !== null && this.maxStock < 0) {
      errors.push('Max stock cannot be negative')
    }

    if (this.maxStock !== null && this.currentStock > this.maxStock) {
      errors.push('Current stock cannot exceed max stock')
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
      title: this.title,
      description: this.description,
      price: this.price,
      currency: this.currency,
      currentStock: this.currentStock,
      maxStock: this.maxStock,
      eventId: this.eventId,
      createdAt: this.createdAt,
    }
  }
}
