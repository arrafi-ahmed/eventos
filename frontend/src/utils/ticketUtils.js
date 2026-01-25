/**
 * Ticket utility functions (frontend)
 */

/**
 * Determine if this is a group ticket scenario
 * @param {Object} params
 * @param {boolean|string} params.saveAllAttendeesDetails - Event config
 * @param {number} params.totalQuantity - Total ticket quantity
 * @returns {boolean} True if group ticket
 */
export function isGroupTicket ({ saveAllAttendeesDetails, totalQuantity }) {
  const saveAll = saveAllAttendeesDetails === true || saveAllAttendeesDetails === 'true'
  return !saveAll && totalQuantity > 1
}

/**
 * Get QR code title for success page
 * @param {boolean} isGroup - Whether it's a group ticket
 * @param {string} firstName - Attendee first name
 * @returns {string} QR code title
 */
export function getQrTitle (isGroup, firstName) {
  return isGroup ? 'QR Code for the whole group:' : `QR Code for ${firstName}`
}
