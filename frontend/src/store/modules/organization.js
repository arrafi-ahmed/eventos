import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  organizations: [],
  organization: {},
}

export const mutations = {
  setOrganizations (state, payload) {
    state.organizations = payload
  },
  setOrganization (state, payload) {
    state.organization = payload
  },
  saveOrganization (state, payload) {
    const foundIndex = state.organizations.findIndex(item => item.id == payload.id)
    if (foundIndex === -1) {
      state.organizations.unshift(payload)
    } else {
      state.organizations[foundIndex] = payload
    }
  },
  removeOrganization (state, payload) {
    const foundIndex = state.organizations.findIndex(item => item.id == payload.organizationId)
    if (foundIndex !== -1) {
      state.organizations.splice(foundIndex, 1)
    }
  },
}

export const actions = {
  setOrganizations ({ commit }, { page = 1, itemsPerPage = 10 } = {}) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/organization/getAllOrganizations', {
          params: { page, itemsPerPage },
        })
        .then(response => {
          const payload = response.data?.payload
          commit('setOrganizations', payload?.organizations || payload || [])
          resolve({
            organizations: payload?.organizations || payload || [],
            total: payload?.total || (Array.isArray(payload) ? payload.length : 0),
          })
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setOrganization ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/organization/getOrganization', { params: { organizationId: request } })
        .then(response => {
          commit('setOrganization', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  save ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/organization/save', request)
        .then(response => {
          commit('saveOrganization', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeOrganization ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/organization/removeOrganization', {
          params: { organizationId: request.organizationId },
        })
        .then(response => {
          commit('removeOrganization', request)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getOrganizationById: state => id => {
    return state.organizations.find(item => item.id == id)
  },
}
