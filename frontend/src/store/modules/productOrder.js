import $axios from '@/plugins/axios'

/**
 * Product Order Store Module
 * Manages state for product orders and order management
 */

export const namespaced = true

export const state = {
  productOrders: [],
  currentOrder: null,
  pagination: {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  },
  loading: false,
  error: null,
}

export const mutations = {
  SET_PRODUCT_ORDERS (state, payload) {
    state.productOrders = payload
  },
  SET_CURRENT_ORDER (state, order) {
    state.currentOrder = order
  },
  SET_LOADING (state, loading) {
    state.loading = loading
  },
  SET_ERROR (state, error) {
    state.error = error
  },
  UPDATE_ORDER_STATUS (state, { orderId, productStatus }) {
    const order = state.productOrders.find(o => o.orderId === orderId)
    if (order) {
      order.productStatus = productStatus
    }
    if (state.currentOrder && state.currentOrder.order.id === orderId) {
      state.currentOrder.order.productStatus = productStatus
    }
  },
}

export const actions = {
  fetchProductOrders ({ commit }, request) {
    return new Promise((resolve, reject) => {
      $axios
        .get('/product-order/getEventProductOrders', {
          params: {
            eventId: request.eventId,
            page: request.page,
            limit: request.itemsPerPage,
            searchKeyword: request.searchKeyword,
            fetchTotalCount: request.fetchTotalCount,
          },
        })
        .then(response => {
          commit('SET_PRODUCT_ORDERS', response.data?.payload?.orders)
          resolve(response.data?.payload)
        })
        .catch(error => {
          reject(error)
        })
    })
  },

  async fetchProductOrderDetails ({ commit }, { orderId }) {
    try {
      commit('SET_LOADING', true)
      commit('SET_ERROR', null)

      const response = await $axios.get(`/product-order/getProductOrderDetails/${orderId}`)

      commit('SET_CURRENT_ORDER', response.data.payload)
      return response.data.payload
    } catch (error) {
      commit('SET_ERROR', error.response?.data?.message || 'Failed to fetch order details')
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },

  async updateProductOrderStatus ({ commit }, { orderId, productStatus }) {
    try {
      commit('SET_LOADING', true)
      commit('SET_ERROR', null)

      const response = await $axios.put('/product-order/updateProductOrderStatus', {
        orderId,
        productStatus,
      })

      commit('UPDATE_ORDER_STATUS', { orderId, productStatus })
      return response.data.payload
    } catch (error) {
      commit('SET_ERROR', error.response?.data?.message || 'Failed to update order status')
      throw error
    } finally {
      commit('SET_LOADING', false)
    }
  },
}

export const getters = {
  productOrders: state => state.productOrders,
  currentOrder: state => state.currentOrder,
  pagination: state => state.pagination,
  loading: state => state.loading,
  error: state => state.error,
}
