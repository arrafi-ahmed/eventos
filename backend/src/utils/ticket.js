/**
 * Ticket utility functions
 */

/**
 * Determine if this is a group ticket scenario
 * @param {Object} params
 * @param {boolean|string} params.saveAllAttendeesDetails - Event config
 * @param {number} params.totalQuantity - Total ticket quantity
 * @returns {boolean} True if group ticket
 */
function isGroupTicket({saveAllAttendeesDetails, totalQuantity}) {
    const saveAll = saveAllAttendeesDetails === true || saveAllAttendeesDetails === 'true';
    return !saveAll && totalQuantity > 1;
}

/**
 * Get QR code message based on ticket type
 * @param {boolean} isGroup - Whether it's a group ticket
 * @returns {string} QR code message
 */
function getQrMessage(isGroup) {
    return isGroup
        ? 'This QR code is valid for entire group.'
        : 'This QR code is valid for above attendee only.';
}

/**
 * Get email subject based on ticket type
 * @param {boolean} isGroup - Whether it's a group ticket
 * @param {string} eventName - Event name
 * @returns {string} Email subject
 */
function getEmailSubject(isGroup, eventName) {
    return isGroup
        ? `🎟️ Your Tickets for ${eventName}`
        : `🎟️ Your Ticket for ${eventName}`;
}

/**
 * Determine if should show registrant details vs attendee details
 * @param {boolean} isGroup - Whether it's a group ticket
 * @returns {boolean} True if should show registrant details
 */
function isRegistrantDetails(isGroup) {
    return isGroup;
}

module.exports = {
    isGroupTicket,
    getQrMessage,
    getEmailSubject,
    isRegistrantDetails,
};

