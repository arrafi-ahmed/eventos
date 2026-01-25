/**
 * TempRegistrationData model class
 */
export class TempRegistrationData {
  constructor (data = {}) {
    this.sessionId = data.sessionId || null
    this.registrationData = data.registrationData || null
    this.ticketItems = data.ticketItems || null
    this.eventId = data.eventId || null
    this.organizationId = data.organizationId || null
    this.createdAt = data.createdAt || null
    this.expiresAt = data.expiresAt || null
  }

  /**
   * Check if the temporary data has expired
   */
  isExpired () {
    if (!this.expiresAt) {
      return true
    }

    const now = new Date()
    const expiry = new Date(this.expiresAt)

    return now > expiry
  }

  /**
   * Check if the temporary data is still valid
   */
  isValid () {
    return !this.isExpired()
  }

  /**
   * Get time until expiry in minutes
   */
  getTimeUntilExpiry () {
    if (!this.expiresAt) {
      return 0
    }

    const now = new Date()
    const expiry = new Date(this.expiresAt)
    const diffInMs = expiry - now

    if (diffInMs <= 0) {
      return 0
    }

    return Math.ceil(diffInMs / (1000 * 60))
  }

  /**
   * Check if data expires soon (within 5 minutes)
   */
  expiresSoon () {
    const timeUntilExpiry = this.getTimeUntilExpiry()
    return timeUntilExpiry > 0 && timeUntilExpiry <= 5
  }

  /**
   * Get registration data field
   */
  getRegistrationField (key) {
    if (!this.registrationData) {
      return null
    }
    return this.registrationData[key]
  }

  /**
   * Get ticket item by index
   */
  getTicketItem (index) {
    if (!this.ticketItems || !Array.isArray(this.ticketItems)) {
      return null
    }
    return this.ticketItems[index] || null
  }

  /**
   * Get total number of ticket items
   */
  getTicketItemCount () {
    if (!this.ticketItems || !Array.isArray(this.ticketItems)) {
      return 0
    }
    return this.ticketItems.length
  }

  /**
   * Check if has ticket items
   */
  hasTicketItems () {
    return this.getTicketItemCount() > 0
  }

  /**
   * Check if has registration data
   */
  hasRegistrationData () {
    return this.registrationData && Object.keys(this.registrationData).length > 0
  }

  /**
   * Validates the temporary registration data
   */
  validate () {
    const errors = []

    if (!this.sessionId) {
      errors.push('Session ID is required')
    }

    if (!this.registrationData || typeof this.registrationData !== 'object') {
      errors.push('Registration data must be an object')
    }

    if (!this.ticketItems || !Array.isArray(this.ticketItems)) {
      errors.push('Ticket items must be an array')
    }

    if (!this.eventId) {
      errors.push('Event ID is required')
    }

    if (!this.organizationId) {
      errors.push('Organization ID is required')
    }

    if (!this.expiresAt) {
      errors.push('Expiry time is required')
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
      sessionId: this.sessionId,
      registrationData: this.registrationData,
      ticketItems: this.ticketItems,
      eventId: this.eventId,
      organizationId: this.organizationId,
      createdAt: this.createdAt,
      expiresAt: this.expiresAt,
    }
  }
}
