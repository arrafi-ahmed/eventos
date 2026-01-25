import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  sponsorships: [],
  currentSponsorship: null,
}

export const mutations = {
  setSponsorships (state, payload) {
    state.sponsorships = payload
  },
  setCurrentSponsorship (state, payload) {
    state.currentSponsorship = payload
  },
  addSponsorship (state, payload) {
    state.sponsorships.unshift(payload)
  },
  updateSponsorship (state, payload) {
    const index = state.sponsorships.findIndex(sponsorship => sponsorship.id === payload.id)
    if (index !== -1) {
      state.sponsorships[index] = payload
    }
  },
}

export const actions = {
  setSponsorships ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/sponsorship/getSponsorshipsByEventId', { params: { eventId: request } })
        .then(response => {
          commit('setSponsorships', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setSponsorshipsByRegistration ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/sponsorship/getSponsorshipsByRegistrationId', {
          params: { registrationId: request },
        })
        .then(response => {
          commit('setSponsorships', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setCurrentSponsorship ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/sponsorship/getSponsorshipById', { params: { sponsorshipId: request } })
        .then(response => {
          commit('setCurrentSponsorship', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  createSponsorship ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/sponsorship/create', request)
        .then(response => {
          commit('addSponsorship', response.data?.payload?.sponsorship)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  createSponsorshipPaymentIntent ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/sponsorship/createSponsorshipPaymentIntent', request)
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
  getSponsorshipById: state => id => {
    return state.sponsorships.find(sponsorship => sponsorship.id == id)
  },
  getSponsorshipsByEventId: state => eventId => {
    return state.sponsorships.filter(sponsorship => sponsorship.eventId == eventId)
  },
  getSponsorshipsByStatus: state => status => {
    return state.sponsorships.filter(sponsorship => sponsorship.paymentStatus == status)
  },
  getTotalSponsorshipAmount: state => eventId => {
    return state.sponsorships
      .filter(
        sponsorship => sponsorship.eventId == eventId && sponsorship.paymentStatus == 'paid',
      )
      .reduce((total, sponsorship) => total + sponsorship.amount, 0)
  },
}
