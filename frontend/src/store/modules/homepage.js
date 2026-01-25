import $axios from '@/plugins/axios'
import {
  cacheHomepageBanners,
  getCachedHomepageBanners,
  invalidateCache,
  isHomepageBannersCacheStale,
} from '@/utils/layoutCache'

export const namespaced = true

export function state () {
  return {
    banners: [],
    activeBanners: [],
  }
}

export const mutations = {
  setBanners (state, payload) {
    state.banners = Array.isArray(payload) ? payload : []
  },
  setActiveBanners (state, payload) {
    state.activeBanners = Array.isArray(payload) ? payload : []
  },
}

export const actions = {
  async fetchBanners ({ commit }) {
    const response = await $axios.get('/admin/homepage/banners')
    commit('setBanners', response.data?.payload.banners || [])
    return response.data?.payload
  },

  async fetchActiveBanners ({ commit }) {
    // Try cache first, but check if it's stale
    const cached = getCachedHomepageBanners()
    if (cached) {
      const stale = await isHomepageBannersCacheStale()
      if (!stale) {
        // Cache is still valid, use it
        commit('setActiveBanners', cached)
        return { banners: cached }
      }
      // Cache is stale, will fetch fresh data below
    }

    // Fetch from API if no cache or cache is stale
    try {
      const response = await $axios.get('/homepage/banners/active')
      const banners = response.data?.payload.banners || []
      commit('setActiveBanners', banners)
      // Cache the banners (homepage banners don't have a single updatedAt, so we'll use current time)
      // The server timestamp check will use MAX(updated_at) from all banners
      await cacheHomepageBanners(banners)
      return response.data?.payload
    } catch (error) {
      console.error('Error fetching active banners:', error)
      // If we have cached data, use it even if stale (fail gracefully)
      if (cached) {
        commit('setActiveBanners', cached)
        return { banners: cached }
      }
      commit('setActiveBanners', [])
      return { banners: [] }
    }
  },

  async createBanner ({ dispatch }, formData) {
    await $axios.post('/admin/homepage/banners', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    // Invalidate cache when admin updates
    invalidateCache()
    return dispatch('fetchBanners')
  },

  async updateBanner ({ dispatch }, { id, formData }) {
    await $axios.put(`/admin/homepage/banners/${id}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    // Invalidate cache when admin updates
    invalidateCache()
    return dispatch('fetchBanners')
  },

  async deleteBanner ({ dispatch }, id) {
    await $axios.delete(`/admin/homepage/banners/${id}`)
    // Invalidate cache when admin updates
    invalidateCache()
    return dispatch('fetchBanners')
  },

  async updateDisplayOrder ({ dispatch }, bannerOrders) {
    await $axios.post('/admin/homepage/banners/reorder', { bannerOrders })
    return dispatch('fetchBanners')
  },
}
