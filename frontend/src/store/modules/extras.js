import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  extras: [],
  currentExtras: null,
}

export const mutations = {
  setExtras (state, payload) {
    state.extras = payload
  },
  setCurrentExtras (state, payload) {
    state.currentExtras = payload
  },
  addExtras (state, payload) {
    state.extras.unshift(payload)
  },
  updateExtras (state, payload) {
    const index = state.extras.findIndex(extras => extras.id === payload.id)
    if (index !== -1) {
      state.extras[index] = payload
    }
  },
  removeExtras (state, payload) {
    const index = state.extras.findIndex(extras => extras.id === payload)
    if (index !== -1) {
      state.extras.splice(index, 1)
    }
  },
}

export const actions = {
  setExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/extras/getExtrasByEventId', { params: { eventId: request } })
        .then(response => {
          commit('setExtras', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setCurrentExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/extras/getExtrasByIds', { params: { extrasIds: JSON.stringify([request]) } })
        .then(response => {
          commit('setCurrentExtras', response.data?.payload[0])
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  purchaseExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/extras/purchaseExtras', request)
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getExtrasById: state => id => {
    return state.extras.find(extras => extras.id == id)
  },
  getExtrasByEventId: state => eventId => {
    return state.extras.filter(extras => extras.eventId == eventId)
  },
  getTotalExtrasPrice: state => extrasIds => {
    return state.extras
      .filter(extras => extrasIds.includes(extras.id))
      .reduce((total, extras) => total + extras.price, 0)
  },
}
