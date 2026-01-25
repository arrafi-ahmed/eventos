/**
 * Layout Cache Utility
 * Manages caching of layout/design data (footer, banners, etc.) in localStorage
 * Cache is updated only when admin changes settings
 * Uses server timestamps to detect stale cache across browsers
 */

import $axios from '@/plugins/axios'

const CACHE_KEYS = {
  FOOTER_SETTINGS: 'layout_cache_footer_settings',
  HEADER_SETTINGS: 'layout_cache_header_settings',
  HOMEPAGE_BANNERS: 'layout_cache_homepage_banners',
  APPEARANCE_SETTINGS: 'layout_cache_appearance_settings',
  ORGANIZER_DASHBOARD_BANNER: 'layout_cache_organizer_dashboard_banner',
  ALL_LAYOUT_DATA: 'layout_cache_all_data', // Unified cache key
  CACHE_VERSION: 'layout_cache_version',
  LAST_UPDATED: 'layout_cache_last_updated',
  SERVER_TIMESTAMPS: 'layout_cache_server_timestamps', // Store server timestamps
}

const CACHE_VERSION = '1.0.0'
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours in milliseconds

/**
 * Get cached data
 */
export function getCachedData(key) {
  try {
    const cached = localStorage.getItem(key)
    if (!cached) {
      return null
    }

    const { data, timestamp, version, serverTimestamp } = JSON.parse(cached)

    // Check if cache is expired or version mismatch
    const now = Date.now()
    if (now - timestamp > CACHE_DURATION) {
      localStorage.removeItem(key)
      return null
    }

    if (version !== CACHE_VERSION) {
      // Clear all cache if version mismatch
      clearAllCache()
      return null
    }

    return { data, serverTimestamp }
  } catch (error) {
    console.error('Error reading cache:', error)
    return null
  }
}

/**
 * Get server timestamps for all layout settings
 * This is a lightweight check to see if cache is stale
 */
let serverTimestampsCache = null
let serverTimestampsCacheTime = 0
const SERVER_TIMESTAMPS_CACHE_DURATION = 5 * 60 * 1000 // Cache server timestamps for 5 minutes

export async function getServerTimestamps() {
  try {
    // Use in-memory cache to avoid too many requests
    const now = Date.now()
    if (serverTimestampsCache && (now - serverTimestampsCacheTime) < SERVER_TIMESTAMPS_CACHE_DURATION) {
      return serverTimestampsCache
    }

    const response = await $axios.get('/layout-cache/timestamps')
    const timestamps = response.data?.payload?.timestamps || {}
    serverTimestampsCache = timestamps
    serverTimestampsCacheTime = now

    // Also store in localStorage for persistence
    try {
      localStorage.setItem(CACHE_KEYS.SERVER_TIMESTAMPS, JSON.stringify({
        timestamps,
        timestamp: now,
      }))
    } catch {
      // Ignore localStorage errors
    }

    return timestamps
  } catch (error) {
    console.error('Error fetching server timestamps:', error)
    // Try to get from localStorage as fallback
    try {
      const stored = localStorage.getItem(CACHE_KEYS.SERVER_TIMESTAMPS)
      if (stored) {
        const { timestamps, timestamp } = JSON.parse(stored)
        // Use if less than 1 hour old
        const now = Date.now()
        if (now - timestamp < 60 * 60 * 1000) {
          return timestamps
        }
      }
    } catch {
      // Ignore
    }
    return null
  }
}

/**
 * Check if cached data is stale by comparing with server timestamp
 */
export async function isCacheStale(cacheKey, serverTimestampKey) {
  try {
    const cached = getCachedData(cacheKey)
    if (!cached) {
      return true
    } // No cache, consider stale

    const serverTimestamps = await getServerTimestamps()
    if (!serverTimestamps) {
      // If we can't get server timestamps, use cache (fail gracefully)
      return false
    }

    const serverTimestamp = serverTimestamps[serverTimestampKey]
    if (!serverTimestamp) {
      // No server timestamp, assume cache is valid
      return false
    }

    // Convert timestamps to comparable format
    const cachedTimestamp = cached.serverTimestamp
    if (!cachedTimestamp) {
      // Old cache format without server timestamp, consider stale
      return true
    }

    // Compare timestamps (handle both ISO strings and timestamps)
    const serverTime = new Date(serverTimestamp).getTime()
    const cachedTime = new Date(cachedTimestamp).getTime()

    // If server timestamp is newer, cache is stale
    return serverTime > cachedTime
  } catch (error) {
    console.error('Error checking cache staleness:', error)
    // On error, assume cache is valid (fail gracefully)
    return false
  }
}

