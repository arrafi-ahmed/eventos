/**
 * Timezone-aware date utilities for backend email service
 *
 * Strategy:
 * - Store user's timezone during registration (from Intl API)
 * - Convert all dates (event times, registration times) to user's timezone
 * - Display in human-readable format
 */

/**
 * Convert UTC date to specific timezone and format it
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} targetTimezone - IANA timezone (e.g., 'America/Phoenix')
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatInTimezone(utcDate, targetTimezone = 'UTC', options = {}) {
    if (!utcDate) return '';

    const date = new Date(utcDate);
    if (isNaN(date.getTime())) return '';

    // Default options for date/time formatting
    const defaultOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: targetTimezone,
    };

    const formatOptions = { ...defaultOptions, ...options };

    try {
        return new Intl.DateTimeFormat('en-US', formatOptions).format(date);
    } catch (error) {
        console.error('Error formatting date:', error);
        return date.toISOString();
    }
}

/**
 * Format date in human-friendly format with timezone
 * Example: "Saturday, November 19, 2025 at 6:30 PM MST"
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} targetTimezone - IANA timezone
 * @returns {string} Formatted date string
 */
function formatLongDate(utcDate, targetTimezone = 'UTC') {
    if (!utcDate) return '';

    const date = new Date(utcDate);
    if (isNaN(date.getTime())) return '';

    try {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: targetTimezone,
            timeZoneName: 'short',
        };

        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (error) {
        console.error('Error formatting long date:', error);
        return date.toISOString();
    }
}

/**
 * Format date only (no time) in specific timezone
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} targetTimezone - IANA timezone
 * @returns {string} Formatted date string (e.g., "11/19/2025")
 */
function formatDateOnly(utcDate, targetTimezone = 'UTC') {
    if (!utcDate) return '';

    const date = new Date(utcDate);
    if (isNaN(date.getTime())) return '';

    try {
        const options = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: targetTimezone,
        };

        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (error) {
        console.error('Error formatting date only:', error);
        return '';
    }
}

/**
 * Format time only in specific timezone
 * @param {string|Date} utcDate - UTC date string or Date object
 * @param {string} targetTimezone - IANA timezone
 * @returns {string} Formatted time string (e.g., "6:30 PM")
 */
function formatTimeOnly(utcDate, targetTimezone = 'UTC') {
    if (!utcDate) return '';

    const date = new Date(utcDate);
    if (isNaN(date.getTime())) return '';

    try {
        const options = {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: targetTimezone,
        };

        return new Intl.DateTimeFormat('en-US', options).format(date);
    } catch (error) {
        console.error('Error formatting time only:', error);
        return '';
    }
}

/**
 * Format event date/time range
 * @param {string|Date} startDate - Event start date (UTC)
 * @param {string|Date} endDate - Event end date (UTC)
 * @param {string} targetTimezone - IANA timezone
 * @param {Object} eventConfig - Event configuration
 * @returns {string} Formatted date/time range
 */
function formatEventDateTimeRange(startDate, endDate, targetTimezone = 'UTC', eventConfig = {}) {
    if (!startDate) return 'Date TBA';

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : null;

    if (isNaN(start.getTime())) return 'Date TBA';

    const isSingleDay = eventConfig?.isSingleDayEvent === true || eventConfig?.isSingleDayEvent === 'true';
    const isAllDay = eventConfig?.isAllDay === true || eventConfig?.isAllDay === 'true';

    try {
        // For all-day events, just show dates
        if (isAllDay) {
            const startDateStr = formatDateOnly(start, targetTimezone);
            if (!end || isSingleDay) {
                return startDateStr;
            }
            const endDateStr = formatDateOnly(end, targetTimezone);
            return `${startDateStr} - ${endDateStr}`;
        }

        // For single-day events with time
        if (isSingleDay && end) {
            const dateStr = formatDateOnly(start, targetTimezone);
            const startTime = formatTimeOnly(start, targetTimezone);
            const endTime = formatTimeOnly(end, targetTimezone);
            return `${dateStr} ${startTime} - ${endTime}`;
        }

        // For multi-day events with time
        if (end) {
            const startStr = formatInTimezone(start, targetTimezone, {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
            const endStr = formatInTimezone(end, targetTimezone, {
                month: '2-digit',
                day: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
            });
            return `${startStr} - ${endStr}`;
        }

        // Single date with time
        return formatInTimezone(start, targetTimezone);
    } catch (error) {
        console.error('Error formatting event date/time range:', error);
        return 'Date TBA';
    }
}

/**
 * Get timezone abbreviation from IANA timezone name
 * @param {string} timezone - IANA timezone (e.g., 'America/Phoenix')
 * @param {Date} date - Date to get abbreviation for (important for DST)
 * @returns {string} Timezone abbreviation (e.g., 'MST')
 */
function getTimezoneAbbreviation(timezone = 'UTC', date = new Date()) {
    try {
        const formatted = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            timeZoneName: 'short',
        }).format(date);

        // Extract timezone abbreviation from formatted string
        const parts = formatted.split(' ');
        return parts[parts.length - 1];
    } catch (error) {
        console.error('Error getting timezone abbreviation:', error);
        return timezone;
    }
}

function formatDateTime(utcDate, targetTimezone = 'UTC') {
    return formatInTimezone(utcDate, targetTimezone, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

module.exports = {
    formatInTimezone,
    formatLongDate,
    formatDateOnly,
    formatTimeOnly,
    formatEventDateTimeRange,
    getTimezoneAbbreviation,
    formatDateTime,
};

