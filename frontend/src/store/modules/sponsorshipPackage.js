import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  packages: [],
  currentPackage: null,
}

export const mutations = {
  setPackages (state, payload) {
    state.packages = payload
  },
  setCurrentPackage (state, payload) {
    state.currentPackage = payload
  },
  addPackage (state, payload) {
    state.packages.unshift(payload)
  },
  updatePackage (state, payload) {
    const index = state.packages.findIndex(pkg => pkg.id === payload.id)
    if (index !== -1) {
      state.packages[index] = payload
    }
  },
  removePackage (state, payload) {
    const index = state.packages.findIndex(pkg => pkg.id === payload)
    if (index !== -1) {
      state.packages.splice(index, 1)
    }
  },
}

export const actions = {
  setPackages ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/sponsorship-package/getPackagesByEventId', { params: { eventId: request } })
        .then(response => {
          commit('setPackages', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setCurrentPackage ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/sponsorship-package/getPackageById', { params: { packageId: request } })
        .then(response => {
          commit('setCurrentPackage', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  savePackage ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/sponsorship-package/save', request)
        .then(response => {
          if (request.id) {
            commit('updatePackage', response.data?.payload)
          } else {
            commit('addPackage', response.data?.payload)
          }
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  deletePackage ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .delete('/sponsorship-package/deletePackage', { data: request })
        .then(response => {
          commit('removePackage', request.packageId)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  updatePackageStatus ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/sponsorship-package/updateStatus', request)
        .then(response => {
          commit('updatePackage', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getPackageById: state => id => {
    return state.packages.find(pkg => pkg.id == id)
  },
  getActivePackages: state => {
    return state.packages.filter(pkg => pkg.isActive)
  },
  getPackagesByEventId: state => eventId => {
    return state.packages.filter(pkg => pkg.eventId == eventId)
  },
}
