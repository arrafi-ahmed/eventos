import $axios from '@/plugins/axios'
import {
  cacheOrganizerDashboardBanner,
  getCachedOrganizerDashboardBanner,
  invalidateCache,
  isOrganizerDashboardBannerCacheStale,
} from '@/utils/layoutCache'

export const namespaced = true

export function state () {
  return {
    settings: {
      isEnabled: false,
      icon: null,
      title: null,
      description: null,
      ctaButtonText: null,
      ctaButtonUrl: null,
    },
  }
}

export const mutations = {
  setSettings (state, payload) {
    state.settings = {
      isEnabled: payload.isEnabled !== false,
      icon: payload.icon,
      title: payload.title,
      description: payload.description || null,
      ctaButtonText: payload.ctaButtonText,
      ctaButtonUrl: payload.ctaButtonUrl,
    }
  },
}

export const actions = {
  async fetchSettings ({ commit }) {
    // Try cache first, but check if it's stale
    const cached = getCachedOrganizerDashboardBanner()
    if (cached) {
      const stale = await isOrganizerDashboardBannerCacheStale()
      if (!stale) {
        // Cache is still valid, use it
        commit('setSettings', cached)
        return { settings: cached }
      }
      // Cache is stale, will fetch fresh data below
    }

    // Fetch from API if no cache or cache is stale (DB already returns camelCase)
    try {
      const response = await $axios.get('/organizer-dashboard-banner')
      const settings = response.data?.payload.settings || {}
      commit('setSettings', settings)
      // Cache the settings with server timestamp
      await cacheOrganizerDashboardBanner(settings, settings.updatedAt)
      return response.data?.payload
    } catch (error) {
      console.error('Error fetching organizer dashboard banner settings:', error)
      // If we have cached data, use it even if stale (fail gracefully)
      if (cached) {
        commit('setSettings', cached)
        return { settings: cached }
      }
      // Return default if API fails and no cache
      const defaultSettings = {
        isEnabled: false,
        icon: null,
        title: null,
        description: null,
        ctaButtonText: null,
        ctaButtonUrl: null,
      }
      commit('setSettings', defaultSettings)
      return { settings: defaultSettings }
    }
  },

  async updateSettings ({ dispatch }, payload) {
    await $axios.put('/admin/organizer-dashboard-banner', payload)
    // Invalidate cache when admin updates
    invalidateCache()
    await dispatch('fetchSettings')
  },
}
