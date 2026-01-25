import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  staff: [],
  loading: false,
}

export const mutations = {
  setStaff (state, payload) {
    state.staff = payload
  },
  setLoading (state, payload) {
    state.loading = payload
  },
  addStaff (state, payload) {
    state.staff.push(payload)
  },
  removeStaff (state, userId) {
    state.staff = state.staff.filter(s => s.userId !== userId)
  },
}

export const actions = {
  fetchStaff ({ commit }, { eventId }) {
    commit('setLoading', true)
    return new Promise((resolve, reject) => {
      $axios
        .get('/staff/getStaff', { params: { eventId } })
        .then(response => {
          commit('setStaff', response.data?.payload || [])
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
        .finally(() => {
          commit('setLoading', false)
        })
    })
  },
  createAndAssignStaff ({ commit }, payload) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/staff/create-and-assign', payload)
        .then(response => {
          // Re-fetch staff to ensure list is up to date
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  updateStaff ({ commit }, payload) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/staff/update', payload)
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  assignStaff ({ commit }, payload) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/staff/assign', payload)
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeStaff ({ commit }, payload) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/staff/remove', payload)
        .then(response => {
          commit('removeStaff', payload.userId)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}
