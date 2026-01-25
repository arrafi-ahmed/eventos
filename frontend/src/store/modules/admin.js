import $axios from '@/plugins/axios'

export const namespaced = true

export function state () {
  return {
    organizers: null,
  }
}

export const mutations = {
  setOrganizers (state, payload) {
    state.organizers = Array.isArray(payload) ? payload : []
  },
}

export const actions = {
  async setOrganizers ({ commit }, request) {
    const response = await $axios.get('/admin/organizers', {
      params: {
        fetchTotalCount: request.fetchTotalCount,
        offset: (request.page - 1) * request.itemsPerPage,
        limit: request.itemsPerPage,
        status: request.status,
      },
    })
    commit('setOrganizers', response.data?.payload.items)
    return response.data?.payload
  },
}
