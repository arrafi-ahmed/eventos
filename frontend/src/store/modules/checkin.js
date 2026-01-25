import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  statistics: {
    historicalRegistrationCount: 0,
    historicalCheckinCount: 0,
    totalRegistrationCount: 0,
    totalCheckinCount: 0,
  },
}

export const mutations = {
  setStatistics (state, payload) {
    Object.assign(state.statistics, payload)
  },
}

export const actions = {
  scanByRegistrationId ({ commit }, request) {
    const { suppressToast, ...payload } = request
    return new Promise((resolve, reject) => {
      $axios
        .post('/checkin/scanByRegistrationId', { payload }, { suppressToast })
        .then(response => {
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  save ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/checkin/save', request)
        .then(response => {
          commit(
            'registration/updateAttendee',
            {
              checkinId: response.data.payload?.id,
              checkinTime: response.data.payload?.createdAt,
              registrationId: response.data.payload?.registrationId,
            },
            { root: true },
          )
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  delete ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .delete('/checkin/delete', { data: request })
        .then(response => {
          // Update the attendee's checkin status in the registration store
          commit(
            'registration/updateAttendee',
            {
              checkinId: null,
              checkinTime: null,
              attendeeId: request.attendeeId,
            },
            { root: true },
          )
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setStatistics ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/checkin/getStatistics', {
          params: { eventId: request.eventId, date: request.date },
        })
        .then(response => {
          commit('setStatistics', response.data?.payload)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {}
