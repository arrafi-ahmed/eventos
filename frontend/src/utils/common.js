import store from '@/store'
import $axios from '@/plugins/axios'
import { currencies } from '@/utils/currency-list'
import { countries } from '@/utils/country-list'

export const appInfo = {
  name: 'EventOS',
  version: 1.0,
  company: {
    name: null,
    address: null,
    email: null,
    phone: null,
  },
  social: {
    facebook: 'https://facebook.com/demo',
    instagram: 'https://instagram.com/demo',
    tiktok: 'https://tiktok.com/@demo',
  },
}
export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
export const clientBaseUrl = import.meta.env.VITE_BASE_URL
export const stripePublic = import.meta.env.VITE_STRIPE_PUBLIC
export const isProd = import.meta.env.PROD

export function sendToWhatsapp(phone, message) {
  const encodedMessage = encodeURIComponent(message)
  const whatsappShareLink = `https://api.whatsapp.com/send?phone=${phone}&text=${encodedMessage}`
  window.open(whatsappShareLink, '_blank')
}

export const getClientPublicImageUrl = imageName => (imageName ? `/img/${imageName}` : null)

export const getApiPublicImageUrl = (imageName, type) => `${apiBaseUrl}/${type}/${imageName}`

export function getUserImageUrl(imageName) {
  return imageName === 'null' || !imageName
    ? getClientPublicImageUrl('default-user.jpg')
    : getApiPublicImageUrl(imageName, 'user')
}

export function getOrganizationImageUrl(imageName) {
  return imageName === 'null' || !imageName
    ? getClientPublicImageUrl('default-user.jpg')
    : getApiPublicImageUrl(imageName, 'organization-logo')
}

export function getEventImageUrl(imageName) {
  // Handle null, undefined, empty string, or string 'null'
  if (!imageName || imageName === 'null' || imageName === 'undefined' || imageName.trim() === '') {
    return getClientPublicImageUrl('default-event.webp')
  }
  return getApiPublicImageUrl(imageName, 'event-banner')
}

export function getProductImageUrl(imageName) {
  if (imageName === 'null' || !imageName) {
    return null // Return null to show icon instead of image
  }
  return getApiPublicImageUrl(imageName, 'product-image')
}

export const padStr = (str, num) => String(str).padStart(num, '0')

export function getToLink(item) {
  if (item.to.params) {
    const paramKey = Object.keys(item.to.params)[0]
    const paramVal = item.to.params[paramKey]
    return {
      name: item.to.name,
      params: { [paramKey]: paramVal },
    }
  }
  return item.to
}

export const checkinItems = [
  { title: 'Pending', value: false },
  { title: 'Checked-in', value: true },
]

export const extrasItems = [
  { title: '', value: null },
  { title: 'Not Redeemed', value: false },
  { title: 'Redeemed', value: true },
]

export function getQueryParam(param) {
  const queryParams = new URLSearchParams(window.location.search)
  return queryParams.get(param)
}

export function removeQueryParams(url, paramsToRemove) {
  const parsedUrl = new URL(url)

  // Create a URLSearchParams object from the URL's search parameters
  const searchParams = new URLSearchParams(parsedUrl.search)

  // Remove the specified query parameters
  for (const param of paramsToRemove) {
    searchParams.delete(param)
  }

  // Construct the new URL with the updated search parameters
  parsedUrl.search = searchParams.toString()

  // Return the updated URL as a string
  return parsedUrl.toString()
}

export function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidImage(file) {
  if (!file || typeof file !== 'object') {
    return false
  }
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png']
  return allowedTypes.includes(file.type)
}

export function generateQrData({ registrationId, attendeeId, qrUuid }) {
  const qrData = {
    r: registrationId,
    a: attendeeId,
    q: qrUuid,
  }
  return JSON.stringify(qrData)
}

export function deepCopy(aObject) {
  // Prevent undefined objects
  if (!aObject) {
    return aObject
  }
  const bObject = Array.isArray(aObject) ? [] : {}
  let value
  for (const key in aObject) {
    // Prevent self-references to parent object
    if (Object.is(aObject[key], aObject)) {
      continue
    }
    value = aObject[key]
    bObject[key] = typeof value === 'object' ? deepCopy(value) : value
  }
  return bObject
}

