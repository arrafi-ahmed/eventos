export function parseAsLocalDate({ input, midday = false } = {}) {
  if (!input) {
    return null
  }

  if (typeof input === 'string') {
    // Handle pure date string "YYYY-MM-DD"
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      const [y, m, d] = input.split('-').map(Number)
      return new Date(y, m - 1, d, midday ? 12 : 0)
    }
    // ISO string or timestamp
    return new Date(input)
  }

  // If already a Date object
  return new Date(input)
}

export function toUTCISOString({ inputDate } = {}) {
  const date = new Date(inputDate)
  const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60_000)
  const result = utcDate.toISOString()
  return result
}

export function fromUTCToLocal({ utcString } = {}) {
  return new Date(utcString)
}

export function splitDateTime({ inputDate, isOutputUTC = false }) {
  if (!inputDate) {
    return { dateStr: '', timeStr: '' }
  }

  const date = new Date(inputDate)

  const year = isOutputUTC ? date.getUTCFullYear() : date.getFullYear()
  const month = (isOutputUTC ? date.getUTCMonth() : date.getMonth()) + 1
  const day = isOutputUTC ? date.getUTCDate() : date.getDate()
  const hours = isOutputUTC ? date.getUTCHours() : date.getHours()
  const minutes = isOutputUTC ? date.getUTCMinutes() : date.getMinutes()
  const seconds = isOutputUTC ? date.getUTCSeconds() : date.getSeconds()

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return { dateStr, timeStr }
}

export function mergeDateTime({ dateStr, timeStr = '12:00', isOutputUTC = false } = {}) {
  if (!dateStr) {
    return null
  }

  // If dateStr is in YYYY-MM-DD, treat it as LOCAL date (not UTC)
  let d
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [Y, M, D] = dateStr.split('-').map(Number)
    d = new Date(Y, M - 1, D) // <-- Local date constructor
  } else {
    d = new Date(dateStr)
  }

  if (Number.isNaN(d)) {
    return null
  }

  const [H, M, S = 0] = timeStr.split(':').map(Number)
  d.setHours(H, M, S, 0)

  return isOutputUTC ? d.toISOString() : d
}

/**
 * Formats a date string or object according to a timezone and format string.
 * Uses Intl.DateTimeFormat for robust IANA timezone support.
 */
export function formatInTimezone(input, timezone = 'UTC', format = 'MM/DD/YYYY HH:mm') {
  if (!input) {
    return ''
  }
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) {
    return ''
  }

  // Use Intl.DateTimeFormat to get localized parts
  const options = {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }

  const formatter = new Intl.DateTimeFormat('en-US', options)
  const parts = formatter.formatToParts(date)
  const partValues = {}
  for (const p of parts) {
    partValues[p.type] = p.value
  }

  // Use Intl.DateTimeFormat to get localized month names
  const locale = (typeof window !== 'undefined' && localStorage.getItem('user-locale')) || 'en'
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1)),
  )
  const monthNamesShort = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1)),
  )

  // Month is 1-indexed in partValues because of 'en-US' locale and '2-digit'
  const monthIndex = Number.parseInt(partValues.month, 10) - 1

  const map = {
    YYYY: partValues.year,
    MM: partValues.month,
    DD: partValues.day,
    HH: partValues.hour === '24' ? '00' : partValues.hour, // Some browsers return 24 for 00
    mm: partValues.minute,
    ss: partValues.second,
    MMM: monthNamesShort[monthIndex],
    MMMM: monthNames[monthIndex],
  }

  return format.replace(/YYYY|MM|DD|HH|mm|ss|MMM|MMMM/g, t => map[t])
}

export function formatDate({ input, format = 'MM/DD/YYYY', timezone } = {}) {
  // If timezone is provided, use the new robust formatter
  if (timezone) {
    return formatInTimezone(input, timezone, format)
  }

  const date = parseAsLocalDate({ input })
  if (!date || Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = n => String(n).padStart(2, '0')
  const locale = (typeof window !== 'undefined' && localStorage.getItem('user-locale')) || 'en'
  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'long' }).format(new Date(2024, i, 1)),
  )
  const monthNamesShort = Array.from({ length: 12 }, (_, i) =>
    new Intl.DateTimeFormat(locale, { month: 'short' }).format(new Date(2024, i, 1)),
  )

  const map = {
    YYYY: date.getFullYear(),
    MM: pad(date.getMonth() + 1),
    DD: pad(date.getDate()),
    HH: pad(date.getHours()),
    mm: pad(date.getMinutes()),
    ss: pad(date.getSeconds()),
    MMM: monthNamesShort[date.getMonth()],
    MMMM: monthNames[date.getMonth()],
  }

  return format.replace(/YYYY|MM|DD|HH|mm|ss|MMM|MMMM/g, t => map[t])
}

