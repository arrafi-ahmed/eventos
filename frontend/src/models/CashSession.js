/**
 * CashSession model class
 */
export class CashSession {
  constructor (data = {}) {
    this.id = data.id || null
    this.cashierId = data.cashierId || null
    this.ticketCounterId = data.ticketCounterId || null
    this.eventId = data.eventId || null
    this.organizationId = data.organizationId || null
    this.openingCash = data.openingCash || 0
    this.closingCash = data.closingCash || 0
    this.status = data.status || 'open'
    this.openingTime = data.openingTime || null
    this.closingTime = data.closingTime || null
    this.notes = data.notes || ''
    this.cashierName = data.cashierName || null
  }

  /**
     * Validates the cash session data for closing
     */
  validateClose () {
    const errors = []

    if (this.closingCash === null || this.closingCash === undefined) {
      errors.push('Closing cash balance is required')
    }

    if (this.closingCash < 0) {
      errors.push('Closing cash balance cannot be negative')
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
      cashierId: this.cashierId,
      ticketCounterId: this.ticketCounterId,
      eventId: this.eventId,
      organizationId: this.organizationId,
      openingCash: this.openingCash,
      closingCash: this.closingCash,
      status: this.status,
      notes: this.notes,
    }
  }
}
