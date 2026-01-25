import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  events: [],
  event: {},
  extras: [],
  pagination: {
    totalItems: 0,
    page: 1,
    itemsPerPage: 6,
    totalPages: 0,
  },
}

export const mutations = {
  setEvents (state, payload) {
    state.events = payload
  },
  setPagination (state, payload) {
    state.pagination = payload
  },
  setEvent (state, payload) {
    state.event = payload
  },
  saveEvent (state, payload) {
    const foundIndex = state.events.findIndex(item => item.id == payload.id)
    if (foundIndex === -1) {
      state.events.unshift(payload)
    } else {
      state.events[foundIndex] = payload
    }
  },
  saveExtras (state, payload) {
    const foundIndex = state.extras.findIndex(item => item.id == payload.id)
    if (foundIndex === -1) {
      state.extras.unshift(payload)
    } else {
      state.extras[foundIndex] = payload
    }
  },
  removeEvent (state, payload) {
    const foundIndex = state.events.findIndex(item => item.id == payload.eventId)
    if (foundIndex !== -1) {
      state.events.splice(foundIndex, 1)
    }
  },
  removeExtras (state, payload) {
    const foundIndex = state.extras.findIndex(item => item.id == payload.extrasId)
    if (foundIndex !== -1) {
      state.extras.splice(foundIndex, 1)
    }
  },
  setExtras (state, payload) {
    state.extras = payload
  },
  clearEvent (state) {
    state.event = {}
  },
  clearEvents (state) {
    state.events = []
  },
}

export const actions = {
  setEvents ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getAllEvents', {
          params: {
            organizationId: request.organizationId,
            page: request.page || 1,
            itemsPerPage: request.itemsPerPage || 6,
            fetchTotalCount: request.fetchTotalCount || true,
          },
        })
        .then(response => {
          commit('setEvents', response.data?.payload?.items || [])
          commit('setPagination', {
            totalItems: response.data?.payload?.totalItems || 0,
            page: response.data?.payload?.page || 1,
            itemsPerPage: response.data?.payload?.itemsPerPage || 6,
            totalPages: response.data?.payload?.totalPages || 0,
          })
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setPublishedEvents ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getPublishedEvents', { params: { organizationId: request } })
        .then(response => {
          commit('setEvents', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  searchPublishedEvents ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/searchPublishedEvents', {
          params: {
            searchTerm: request.searchTerm,
            page: request.page || 1,
            itemsPerPage: request.itemsPerPage || 12,
          },
        })
        .then(response => {
          commit('setEvents', response.data?.payload?.items || [])
          commit('setPagination', {
            totalItems: response.data?.payload?.totalItems || 0,
            page: response.data?.payload?.page || 1,
            itemsPerPage: response.data?.payload?.itemsPerPage || 12,
            totalPages: response.data?.payload?.totalPages || 0,
          })
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setActiveEvents ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getAllActiveEvents', {
          params: {
            organizationId: request.organizationId,
            currentDate: request.currentDate,
          },
        })
        .then(response => {
          commit('setEvents', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setEvent ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getEvent', {
          params: { eventId: request.eventId },
        })
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setEventBySlug ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getEventBySlug', {
          params: { slug: request.slug },
        })
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  getFirstEvent ({ commit }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getFirstEvent')
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setEventByEventIdnOrganizationId ({ commit }, { eventId, organizationId }) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getEventByEventIdnOrganizationId', {
          params: { eventId, organizationId },
        })
        .then(response => {
          commit('setEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setAssignedEvents ({ commit }, { role } = {}) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/staff/getAssignedEvents', {
          params: { role },
        })
        .then(response => {
          commit('setEvents', response.data?.payload || [])
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
        .post('/event/save', request)
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveConfig ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/saveConfig', request)
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveLandingConfig ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/saveLandingConfig', request)
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeEvent ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/removeEvent', {
          params: request,
        })
        .then(response => {
          commit('removeEvent', request)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/removeExtras', {
          params: { extrasId: request.extrasId, eventId: request.eventId },
        })
        .then(response => {
          commit('removeExtras', request)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/saveExtras', request)
        .then(response => {
          commit('saveExtras', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setExtras ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/event/getExtras', { params: { eventId: request } })
        .then(response => {
          commit('setExtras', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  publishEvent ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/publishEvent', { eventId: request.eventId })
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  unpublishEvent ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/event/unpublishEvent', { eventId: request.eventId })
        .then(response => {
          commit('saveEvent', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getEventById: state => id => {
    return state.events.find(item => item.id == id)
  },
  isEventFree: () => {},
}
