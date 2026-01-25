/**
 * Attendee model class
 */
export class Attendee {
  constructor (data = {}) {
    this.id = data.id || null
    this.registrationId = data.registrationId || null
    this.isPrimary = data.isPrimary || false
    this.firstName = data.firstName || ''
    this.lastName = data.lastName || ''
    this.email = data.email || ''
    this.phone = data.phone || null
    this.ticketId = data.ticketId || null
    this.ticketTitle = data.ticketTitle || null
    this.qrUuid = data.qrUuid || null
    this.createdAt = data.createdAt || null
    this.updatedAt = data.updatedAt || null
  }

  /**
   * Get full name
   */
  getFullName () {
    return `${this.firstName} ${this.lastName}`.trim()
  }

  /**
   * Get display name (first name + last initial)
   */
  getDisplayName () {
    if (!this.lastName) {
      return this.firstName
    }
    return `${this.firstName} ${this.lastName.charAt(0)}.`
  }

  /**
   * Check if attendee is primary
   */
  isPrimary () {
    return this.isPrimary === true
  }

  /**
   * Check if attendee has a ticket
   */
  hasTicket () {
    return this.ticketId !== null
  }

  /**
   * Check if attendee has phone number
   */
  hasPhone () {
    return this.phone && this.phone.trim().length > 0
  }

  /**
   * Check if attendee has QR code
   */
  hasQrCode () {
    return this.qrUuid && this.qrUuid.trim().length > 0
  }

  /**
   * Generate a simple QR code identifier
   */
  generateQrIdentifier () {
    if (this.qrUuid) {
      return this.qrUuid
    }

    // Simple fallback - in real app, use proper UUID generation
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    return `QR_${timestamp}_${random}`
  }

  /**
   * Validates the attendee data
   */
  validate () {
    const errors = []

    if (!this.registrationId) {
      errors.push('Registration ID is required')
    }

    if (!this.firstName || this.firstName.trim().length === 0) {
      errors.push('First name is required')
    }

    if (this.firstName && this.firstName.length > 255) {
      errors.push('First name must be 255 characters or less')
    }

    if (!this.lastName || this.lastName.trim().length === 0) {
      errors.push('Last name is required')
    }

    if (this.lastName && this.lastName.length > 255) {
      errors.push('Last name must be 255 characters or less')
    }

    if (!this.email || this.email.trim().length === 0) {
      errors.push('Email is required')
    }

    if (this.email && !this.isValidEmail(this.email)) {
      errors.push('Invalid email format')
    }

    if (this.email && this.email.length > 255) {
      errors.push('Email must be 255 characters or less')
    }

    if (this.phone && this.phone.length > 50) {
      errors.push('Phone must be 50 characters or less')
    }

    if (!this.qrUuid) {
      errors.push('QR UUID is required')
    }

    return {
      isValid: errors.length === 0,
      errors,
    }
  }

  /**
   * Simple email validation
   */
  isValidEmail (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  /**
   * Returns a plain object (for API requests/responses)
   */
  toJSON () {
    return {
      id: this.id,
      registrationId: this.registrationId,
      isPrimary: this.isPrimary,
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phone: this.phone,
      ticketId: this.ticketId,
      qrUuid: this.qrUuid,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    }
  }
}
