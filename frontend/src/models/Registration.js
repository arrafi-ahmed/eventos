/**
 * Registration model class
 */
export class Registration {
  constructor (data = {}) {
    this.id = data.id || null
    this.eventId = data.eventId || null
    this.additionalFields = data.additionalFields || null
    this.status = data.status || false
    this.createdAt = data.createdAt || null
    this.updatedAt = data.updatedAt || null
  }

  /**
   * Check if registration is confirmed
   */
  isConfirmed () {
    return this.status === true
  }

  /**
   * Check if registration is pending
   */
  isPending () {
    return this.status === false
  }

  /**
   * Confirm the registration
   */
  confirm () {
    this.status = true
    this.updatedAt = new Date()
  }

  /**
   * Set registration as pending
   */
  setPending () {
    this.status = false
    this.updatedAt = new Date()
  }

  /**
   * Get additional field value
   */
  getAdditionalField (key) {
    if (!this.additionalFields) {
      return null
    }
    return this.additionalFields[key]
  }

  /**
   * Set additional field value
   */
  setAdditionalField (key, value) {
    if (!this.additionalFields) {
      this.additionalFields = {}
    }
    this.additionalFields[key] = value
    this.updatedAt = new Date()
  }

  /**
   * Check if registration has additional fields
   */
  hasAdditionalFields () {
    return this.additionalFields && Object.keys(this.additionalFields).length > 0
  }

  /**
   * Validates the registration data
   */
  validate () {
    const errors = []

    if (!this.eventId) {
      errors.push('Event ID is required')
    }

    if (this.additionalFields && typeof this.additionalFields !== 'object') {
      errors.push('Additional fields must be an object')
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
      eventId: this.eventId,
      additionalFields: this.additionalFields,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
