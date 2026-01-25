/**
 * TicketCounter model class
 */
export class TicketCounter {
  constructor (data = {}) {
    this.id = data.id || null
    this.name = data.name || ''
    this.organizationId = data.organizationId || null
    this.status = data.status === undefined ? true : data.status
    this.createdAt = data.createdAt || null
    this.updatedAt = data.updatedAt || null
  }

  /**
     * Validates the ticket counter data
     */
  validate () {
    const errors = []

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required')
    }

    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less')
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
      organizationId: this.organizationId,
      status: this.status,
    }
  }
}