export function deepMerge(target, source) {
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {}
      }
      deepMerge(target[key], source[key])
    } else {
      target[key] = source[key]
    }
  }
  return target
}

export const isValidPass = [
  v => !!v || 'Password is required!',
  v => v.length >= 8 || 'Password must be 8 or more characters!',
  v => /\d/.test(v) || 'Password must include at least one number!',
]

export function showApiQueryMsg(color = 'blue') {
  if (localStorage.hasOwnProperty('apiQueryMsg')) {
    store.commit('addSnackbar', {
      text: localStorage.getItem('apiQueryMsg'),
      color: color,
    })
    localStorage.removeItem('apiQueryMsg')
  }
}

export const input_fields = [
  { id: 0, title: 'Short answer' },
  { id: 1, title: 'Paragraph' },
  { id: 2, title: 'Multiple choice' },
  { id: 3, title: 'Checkboxes' },
  { id: 4, title: 'Dropdown' },
]

export function getInputType(typeId) {
  return input_fields.find(item => item.id == typeId)
}

export function getCountryList(filterName) {
  if (filterName === 'all') {
    return countries
  }
  return countries.map(item => item[filterName])
}

export function getCurrencySymbol({ code, type }) {
  if (!code) return null
  const codeUpper = code.toString().toUpperCase()
  const currency = currencies.find(c => c.code === codeUpper)

  if (!currency) {
    return null
  }

  const currencyData = {
    icon: 'mdi-cash', // Default icon
    symbol: currency.symbol,
    value: currency.code.toLowerCase(),
    ...currency,
  }

  if (type === undefined) {
    return currencyData
  }
  return currencyData[type]
}

export const defaultCurrency = getCurrencySymbol({ code: 'xof' })

/**
 * Format price for display - converts cents to currency units
 * @param {number} price - Price in cents
 * @param {string} currency - Currency code (USD, EUR, GBP, etc.)
 * @param {object} options - Formatting options
 * @returns {string} Formatted price string
 */
export function formatPrice(price, currency = 'USD', options = {}) {
  if (!price && price !== 0) {
    return ''
  }

  // Convert cents to currency units (prices are always stored in cents)
  const amount = price / 100

  // Get custom symbol if available
  const symbol = getCurrencySymbol({ code: currency, type: 'symbol' })

  const defaultOptions = {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }

  const formatOptions = { ...defaultOptions, ...options }

  const formattedNumber = new Intl.NumberFormat('en-US', formatOptions).format(amount)

  if (symbol) {
    // Check if symbol is a suffix type (optional refinement, but usually prefix in this app context)
    // For simplicity and consistency with design, using prefix + space for longer symbols, or just prefix
    if (symbol.length > 2) {
      return `${symbol} ${formattedNumber}`
    }
    return `${symbol}${formattedNumber}`
  }

  // Fallback to standard currency formatting if symbol not found
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    ...formatOptions,
  }).format(amount)
}

/**
 * Format price in compact form (e.g., $1.2k, $100, $1.50)
 * @param {number} price - Price in cents
 * @param {string} currency - Currency code
 * @returns {string} Compact formatted price string
 */
export function formatPriceCompact(price, currency = 'USD') {
  if (!price && price !== 0) {
    return ''
  }

  // Convert cents to currency units (prices are always stored in cents)
  const amount = price / 100
  const symbol = getCurrencySymbol({ code: currency, type: 'symbol' }) || '$'

  if (amount >= 1000) {
    return `${symbol}${(amount / 1000).toFixed(1)}k`
  } else if (amount >= 100) {
    return `${symbol}${Math.round(amount)}`
  } else {
    return `${symbol}${amount.toFixed(2)}`
  }
}

/**
 * Get the ratio to convert from major currency units to minor units (e.g., dollars to cents)
 * @param {string} currency - Currency code (USD, EUR, GBP, etc.)
 * @returns {number} Conversion ratio (100 for most currencies, 1 for currencies without minor units)
 */
