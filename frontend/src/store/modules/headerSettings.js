import $axios from '@/plugins/axios'
import { cacheHeaderSettings, getCachedHeaderSettings, invalidateCache, isHeaderCacheStale } from '@/utils/layoutCache'

export const namespaced = true

export function state() {
  return {
    loading: true, // Track loading state to prevent showing text logo while loading
    settings: {
      logoImage: null,
      logoImageDark: null,
      logoPosition: 'left',
      menuPosition: 'right',
      logoWidthLeft: 300,
    },
  }
}

export const mutations = {
  setSettings(state, payload) {
    state.settings = {
      logoImage: payload.logoImage === undefined ? null : payload.logoImage,
      logoImageDark: payload.logoImageDark === undefined ? null : payload.logoImageDark,
      logoPosition: payload.logoPosition || 'left',
      menuPosition: payload.menuPosition || 'right',
      logoWidthLeft: payload.logoWidthLeft === undefined ? 300 : payload.logoWidthLeft,
    }
  },
  setLoading(state, loading) {
    state.loading = loading
  },
}

export const actions = {
  async fetchSettings({ commit, state }) {
    commit('setLoading', true)

    // Try cache first, but check if it's stale
    const cached = getCachedHeaderSettings()
    if (cached) {
      const stale = await isHeaderCacheStale()
      if (!stale) {
        // Cache is still valid, use it
        commit('setSettings', cached)
        commit('setLoading', false)
        return { settings: cached }
      }
      // Cache is stale, will fetch fresh data below
    }

    // Fetch from API if no cache or cache is stale (DB already returns camelCase)
    try {
      const response = await $axios.get('/header')
      const settings = response.data?.payload.settings || {}
      commit('setSettings', settings)
      // Cache the settings with server timestamp
      await cacheHeaderSettings(settings, settings.updatedAt)
      commit('setLoading', false)
      return response.data?.payload
    } catch (error) {
      console.error('Error fetching header settings:', error)
      // If we have cached data, use it even if stale (fail gracefully)
      if (cached) {
        commit('setSettings', cached)
        commit('setLoading', false)
        return { settings: cached }
      }
      // Return default if API fails and no cache
      const defaultSettings = {
        logoImage: null,
        logoImageDark: null,
        logoPosition: 'left',
        menuPosition: 'right',
        logoWidthLeft: 300,
      }
      commit('setSettings', defaultSettings)
      commit('setLoading', false)
      return { settings: defaultSettings }
    }
  },

  async updateSettings({ dispatch }, formData) {
    // FormData is already prepared with camelCase field names
    await $axios.put('/admin/header', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    // Invalidate cache when admin updates
    invalidateCache()
    await dispatch('fetchSettings')
  },
}
