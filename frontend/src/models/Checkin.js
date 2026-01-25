/**
 * Checkin model class
 */
export class Checkin {
  constructor (data = {}) {
    this.id = data.id || null
    this.attendeeId = data.attendeeId || null
    this.registrationId = data.registrationId || null
    this.checkedInBy = data.checkedInBy || null
    this.createdAt = data.createdAt || null
  }

  /**
   * Check if checkin has a user who performed it
   */
  hasCheckedInBy () {
    return this.checkedInBy !== null
  }

  /**
   * Get checkin time as a formatted string
   */
  getCheckinTime () {
    if (!this.createdAt) {
      return 'Unknown'
    }

    const date = new Date(this.createdAt)
    return date.toLocaleString()
  }

  /**
   * Check if checkin is recent (within last hour)
   */
  isRecent () {
    if (!this.createdAt) {
      return false
    }

    const checkinTime = new Date(this.createdAt)
    const now = new Date()
    const diffInHours = (now - checkinTime) / (1000 * 60 * 60)

    return diffInHours < 1
  }

  /**
   * Check if checkin is today
   */
  isToday () {
    if (!this.createdAt) {
      return false
    }

    const checkinDate = new Date(this.createdAt)
    const today = new Date()

    return checkinDate.toDateString() === today.toDateString()
  }

  /**
   * Get checkin date as string
   */
  getCheckinDate () {
    if (!this.createdAt) {
      return 'Unknown'
    }

    const date = new Date(this.createdAt)
    return date.toDateString()
  }

  /**
   * Validates the checkin data
   */
  validate () {
    const errors = []

    if (!this.attendeeId) {
      errors.push('Attendee ID is required')
    }

    if (!this.registrationId) {
      errors.push('Registration ID is required')
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
      attendeeId: this.attendeeId,
      registrationId: this.registrationId,
      checkedInBy: this.checkedInBy,
      createdAt: this.createdAt,
    }
  }
}