/**
 * Set cached data with server timestamp
 */
export async function setCachedData(key, data, serverTimestamp = null) {
  try {
    // If server timestamp not provided, try to get it from server timestamps
    if (!serverTimestamp) {
      const timestamps = await getServerTimestamps()
      if (timestamps) {
        // Map cache key to timestamp key
        const timestampMap = {
          [CACHE_KEYS.FOOTER_SETTINGS]: 'footer',
          [CACHE_KEYS.HEADER_SETTINGS]: 'header',
          [CACHE_KEYS.APPEARANCE_SETTINGS]: 'appearance',
          [CACHE_KEYS.ORGANIZER_DASHBOARD_BANNER]: 'organizerDashboardBanner',
          [CACHE_KEYS.HOMEPAGE_BANNERS]: 'homepageBanners',
        }
        serverTimestamp = timestamps[timestampMap[key]] || null
      }
    }

    const cacheData = {
      data,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      serverTimestamp, // Store server timestamp for comparison
    }
    localStorage.setItem(key, JSON.stringify(cacheData))
    localStorage.setItem(CACHE_KEYS.LAST_UPDATED, Date.now().toString())
  } catch (error) {
    console.error('Error setting cache:', error)
  }
}

/**
 * Clear specific cache
 */
export function clearCache(key) {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Error clearing cache:', error)
  }
}

/**
 * Clear all layout cache
 */
export function clearAllCache() {
  try {
    for (const key of Object.values(CACHE_KEYS)) {
      if (key !== CACHE_KEYS.CACHE_VERSION) {
        localStorage.removeItem(key)
      }
    }
  } catch (error) {
    console.error('Error clearing all cache:', error)
  }
}

/**
 * Invalidate cache (call when admin updates settings)
 */
export function invalidateCache() {
  clearAllCache()
}

/**
 * Get footer settings from cache
 */
export function getCachedFooterSettings() {
  const cached = getCachedData(CACHE_KEYS.FOOTER_SETTINGS)
  return cached ? cached.data : null
}

/**
 * Cache footer settings
 */
export async function cacheFooterSettings(settings, serverTimestamp = null) {
  await setCachedData(CACHE_KEYS.FOOTER_SETTINGS, settings, serverTimestamp)
}

/**
 * Check if footer settings cache is stale
 */
export async function isFooterCacheStale() {
  return await isCacheStale(CACHE_KEYS.FOOTER_SETTINGS, 'footer')
}

/**
 * Get homepage banners from cache
 */
export function getCachedHomepageBanners() {
  const cached = getCachedData(CACHE_KEYS.HOMEPAGE_BANNERS)
  return cached ? cached.data : null
}

/**
 * Cache homepage banners
 */
export async function cacheHomepageBanners(banners, serverTimestamp = null) {
  await setCachedData(CACHE_KEYS.HOMEPAGE_BANNERS, banners, serverTimestamp)
}

/**
 * Check if homepage banners cache is stale
 */
export async function isHomepageBannersCacheStale() {
  return await isCacheStale(CACHE_KEYS.HOMEPAGE_BANNERS, 'homepageBanners')
}

/**
 * Get header settings from cache
 */
export function getCachedHeaderSettings() {
  const cached = getCachedData(CACHE_KEYS.HEADER_SETTINGS)
  return cached ? cached.data : null
}

/**
 * Cache header settings
 */
export async function cacheHeaderSettings(settings, serverTimestamp = null) {
  await setCachedData(CACHE_KEYS.HEADER_SETTINGS, settings, serverTimestamp)
}

/**
 * Check if header settings cache is stale
 */
export async function isHeaderCacheStale() {
  return await isCacheStale(CACHE_KEYS.HEADER_SETTINGS, 'header')
}

/**
 * Get appearance settings from cache
 */
export function getCachedAppearanceSettings() {
  const cached = getCachedData(CACHE_KEYS.APPEARANCE_SETTINGS)
  return cached ? cached.data : null
}

