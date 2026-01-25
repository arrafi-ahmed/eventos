import $axios from '@/plugins/axios'
import {
  cacheAllLayoutData,
  getCachedAllLayoutData,
  invalidateCache,
  isAllLayoutCacheStale,
} from '@/utils/layoutCache'

export const namespaced = true

export function state() {
  return {
    footer: null,
    header: null,
    appearance: null,
    organizerDashboardBanner: null,
    homepageBanners: [],
    loading: false,
  }
}

export const mutations = {
  setAllLayoutData(state, payload) {
    state.footer = payload.footer || null
    state.header = payload.header || null
    state.appearance = payload.appearance || null
    state.organizerDashboardBanner = payload.organizerDashboardBanner || null
    state.homepageBanners = payload.homepageBanners || []
  },
  setLoading(state, loading) {
    state.loading = loading
  },
}

export const actions = {
  async fetchAllLayoutData({ commit, state }) {
    commit('setLoading', true)

    try {
      // Try cache first, but check if it's stale
      const cached = getCachedAllLayoutData()
      if (cached) {
        const stale = await isAllLayoutCacheStale()
        if (!stale) {
          // Cache is still valid, use it
          commit('setAllLayoutData', cached)
          commit('setLoading', false)
          return cached
        }
        // Cache is stale, will fetch fresh data below
      }

      // Fetch from API if no cache or cache is stale
      const response = await $axios.get('/layout')
      const layoutData = response.data?.payload || {}

      // Cache the data with server timestamps
      await cacheAllLayoutData(layoutData, layoutData.timestamps)

      commit('setAllLayoutData', layoutData)
      commit('setLoading', false)
      return layoutData
    } catch (error) {
      console.error('Error fetching all layout data:', error)

      // If we have cached data, use it even if stale (fail gracefully)
      const cached = getCachedAllLayoutData()
      if (cached) {
        commit('setAllLayoutData', cached)
        commit('setLoading', false)
        return cached
      }

      // Return defaults if API fails and no cache
      const defaultLayoutData = {
        footer: {
          style: 'expanded',
          companyName: null,
          companyAddress: null,
          companyEmail: null,
          companyPhone: null,
          quickLinks: [],
          socialLinks: {},
          copyrightText: null,
        },
        header: {
          logoImage: null,
          logoImageDark: null,
          logoPosition: 'left',
          menuPosition: 'right',
          logoWidthLeft: 300,
        },
        appearance: {
          defaultTheme: 'dark',
          lightColors: {},
          darkColors: {},
          lightVariables: {},
          darkVariables: {},
        },
        organizerDashboardBanner: {
          isEnabled: false,
          icon: null,
          title: null,
          description: null,
          ctaButtonText: null,
          ctaButtonUrl: null,
        },
        homepageBanners: [],
      }

      commit('setAllLayoutData', defaultLayoutData)
      commit('setLoading', false)
      return defaultLayoutData
    }
  },

  // Invalidate cache when admin updates any layout setting
  invalidateCache({ dispatch }) {
    invalidateCache()
    // Optionally refetch immediately
    // dispatch('fetchAllLayoutData')
  },
}

export const getters = {
  footer: state => state.footer,
  header: state => state.header,
  appearance: state => state.appearance,
  organizerDashboardBanner: state => state.organizerDashboardBanner,
  homepageBanners: state => state.homepageBanners,
  isLoading: state => state.loading,
}
