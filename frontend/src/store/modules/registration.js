import fileSaver from 'file-saver'
import $axios from '@/plugins/axios'
import { deepMerge } from '@/utils'

export const namespaced = true

export const state = {
  registration: {},
  attendees: [],
}

export const mutations = {
  setRegistration (state, payload) {
    state.registration = payload
  },
  resetRegistration (state) {
    state.registration = {}
  },
  setAttendees (state, payload) {
    state.attendees = payload
  },
  updateAttendee (state, payload) {
    // Find attendee by registrationId (for backward compatibility) or attendeeId
    let foundIndex = state.attendees.findIndex(
      item => item.registrationId == payload.registrationId,
    )

    // If not found by registrationId, try to find by attendeeId
    if (foundIndex === -1 && payload.attendeeId) {
      foundIndex = state.attendees.findIndex(item => item.attendeeId == payload.attendeeId)
    }

    if (foundIndex !== -1) {
      deepMerge(state.attendees[foundIndex], payload)
    }
  },
  removeRegistration (state, payload) {
    // Remove all attendees that belong to the deleted registration
    const filteredAttendees = state.attendees.filter(item => item.registrationId != payload)
    state.attendees = filteredAttendees
  },
  removeAttendee (state, attendeeId) {
    const foundIndex = state.attendees.findIndex(item => item.attendeeId == attendeeId)
    if (foundIndex !== -1) {
      state.attendees.splice(foundIndex, 1)
    }
  },
}

export const actions = {
  bulkImportAttendee ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/registration/bulkImportAttendee', request)
        .then(response => {
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  initRegistration ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/registration/initRegistration', request)
        .then(response => {
          commit('setRegistration', response.data?.payload)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveRegistration ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/registration/save', request)
        .then(response => {
          commit('setRegistration', response.data?.payload)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setRegistration ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/registration/getRegistration', {
          params: {
            registrationId: request.registrationId,
            qrUuid: request.qrUuid,
          },
        })
        .then(response => {
          commit('setRegistration', response.data?.payload)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  getRegistrationById ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/registration/getRegistrationById', {
          params: {
            registrationId: request.registrationId,
          },
        })
        .then(response => {
          commit('setRegistration', response.data?.payload)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  getRegistrationByEmail ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/registration/getRegistrationByEmail', {
          params: {
            email: request.email,
            eventId: request.eventId,
          },
        })
        .then(response => {
          commit('setRegistration', response.data?.payload)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setAttendees ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/registration/getAttendees', {
          params: {
            page: request.page,
            itemsPerPage: request.itemsPerPage,
            fetchTotalCount: request.fetchTotalCount,
            event: request.event,
            searchKeyword: request.searchKeyword,
            sortBy: request?.sortBy,
          },
        })
        .then(response => {
          commit('setAttendees', response.data?.payload?.items)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  downloadAttendees ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/registration/downloadAttendees', {
          params: {
            eventId: request.eventId,
          },
          responseType: 'blob',
        })
        .then(response => {
          const filename = `Attendee-report-event-${
            request.eventId
          }-${new Date().toISOString().slice(0, 19)}.xlsx`

          const blob = new Blob([response.data], { type: response.data.type })
          fileSaver.saveAs(blob, filename)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  sendTicketByAttendeeId ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/registration/sendTicketByAttendeeId', {
          params: {
            attendeeId: request.attendeeId,
            eventId: request.eventId,
          },
        })
        .then(response => {
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeRegistration ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/registration/removeRegistration', {
          params: {
            registrationId: request.registrationId,
            eventId: request.eventId,
          },
        })
        .then(response => {
          commit('removeRegistration', request.registrationId)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  deleteAttendee ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get(`/registration/deleteAttendee`, {
          params: {
            attendeeId: request.attendeeId,
            eventId: request.eventId,
          },
        })
        .then(response => {
          // Update the store based on what was deleted
          if (response.data?.payload?.deletedRegistration) {
            // If entire registration was deleted, remove it
            commit('removeRegistration', request.registrationId)
          } else {
            // If just attendee was deleted, remove the specific attendee
            commit('removeAttendee', request.attendeeId)
          }
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  updateStatus ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/registration/updateStatus', request)
        .then(response => {
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  scanByExtrasPurchaseId ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/registration/scanByExtrasPurchaseId', { payload: request })
        .then(response => {
          // commit("setRegistration", response.data?.payload);
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {}