/**
 * Cache appearance settings
 */
export async function cacheAppearanceSettings(settings, serverTimestamp = null) {
  await setCachedData(CACHE_KEYS.APPEARANCE_SETTINGS, settings, serverTimestamp)
}

/**
 * Check if appearance settings cache is stale
 */
export async function isAppearanceCacheStale() {
  return await isCacheStale(CACHE_KEYS.APPEARANCE_SETTINGS, 'appearance')
}

/**
 * Get organizer dashboard banner from cache
 */
export function getCachedOrganizerDashboardBanner() {
  const cached = getCachedData(CACHE_KEYS.ORGANIZER_DASHBOARD_BANNER)
  return cached ? cached.data : null
}

/**
 * Cache organizer dashboard banner
 */
export async function cacheOrganizerDashboardBanner(settings, serverTimestamp = null) {
  await setCachedData(CACHE_KEYS.ORGANIZER_DASHBOARD_BANNER, settings, serverTimestamp)
}

/**
 * Check if organizer dashboard banner cache is stale
 */
export async function isOrganizerDashboardBannerCacheStale() {
  return await isCacheStale(CACHE_KEYS.ORGANIZER_DASHBOARD_BANNER, 'organizerDashboardBanner')
}

/**
 * Unified layout cache functions - get all layout data from single cache
 */
export function getCachedAllLayoutData() {
  const cached = getCachedData(CACHE_KEYS.ALL_LAYOUT_DATA)
  return cached ? cached.data : null
}

export async function cacheAllLayoutData(layoutData, timestamps = null) {
  try {
    const cacheData = {
      data: layoutData,
      timestamp: Date.now(),
      version: CACHE_VERSION,
      serverTimestamps: timestamps || layoutData.timestamps || {},
    }
    localStorage.setItem(CACHE_KEYS.ALL_LAYOUT_DATA, JSON.stringify(cacheData))

    // Also update individual cache keys for backward compatibility
    if (layoutData.footer) {
      await cacheFooterSettings(layoutData.footer, timestamps?.footer || layoutData.footer.updatedAt)
    }
    if (layoutData.header) {
      await cacheHeaderSettings(layoutData.header, timestamps?.header || layoutData.header.updatedAt)
    }
    if (layoutData.appearance) {
      await cacheAppearanceSettings(layoutData.appearance, timestamps?.appearance || layoutData.appearance.updatedAt)
    }
    if (layoutData.organizerDashboardBanner) {
      await cacheOrganizerDashboardBanner(layoutData.organizerDashboardBanner, timestamps?.organizerDashboardBanner || layoutData.organizerDashboardBanner.updatedAt)
    }
    if (layoutData.homepageBanners) {
      await cacheHomepageBanners(layoutData.homepageBanners, timestamps?.homepageBanners)
    }
  } catch (error) {
    console.error('Error caching all layout data:', error)
  }
}

export async function isAllLayoutCacheStale() {
  const cached = getCachedAllLayoutData()
  if (!cached) {
    return true
  }

  const cacheData = getCachedData(CACHE_KEYS.ALL_LAYOUT_DATA)
  if (!cacheData || !cacheData.serverTimestamps) {
    return true
  }

  // Check if any component has been updated on server
  try {
    const serverTimestamps = await getServerTimestamps()
    if (!serverTimestamps) {
      return false
    } // If we can't check, assume cache is valid

    // Compare each timestamp
    const cachedTimestamps = cacheData.serverTimestamps
    return (
      (serverTimestamps.footer && serverTimestamps.footer !== cachedTimestamps.footer)
      || (serverTimestamps.header && serverTimestamps.header !== cachedTimestamps.header)
      || (serverTimestamps.appearance && serverTimestamps.appearance !== cachedTimestamps.appearance)
      || (serverTimestamps.organizerDashboardBanner && serverTimestamps.organizerDashboardBanner !== cachedTimestamps.organizerDashboardBanner)
      || (serverTimestamps.homepageBanners && serverTimestamps.homepageBanners !== cachedTimestamps.homepageBanners)
    )
  } catch (error) {
    console.error('Error checking cache staleness:', error)
    return false // If error, assume cache is valid
  }
}

export { CACHE_KEYS }
