import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  ticketCounters: [],
  ticketCounter: {},
}

export const mutations = {
  setTicketCounters (state, payload) {
    state.ticketCounters = payload
  },
  setTicketCounter (state, payload) {
    state.ticketCounter = payload
  },
  saveTicketCounter (state, payload) {
    const foundIndex = state.ticketCounters.findIndex(item => item.id == payload.id)
    if (foundIndex === -1) {
      state.ticketCounters.unshift(payload)
    } else {
      state.ticketCounters[foundIndex] = payload
    }
  },
  removeTicketCounter (state, payload) {
    const foundIndex = state.ticketCounters.findIndex(item => item.id == payload.id)
    if (foundIndex !== -1) {
      state.ticketCounters.splice(foundIndex, 1)
    }
  },
}

export const actions = {
  setTicketCounters ({ commit }, { organizationId } = {}) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/ticket-counter/getTicketCounters', {
          params: { organizationId },
        })
        .then(response => {
          commit('setTicketCounters', response.data?.payload || [])
          resolve(response.data?.payload || [])
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  save ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/ticket-counter/save', request)
        .then(response => {
          commit('saveTicketCounter', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  deleteTicketCounter ({ commit }, { id }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/ticket-counter/delete', {
          params: { id },
        })
        .then(response => {
          commit('removeTicketCounter', { id })
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getTicketCounterById: state => id => {
    return state.ticketCounters.find(item => item.id == id)
  },
}
