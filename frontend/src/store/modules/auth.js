import $axios from '@/plugins/axios'
import { ifAdmin, ifAttendee, ifCashier, ifOrganizer, ifStaff } from '@/utils'

export const namespaced = true

export const state = {
  token: localStorage.getItem('token') || null,
  currentUser: JSON.parse(localStorage.getItem('currentUser') || '{}'),
}

export const mutations = {
  setToken(state, payload) {
    localStorage.setItem('token', payload)
    state.token = payload
  },
  setCurrentUser(state, payload) {
    state.currentUser = { ...state.currentUser, ...payload }
    let currentUser = JSON.parse(localStorage.getItem('currentUser'))
    currentUser = { ...currentUser, ...payload }
    localStorage.setItem('currentUser', JSON.stringify(currentUser))
  },
  removeToken(state) {
    localStorage.removeItem('token')
    state.token = null
  },
  removeCurrentUser(state) {
    localStorage.removeItem('currentUser')
    state.currentUser = {}
  },
}

export const actions = {
  signin({ commit, dispatch }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/auth/signin', request)
        .then(response => {
          commit('setToken', response.headers?.authorization)
          commit('setCurrentUser', response.data?.payload?.currentUser)
          dispatch('preferences/syncThemeFromServer', null, { root: true }).catch(() => { })
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  signout({ commit, dispatch }) {
    return new Promise((resolve, reject) => {
      commit('removeToken')
      commit('removeCurrentUser')
      dispatch('preferences/resetTheme', null, { root: true })
      resolve()
    })
  },
  register({ commit, dispatch }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/auth/register', request)
        .then(response => {
          commit('setToken', response.headers?.authorization)
          commit('setCurrentUser', response.data?.payload?.currentUser)
          dispatch('preferences/syncThemeFromServer', null, { root: true }).catch(() => { })
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  refreshCurrentUser({ commit }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/auth/me')
        .then(response => {
          commit('setCurrentUser', response.data?.payload?.currentUser)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  requestResetPass({ commit }, { resetEmail }) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/auth/forgotPassword', { email: resetEmail })
        .then(response => {
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  resetPassword({ commit }, { token, password }) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/auth/resetPassword', { token, password })
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
  getToken(state) {
    return state.token
  },
  getCurrentUser(state) {
    return state.currentUser
  },
  isAdmin(state) {
    return ifAdmin({ role: state.currentUser.role })
  },
  isOrganizer(state) {
    return ifOrganizer({ role: state.currentUser.role })
  },
  isAttendee(state) {
    return ifAttendee({ role: state.currentUser.role })
  },
  isCashier(state) {
    return ifCashier({ role: state.currentUser.role })
  },
  isStaff(state) {
    return ifStaff({ role: state.currentUser.role })
  },
  isOrganizerVerified(state) {
    // Check if user is an organizer and their verification status is approved
    if (!ifOrganizer({ role: state.currentUser.role })) {
      return true // Non-organizers don't need verification
    }
    const verificationStatus = state.currentUser.verification_status || state.currentUser.verificationStatus
    return verificationStatus === 'approved'
  },
  signedin(state) {
    return !!state.token
  },
  calcHome(state, getters, rootState) {
    if (!getters.signedin) {
      return { name: 'signin' }
    }

    // Admin
    if (getters.isAdmin) {
      return { name: 'admin-dashboard' }
    }

    // Organizer
    if (getters.isOrganizer) {
      return { name: 'dashboard-organizer' }
    }

    // Cashier or Check-in Agent (Operational Staff)
    if (getters.isCashier || getters.isStaff) {
      return { name: 'staff-dashboard' }
    }

    // Attendee
    if (getters.isAttendee) {
      return { name: 'events-browse' }
    }

    // Fallback if role is recognized but no dashboard assigned, or unknown role
    return { name: 'homepage' }
  },
}