export function getCurrencyMinorUnitRatio(currency) {
  const currencyMap = {
    usd: 100,
    eur: 100,
    gbp: 100,
    cad: 100,
    aud: 100,
    chf: 100,
    jpy: 1, // Japanese Yen has no minor unit
    krw: 1, // South Korean Won has no minor unit
    cny: 100,
    inr: 100,
    brl: 100,
    mxn: 100,
    sek: 100,
    nok: 100,
    dkk: 100,
    pln: 100,
    czk: 100,
    huf: 1, // Hungarian Forint has no minor unit
    rub: 100,
    try: 100,
    zar: 100,
    nzd: 100,
    sgd: 100,
    hkd: 100,
    thb: 100,
    myr: 100,
    php: 100,
    idr: 100,
    vnd: 1, // Vietnamese Dong has no minor unit
    xof: 1, // West African CFA Franc has no minor unit
  }

  return currencyMap[currency.toLowerCase()] || 100 // Default to 100 for unknown currencies
}

export function handleRedirect({ param, hardRedirect = true }) {
  const paramValue = getQueryParam({ param })
  if (paramValue) {
    const newUrl = paramValue

    if (hardRedirect) {
      window.location.replace(newUrl)
    } else {
      window.history.replaceState({}, document.title, newUrl)
    } // Corrected: Use .replace() as a method
    return true // Indicates a redirect happened
  }
  return false
}

export function handleRemoveQueriesNRedirect({
  params = [], // Array of param names to check/remove
  saveToLocalStorage = true,
  hardRedirect = true,
}) {
  let found = false
  const queryParamsToRemove = []

  for (const paramName of params) {
    const paramValue = getQueryParam({ param: paramName })

    if (paramValue) {
      found = true
      queryParamsToRemove.push(paramName)

      if (saveToLocalStorage) {
        localStorage.setItem(paramName, paramValue)
      }
    }
  }

  if (found) {
    const newUrl = removeQueryParams({ paramsToRemove: queryParamsToRemove })

    if (hardRedirect) {
      window.location.replace(newUrl)
    } else {
      window.history.replaceState({}, document.title, newUrl)
    }
    return true
  }
  return false
}

export const ifAdmin = ({ role }) => Number(role) === 20
export const ifOrganizer = ({ role }) => Number(role) === 30
export const ifAttendee = ({ role }) => Number(role) === 40
export const ifCashier = ({ role }) => Number(role) === 50
export const ifStaff = ({ role }) => Number(role) === 60

export function generatePassword(length = 8) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,/()-*&^%$#@!'
  let password = ''
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }
  return password
}

// Generate a URL-friendly slug from a title
export function generateSlug(title) {
  if (!title) {
    return ''
  }

  return (
    title
      .toLowerCase()
      .trim()
      // Replace spaces and special characters with hyphens
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      // Remove multiple consecutive hyphens
      .replace(/-+/g, '-')
      // Remove leading and trailing hyphens
      .replace(/^-+|-+$/g, '')
  )
}

// Utility function to make API calls with suppressed toasts
export const apiCall = {
  // Regular API call (shows toasts)
  async get(url, config = {}) {
    return await $axios.get(url, config)
  },

  async post(url, data, config = {}) {
    return await $axios.post(url, data, config)
  },

  async put(url, data, config = {}) {
    return await $axios.put(url, data, config)
  },

  async delete(url, config = {}) {
    return await $axios.delete(url, config)
  },

  // API calls with suppressed toasts
  async getSilent(url, config = {}) {
    return await $axios.get(url, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },

  async postSilent(url, data, config = {}) {
    return await $axios.post(url, data, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },

  async putSilent(url, data, config = {}) {
    return await $axios.put(url, data, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },

  async deleteSilent(url, config = {}) {
    return await $axios.delete(url, {
      ...config,
      headers: {
        ...config.headers,
        'X-Suppress-Toast': 'true',
      },
    })
  },
}
