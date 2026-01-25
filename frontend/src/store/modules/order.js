import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
  orders: [],
  currentOrder: null,
}

export const mutations = {
  setOrders (state, payload) {
    state.orders = payload
  },
  setCurrentOrder (state, payload) {
    state.currentOrder = payload
  },
  addOrder (state, payload) {
    state.orders.unshift(payload)
  },
  updateOrder (state, payload) {
    const index = state.orders.findIndex(order => order.id === payload.id)
    if (index !== -1) {
      state.orders[index] = payload
    }
  },
}

export const actions = {
  setOrders ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/order/getOrdersByEventId', { params: { eventId: request } })
        .then(response => {
          commit('setOrders', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  setCurrentOrder ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/order/getOrderById', { params: { orderId: request } })
        .then(response => {
          commit('setCurrentOrder', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
  getOrderWithItems ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/order/getOrderWithItems', { params: { orderId: request } })
        .then(response => {
          commit('setCurrentOrder', response.data?.payload)
          resolve(response)
        })
        .catch(error => {
          reject(error)
        })
    })
  },
}

export const getters = {
  getOrderById: state => id => {
    return state.orders.find(order => order.id == id)
  },
  getOrdersByEventId: state => eventId => {
    return state.orders.filter(order => order.eventId == eventId)
  },
  getOrdersByStatus: state => status => {
    return state.orders.filter(order => order.paymentStatus == status)
  },
}
