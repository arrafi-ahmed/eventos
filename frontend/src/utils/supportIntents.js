/**
 * Frontend Intent Configuration
 * Mirrors backend/src/config/supportIntents.js
 * Used for form rendering and UI logic
 */

/**
 * Slot validation/sanitization functions
 * These are applied to extracted slots before use
 * Mirrors backend/src/config/supportIntents.js SLOT_VALIDATORS
 */
export const SLOT_VALIDATORS = {
  /**
   * Validates and sanitizes order numbers
   * Extracts actual order number from text, rejects invalid values
   */
  orderNumber: value => {
    if (!value || typeof value !== 'string') {
      return null
    }

    const trimmed = value.trim()

    // Reject if it's just the word "order"
    if (trimmed.toLowerCase() === 'order') {
      return null
    }

    // Extract order number pattern (ORD-XXXXXXXX or ORD_XXXXXXXX)
    const orderMatch = trimmed.match(/(ORD[_-]?[\w\d]+)/i)
    if (orderMatch) {
      return orderMatch[1]
    }

    // If it looks like a valid alphanumeric order number (at least 3 chars)
    if (/^[A-Z0-9_-]{3,}$/i.test(trimmed)) {
      return trimmed
    }

    // Invalid format
    return null
  },

  /**
   * Validates email format
   */
  email: value => {
    if (!value || typeof value !== 'string') {
      return null
    }
    const trimmed = value.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(trimmed) ? trimmed : null
  },

  /**
   * Validates oldEmail (same as email)
   */
  oldEmail: value => {
    return SLOT_VALIDATORS.email(value)
  },

  /**
   * Validates newEmail (same as email)
   */
  newEmail: value => {
    return SLOT_VALIDATORS.email(value)
  },
}

export const INTENT_CONFIG = {
  resend_ticket: {
    key: 'resend_ticket',
    label: 'I didn\'t receive my ticket',
    description: 'Resend ticket email to your email address',
    slots: {
      email: { required: true, type: 'email', description: 'User\'s email address' },
      orderNumber: { required: false, type: 'text', description: 'Order number if mentioned' },
      newEmail: { required: false, type: 'email', description: 'Alternative email if user wants tickets sent elsewhere' },
    },
    requiresOTP: false,
    sensitive: false,
    apiEndpoint: '/support/resend-ticket',
  },
  check_payment_status: {
    key: 'check_payment_status',
    label: 'Check payment status',
    description: 'View the payment status of your order',
    slots: {
      email: { required: true, type: 'email', description: 'User\'s email address' },
      orderNumber: { required: true, type: 'text', description: 'Order number' },
    },
    requiresOTP: false,
    sensitive: false,
    apiEndpoint: '/support/check-payment-status',
  },
  check_checkin_status: {
    key: 'check_checkin_status',
    label: 'Check check-in status',
    description: 'View check-in status and QR code information for your tickets',
    slots: {
      email: { required: true, type: 'email', description: 'User\'s email address' },
      orderNumber: { required: true, type: 'text', description: 'Order number' },
    },
    requiresOTP: false,
    sensitive: false,
    apiEndpoint: '/support/check-checkin-status',
  },
  track_shipment: {
    key: 'track_shipment',
    label: 'Track shipment',
    description: 'Track physical product shipments',
    slots: {
      email: { required: true, type: 'email', description: 'User\'s email address' },
      orderNumber: { required: true, type: 'text', description: 'Order number' },
    },
    requiresOTP: false,
    sensitive: false,
    apiEndpoint: '/support/track-shipment',
  },
  update_shipping_address: {
    key: 'update_shipping_address',
    label: 'Update shipping address',
    description: 'Change the shipping address for product orders',
    slots: {
      orderNumber: { required: true, type: 'text', description: 'Order number' },
      line1: { required: true, type: 'text', description: 'Street address' },
      line2: { required: false, type: 'text', description: 'Apartment, suite, etc.' },
      city: { required: true, type: 'text', description: 'City' },
      state: { required: true, type: 'text', description: 'State/Province' },
      postal_code: { required: true, type: 'text', description: 'ZIP/Postal code' },
      country: { required: true, type: 'text', description: 'Country' },
    },
    requiresOTP: true,
    sensitive: true,
    apiEndpoint: '/support/update-shipping-address',
  },
  update_attendee_info: {
    key: 'update_attendee_info',
    label: 'Update attendee information',
    description: 'Modify a specific attendee\'s details (name, email, phone) by attendee ID',
    slots: {
      orderNumber: { required: true, type: 'text', description: 'Order number' },
      attendeeId: { required: true, type: 'text', description: 'Attendee ID' },
      fieldToUpdate: { required: true, type: 'select', description: 'Field to update (first_name, last_name, email, phone)' },
      newValue: { required: true, type: 'text', description: 'New value for the field' },
    },
    requiresOTP: true,
    sensitive: true,
    apiEndpoint: '/support/update-attendee-info',
  },
  view_order_details: {
    key: 'view_order_details',
    label: 'View order details',
    description: 'See complete information about your order',
    slots: {
      email: { required: true, type: 'email', description: 'User\'s email address' },
      orderNumber: { required: true, type: 'text', description: 'Order number' },
    },
    requiresOTP: false,
    sensitive: false,
    apiEndpoint: '/support/view-order-details',
  },
  check_event_details: {
    key: 'check_event_details',
    label: 'Check event details',
    description: 'Get information about the event (date, location, venue, etc.)',
    slots: {
      eventSlug: { required: false, type: 'text', description: 'Event name or slug' },
      orderNumber: { required: false, type: 'text', description: 'Order number' },
    },
    requiresOTP: false,
    sensitive: false,
    apiEndpoint: '/support/check-event-details',
  },
  contact_us: {
    key: 'contact_us',
    label: 'Contact us',
    description: 'Send a message directly to support team',
    slots: {
      email: { required: true, type: 'email', description: 'Your email address' },
      message: { required: true, type: 'textarea', description: 'Your message' },
      orderNumber: { required: false, type: 'text', description: 'Order number (if applicable)' },
    },
    requiresOTP: false,
    sensitive: false,
    apiEndpoint: '/support/contact-us',
  },
}

export const SUPPORT_INTENTS = Object.keys(INTENT_CONFIG)

export function getIntentConfig (intentKey) {
  return INTENT_CONFIG[intentKey] || null
}

export function getIntentSlots (intentKey) {
  const config = getIntentConfig(intentKey)
  return config?.slots || {}
}

export function isValidIntent (intentKey) {
  return SUPPORT_INTENTS.includes(intentKey)
}
