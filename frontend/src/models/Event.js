/**
 * Event model class
 */
import { EventConfig } from './EventConfig'

export class Event {
  constructor (data = {}) {
    this.id = data.id || null
    this.name = data.name || ''
    this.description = data.description || ''
    this.location = data.location || ''
    this.registrationCount = data.registrationCount || null
    this.startDatetime = data.startDatetime || null
    this.endDatetime = data.endDatetime || null
    this.banner = data.banner || null
    this.landingConfig = data.landingConfig || null
    this.slug = data.slug || null
    this.currency = data.currency || 'USD'
    this.taxAmount = data.taxAmount || 0
    this.taxType = data.taxType || 'percent'
    this.organizationId = data.organizationId || null
    this.createdBy = data.createdBy || null

    // Configuration fields
    this.config = data.config ? new EventConfig(data.config).toJSON() : new EventConfig().toJSON()
  }

  /**
   * Check if event is currently active (between start and end dates)
   */
  isActive () {
    if (!this.startDatetime || !this.endDatetime) {
      return false
    }

    const now = new Datetime()
    const start = new Datetime(this.startDatetime)
    const end = new Datetime(this.endDatetime)

    return now >= start && now <= end
  }

  /**
   * Check if event is upcoming
   */
  isUpcoming () {
    if (!this.startDatetime) {
      return false
    }

    const now = new Datetime()
    const start = new Datetime(this.startDatetime)

    return now < start
  }

  /**
   * Check if event is past
   */
  isPast () {
    if (!this.endDatetime) {
      return false
    }

    const now = new Datetime()
    const end = new Datetime(this.endDatetime)

    return now > end
  }

  /**
   * Generate a URL-friendly slug from the event name
   */
  generateSlug () {
    if (!this.name) {
      return ''
    }

    return this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
  }

  /**
   * Validates the event data
   */
  validate () {
    const errors = []

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required')
    }

    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less')
    }

    if (!this.startDatetime) {
      errors.push('Start date is required')
    }

    if (!this.endDatetime) {
      errors.push('End date is required')
    }

    if (this.startDatetime && this.endDatetime) {
      const start = new Datetime(this.startDatetime)
      const end = new Datetime(this.endDatetime)
      if (start > end) {
        errors.push('Start date must be before end date')
      }
    }

    if (!this.organizationId) {
      errors.push('Organization ID is required')
    }

    if (!this.createdBy) {
      errors.push('Created by user ID is required')
    }

    if (!this.currency || this.currency.length !== 3) {
      errors.push('Currency must be a valid 3-letter code (e.g., USD, EUR, GBP)')
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
      location: this.location,
      registrationCount: this.registrationCount,
      startDatetime: this.startDatetime,
      endDatetime: this.endDatetime,
      banner: this.banner,
      landingConfig: this.landingConfig,
      slug: this.slug,
      currency: this.currency,
      taxAmount: this.taxAmount,
      taxType: this.taxType,
      organizationId: this.organizationId,
      createdBy: this.createdBy,
      config: this.config,
    }
  }
}
