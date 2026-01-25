import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  tickets: [],
  selectedTickets: [], // Tickets selected by user for checkout
  currentTicket: null,
}

export const mutations = {
  setTickets (state, payload) {
    state.tickets = payload
  },
  setCurrentTicket (state, payload) {
    state.currentTicket = payload
  },
  addTicket (state, payload) {
    state.tickets.push(payload)
  },
  updateTicket (state, payload) {
    const index = state.tickets.findIndex(ticket => ticket.id === payload.id)
    if (index !== -1) {
      state.tickets[index] = payload
    }
  },
  removeTicket (state, payload) {
    const index = state.tickets.findIndex(ticket => ticket.id === payload)
    if (index !== -1) {
      state.tickets.splice(index, 1)
    }
  },
  SET_SELECTED_TICKETS (state, tickets) {
    state.selectedTickets = tickets
  },
  SET_SELECTED_TICKET (state, ticket) {
    const index = state.selectedTickets.findIndex(t => t.ticketId === ticket.ticketId)
    if (index === -1) {
      state.selectedTickets.push(ticket)
    } else {
      state.selectedTickets.splice(index, 1, ticket)
    }
  },
  REMOVE_SELECTED_TICKET (state, ticketId) {
    state.selectedTickets = state.selectedTickets.filter(t => t.ticketId !== ticketId)
  },
}

export const actions = {
  setTickets ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/ticket/getTicketsByEventId', { params: { eventId: request } })
        .then(response => {
          commit('setTickets', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setCurrentTicket ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/ticket/getTicketById', { params: { ticketId: request } })
        .then(response => {
          commit('setCurrentTicket', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  saveTicket ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .post('/ticket/save', request)
        .then(response => {
          const savedTicket = response.data?.payload

          if (request.id) {
            // Update existing ticket
            commit('updateTicket', savedTicket)
          } else {
            // Add new ticket
            commit('addTicket', savedTicket)
          }
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  removeTicket ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .delete('/ticket/removeTicket', { data: request })
        .then(response => {
          commit('removeTicket', request.ticketId)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getTicketById: state => id => {
    return state.tickets.find(ticket => ticket.id == id)
  },
  getTicketsByEventId: state => eventId => {
    return state.tickets.filter(ticket => ticket.eventId == eventId)
  },
}
