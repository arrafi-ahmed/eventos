import $axios from '@/plugins/axios'
import { cacheFooterSettings, getCachedFooterSettings, invalidateCache, isFooterCacheStale } from '@/utils/layoutCache'

export const namespaced = true

export function state () {
  return {
    settings: {
      style: 'expanded',
      companyName: null,
      companyAddress: null,
      companyEmail: null,
      companyPhone: null,
      quickLinks: [],
      socialLinks: {},
      copyrightText: null,
    },
  }
}

export const mutations = {
  setSettings (state, payload) {
    state.settings = {
      style: payload.style || 'expanded',
      companyName: payload.companyName === undefined ? null : payload.companyName,
      companyAddress: payload.companyAddress === undefined ? null : payload.companyAddress,
      companyEmail: payload.companyEmail === undefined ? null : payload.companyEmail,
      companyPhone: payload.companyPhone === undefined ? null : payload.companyPhone,
      quickLinks: Array.isArray(payload.quickLinks) ? payload.quickLinks : [],
      socialLinks: payload.socialLinks && typeof payload.socialLinks === 'object' ? payload.socialLinks : {},
      copyrightText: payload.copyrightText === undefined ? null : payload.copyrightText,
    }
  },
}

export const actions = {
  async fetchSettings ({ commit, state }) {
    // Try cache first, but check if it's stale
    const cached = getCachedFooterSettings()
    if (cached) {
      const stale = await isFooterCacheStale()
      if (!stale) {
        // Cache is still valid, use it
        commit('setSettings', cached)
        return { settings: cached }
      }
      // Cache is stale, will fetch fresh data below
    }

    // Fetch from API if no cache or cache is stale (DB already returns camelCase)
    try {
      const response = await $axios.get('/footer')
      const settings = response.data?.payload.settings || {}
      commit('setSettings', settings)
      // Cache the settings with server timestamp
      await cacheFooterSettings(settings, settings.updatedAt)
      return response.data?.payload
    } catch (error) {
      console.error('Error fetching footer settings:', error)
      // If we have cached data, use it even if stale (fail gracefully)
      if (cached) {
        commit('setSettings', cached)
        return { settings: cached }
      }
      // Return default if API fails and no cache
      const defaultSettings = {
        style: 'expanded',
        companyName: null,
        companyAddress: null,
        companyEmail: null,
        companyPhone: null,
        quickLinks: [],
        socialLinks: {},
        copyrightText: null,
      }
      commit('setSettings', defaultSettings)
      return { settings: defaultSettings }
    }
  },

  async updateSettings ({ dispatch }, settings) {
    // Send camelCase directly - backend will handle conversion to snake_case for SQL
    await $axios.put('/admin/footer', settings)
    // Invalidate cache when admin updates
    invalidateCache()
    await dispatch('fetchSettings')
  },
}
