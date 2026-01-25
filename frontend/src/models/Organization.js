/**
 * Organization model class
 */
export class Organization {
  constructor (data = {}) {
    this.id = data.id || null
    this.name = data.name || ''
    this.location = data.location || null
    this.logo = data.logo || null
  }

  /**
   * Validates the organization data
   */
  validate () {
    const errors = []

    if (!this.name || this.name.trim().length === 0) {
      errors.push('Name is required')
    }

    if (this.name && this.name.length > 100) {
      errors.push('Name must be 100 characters or less')
    }

    if (this.logo && this.logo.length > 255) {
      errors.push('Logo path must be 255 characters or less')
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
      location: this.location,
      logo: this.logo,
    }
  }
}
