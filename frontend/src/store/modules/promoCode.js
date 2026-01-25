import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  promoCodes: [],
}

export const mutations = {
  setPromoCodes (state, payload) {
    state.promoCodes = payload
  },
  addPromoCode (state, payload) {
    state.promoCodes.push(payload)
  },
  updatePromoCode (state, payload) {
    const index = state.promoCodes.findIndex(p => p.id === payload.id)
    if (index !== -1) {
      state.promoCodes[index] = payload
    }
  },
  removePromoCode (state, id) {
    state.promoCodes = state.promoCodes.filter(p => p.id !== id)
  },
}

export const actions = {
  fetchPromoCodes ({ commit }, { organizationId } = {}) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/promo-code/getPromoCodes', {
          params: { organizationId },
        })
        .then(response => {
          commit('setPromoCodes', response.data?.payload || [])
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  savePromoCode ({ commit }, payload) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/promo-code/save', payload)
        .then(response => {
          const savedCode = response.data?.payload
          if (payload.id) {
            commit('updatePromoCode', savedCode)
          } else {
            commit('addPromoCode', savedCode)
          }
          resolve(savedCode)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  deletePromoCode ({ commit }, id) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/promo-code/delete', { params: { id } })
        .then(response => {
          commit('removePromoCode', id)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getPromoCodesByEventId: state => eventId => {
    return state.promoCodes.filter(p => p.eventId == eventId)
  },
}
