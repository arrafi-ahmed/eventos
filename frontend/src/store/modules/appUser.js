import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  admins: [],
  users: [],
}

export const mutations = {
  setAdmins (state, payload) {
    state.admins = payload
  },
  setUsers (state, payload) {
    state.users = payload
  },
  addAdmin (state, payload) {
    state.admins.unshift(payload)
    state.users.unshift(payload)
  },
  editAdmin (state, payload) {
    const foundIndex = state.admins.findIndex(item => item.id == payload.id)
    if (foundIndex !== -1) {
      state.admins[foundIndex] = payload
    }
    const userIndex = state.users.findIndex(item => item.id == payload.id)
    if (userIndex !== -1) {
      state.users[userIndex] = payload
    }
  },
  deleteAppUser (state, payload) {
    const foundIndex = state.admins.findIndex(item => item.id == payload)
    if (foundIndex !== -1) {
      state.admins.splice(foundIndex, 1)
    }
    const userIndex = state.users.findIndex(item => item.id == payload)
    if (userIndex !== -1) {
      state.users.splice(userIndex, 1)
    }
  },
}

export const actions = {
  saveAppUser ({ commit }, request) {
    const { type, ...rest } = request
    const commitName = request.id ? 'editAdmin' : 'addAdmin' // Using Admin mutation for all users
    return new Promise((resolve, reject) => {
      $axios
        .post('/appUser/save', rest)
        .then(response => {
          const { password, ...userData } = response.data?.payload
          commit(commitName, {
            ...userData,
            password: request.password,
          })
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setAdmins ({ commit }, { organizationId }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/appUser/getAppUsers', { params: { organizationId } })
        .then(response => {
          commit('setAdmins', response.data?.payload?.appUsers || [])
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  deleteAppUser ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/appUser/deleteAppUser', {
          params: { id: request },
        })
        .then(response => {
          commit('deleteAppUser', request)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  fetchUsers ({ commit }, { organizationId }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/appUser/getUsers', { params: { organizationId } })
        .then(response => {
          commit('setUsers', response.data?.payload || [])
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeUser ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/appUser/removeUser', {
          params: { userId: request.userId },
        })
        .then(response => {
          commit('deleteAppUser', request.userId)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {}
