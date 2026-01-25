import $axios from '@/plugins/axios'
import {
  cacheAppearanceSettings,
  getCachedAppearanceSettings,
  invalidateCache,
  isAppearanceCacheStale,
} from '@/utils/layoutCache'

export const namespaced = true

// Defaults are defined in backend/src/service/appearanceSettings.js
// Frontend uses empty defaults and merges with backend response
const DEFAULT_LIGHT_COLORS = {}
const DEFAULT_DARK_COLORS = {}
const DEFAULT_LIGHT_VARIABLES = {}
const DEFAULT_DARK_VARIABLES = {}

export function state () {
  return {
    settings: {
      defaultTheme: 'dark',
      lightColors: DEFAULT_LIGHT_COLORS,
      lightVariables: DEFAULT_LIGHT_VARIABLES,
      darkColors: DEFAULT_DARK_COLORS,
      darkVariables: DEFAULT_DARK_VARIABLES,
    },
  }
}

export const mutations = {
  setSettings (state, payload) {
    state.settings = {
      defaultTheme: payload.defaultTheme || 'dark',
      lightColors: payload.lightColors || DEFAULT_LIGHT_COLORS,
      lightVariables: payload.lightVariables || DEFAULT_LIGHT_VARIABLES,
      darkColors: payload.darkColors || DEFAULT_DARK_COLORS,
      darkVariables: payload.darkVariables || DEFAULT_DARK_VARIABLES,
    }
  },
}

export const actions = {
  async fetchSettings ({ commit }) {
    // Try cache first, but check if it's stale
    const cached = getCachedAppearanceSettings()
    if (cached) {
      const stale = await isAppearanceCacheStale()
      if (!stale) {
        // Cache is still valid, use it
        commit('setSettings', cached)
        return { settings: cached }
      }
      // Cache is stale, will fetch fresh data below
    }

    // Fetch from API if no cache or cache is stale
    try {
      const response = await $axios.get('/appearance')
      const settings = response.data?.payload.settings || {}
      commit('setSettings', settings)
      // Cache the settings with server timestamp
      await cacheAppearanceSettings(settings, settings.updatedAt)
      return response.data?.payload
    } catch (error) {
      console.error('Error fetching appearance settings:', error)
      // If we have cached data, use it even if stale (fail gracefully)
      if (cached) {
        commit('setSettings', cached)
        return { settings: cached }
      }
      // Return default if API fails and no cache
      const defaultSettings = {
        defaultTheme: 'dark',
        lightColors: DEFAULT_LIGHT_COLORS,
        lightVariables: DEFAULT_LIGHT_VARIABLES,
        darkColors: DEFAULT_DARK_COLORS,
        darkVariables: DEFAULT_DARK_VARIABLES,
      }
      commit('setSettings', defaultSettings)
      return { settings: defaultSettings }
    }
  },

  async updateSettings ({ dispatch }, payload) {
    await $axios.put('/admin/appearance', payload)
    // Invalidate cache when admin updates
    invalidateCache()
    await dispatch('fetchSettings')
  },
}
