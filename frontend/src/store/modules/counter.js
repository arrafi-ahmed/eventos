import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  activeSession: null,
  sessions: [],
}

export const mutations = {
  setActiveSession (state, payload) {
    state.activeSession = payload
  },
  setSessions (state, payload) {
    state.sessions = payload
  },
}

export const actions = {
  startSession ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/counter/startSession', request)
        .then(response => {
          commit('setActiveSession', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  closeSession ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/counter/closeSession', request)
        .then(response => {
          commit('setActiveSession', null)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setActiveSession ({ commit }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/counter/activeSession')
        .then(response => {
          commit('setActiveSession', response.data?.payload)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  fetchSessionStats ({ commit }, sessionId) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/counter/sessionStats', { params: { sessionId } })
        .then(response => {
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  processSale ({ commit, state }, payload) {
    return new Promise((resolve, reject) => {
      // Automatically add active session and counter IDs if available
      const requestPayload = {
        ...payload,
        cashSessionId: state.activeSession?.id,
        ticketCounterId: state.activeSession?.ticketCounterId,
      }

      $axios
        .post('/counter/processSale', requestPayload)
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
  hasActiveSession: state => !!state.activeSession,
}