export function formatDateTime({ input, timezone } = {}) {
  if (!input) {
    return 'N/A'
  }
  if (timezone) {
    return formatInTimezone(input, timezone, 'MM/DD/YYYY HH:mm')
  }
  return new Date(input).toLocaleString()
}

export function formatEventDate({ input, eventConfig = {}, midday = false } = {}) {
  const dateFormat = eventConfig?.dateFormat || 'MM/DD/YYYY HH:mm'
  return formatDate({ input, format: dateFormat, midday })
}

export function formatTimeRange({ start, end, eventConfig = {} } = {}) {
  if (!start || !end) {
    return ''
  }

  const dateFormat = eventConfig?.dateFormat || 'MM/DD/YYYY HH:mm'
  // Extract time format from the date format
  const timeFormat = dateFormat.includes('HH:mm') ? 'HH:mm' : 'HH:mm'

  const startTime = formatDate({ input: start, format: timeFormat })
  const endTime = formatDate({ input: end, format: timeFormat })

  return `${startTime} - ${endTime}`
}

export function formatEventDateDisplay({ event, eventConfig = {} } = {}) {
  if (!event) {
    return 'Date TBA'
  }

  const start = event.startDatetime || event.startDate
  const end = event.endDatetime || event.endDate
  const isAllDay = eventConfig?.isAllDay || event?.config?.isAllDay
  const isSingleDay = eventConfig?.isSingleDayEvent || event?.config?.isSingleDayEvent
  const showEndTime = eventConfig?.showEndTime !== false && event?.config?.showEndTime !== false

  if (!start && !end) {
    return 'Date TBA'
  }

  // Special case: Single day event but NOT all-day (show date + time range)
  if (isSingleDay && !isAllDay && start && end && showEndTime) {
    const dateFormat = eventConfig?.dateFormat || event?.config?.dateFormat || 'MM/DD/YYYY HH:mm'
    // Remove time part from format for the date
    const dateOnlyFormat = dateFormat.replace(/ HH:mm|HH:mm/g, '')

    const formattedDate = formatDate({ input: start, format: dateOnlyFormat })
    const timeRange = formatTimeRange({ start, end, eventConfig })

    return `${formattedDate} ${timeRange}`
  }

  // Special case: Single day event but NOT all-day (show date + start time only)
  if (isSingleDay && !isAllDay && start && end && !showEndTime) {
    const dateFormat = eventConfig?.dateFormat || event?.config?.dateFormat || 'MM/DD/YYYY HH:mm'
    // Remove time part from format for the date
    const dateOnlyFormat = dateFormat.replace(/ HH:mm|HH:mm/g, '')
    const timeFormat = dateFormat.includes('HH:mm') ? 'HH:mm' : 'HH:mm'

    const formattedDate = formatDate({ input: start, format: dateOnlyFormat })
    const startTime = formatDate({ input: start, format: timeFormat })

    return `${formattedDate} ${startTime}`
  }

  // If it's an all-day event, only show the date part
  if (isAllDay) {
    const dateFormat = eventConfig?.dateFormat || event?.config?.dateFormat || 'MM/DD/YYYY'
    // Remove time part from format for all-day events
    const dateOnlyFormat = dateFormat.replace(/ HH:mm|HH:mm/g, '')

    if (start && (!end || isSingleDay)) {
      return formatDate({ input: start, format: dateOnlyFormat })
    }

    if (start && end) {
      const sameDay = new Date(start).toDateString() === new Date(end).toDateString()
      if (sameDay || isSingleDay) {
        return formatDate({ input: start, format: dateOnlyFormat })
      }
      return `${formatDate({ input: start, format: dateOnlyFormat })} - ${formatDate({
        input: end,
        format: dateOnlyFormat,
      })}`
    }

    return formatDate({ input: start, format: dateOnlyFormat })
  }

  // For timed events, show the full format
  if (start && (!end || isSingleDay)) {
    return formatEventDate({ input: start, eventConfig })
  }

  if (start && end) {
    const sameDay = new Date(start).toDateString() === new Date(end).toDateString()
    if (sameDay || isSingleDay) {
      return formatEventDate({ input: start, eventConfig })
    }

    // For multi-day events, respect showEndTime setting
    return showEndTime
      ? `${formatEventDate({ input: start, eventConfig })} - ${formatEventDate({
        input: end,
        eventConfig,
      })}`
      : formatEventDate({ input: start, eventConfig })
  }

  return formatEventDate({ input: start, eventConfig })
}
