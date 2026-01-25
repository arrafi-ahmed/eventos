import $axios from '@/plugins/axios'

/**
 * Product Store Module
 * Manages state for products and event-product relationships
 */

export const namespaced = true

export const state = {
  products: [], // All organizer products
  eventProducts: [], // Products linked to specific event
  selectedProducts: [], // Products selected by user for checkout
  currentProduct: null,
}

export const getters = {
  getProducts: state => state.products,
  getEventProducts: state => state.eventProducts,
  getCurrentProduct: state => state.currentProduct,
}

export const mutations = {
  SET_PRODUCTS (state, products) {
    state.products = products
  },
  SET_EVENT_PRODUCTS (state, products) {
    state.eventProducts = products
  },
  SET_CURRENT_PRODUCT (state, product) {
    state.currentProduct = product
  },
  ADD_PRODUCT (state, product) {
    state.products.unshift(product)
  },
  UPDATE_PRODUCT (state, updatedProduct) {
    // Update in products array (catalog)
    const productIndex = state.products.findIndex(p => p.id === updatedProduct.id)
    if (productIndex !== -1) {
      state.products.splice(productIndex, 1, updatedProduct)
    }

    // Update in eventProducts array (assigned products)
    const eventProductIndex = state.eventProducts.findIndex(p => p.id === updatedProduct.id)
    if (eventProductIndex !== -1) {
      state.eventProducts.splice(eventProductIndex, 1, updatedProduct)
    }
  },
  REMOVE_PRODUCT (state, productId) {
    state.products = state.products.filter(p => p.id !== productId)
  },
  ADD_PRODUCT_TO_EVENT (state, product) {
    state.eventProducts.push(product)
  },
  REMOVE_PRODUCT_FROM_EVENT (state, productId) {
    state.eventProducts = state.eventProducts.filter(p => p.id !== productId)
  },
  UPDATE_EVENT_PRODUCT (state, updatedProduct) {
    const index = state.eventProducts.findIndex(p => p.id === updatedProduct.id)
    if (index !== -1) {
      state.eventProducts.splice(index, 1, updatedProduct)
    }
  },
  SET_SELECTED_PRODUCTS (state, products) {
    state.selectedProducts = products
  },
  SET_SELECTED_PRODUCT (state, product) {
    const index = state.selectedProducts.findIndex(p => p.id === product.id)
    if (index === -1) {
      state.selectedProducts.push(product)
    } else {
      state.selectedProducts.splice(index, 1, product)
    }
  },
  REMOVE_SELECTED_PRODUCT (state, productId) {
    state.selectedProducts = state.selectedProducts.filter(p => p.id !== productId)
  },
}

export const actions = {
  /**
   * Create a new product
   */
  async createProduct ({ commit }, formData) {
    const response = await $axios.post('/product/create', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Organization-Id': formData.get('organizationId'),
      },
    })

    if (response.data?.payload) {
      commit('ADD_PRODUCT', response.data.payload)
    }

    return response.data
  },

  /**
   * Update an existing product
   */
  async updateProduct ({ commit }, formData) {
    const response = await $axios.put('/product/update', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Product-Id': formData.get('productId'),
      },
    })

    if (response.data?.payload) {
      commit('UPDATE_PRODUCT', response.data.payload)
    }

    return response.data
  },

  /**
   * Delete a product
   */
  async deleteProduct ({ commit }, productId) {
    const response = await $axios.delete('/product/delete', {
      params: { productId },
    })

    if (response.data?.payload?.deleted) {
      commit('REMOVE_PRODUCT', productId)
    }

    return response.data
  },

  /**
   * Fetch all products for organizer
   */
  async fetchOrganizerProducts ({ commit }, organizationId) {
    const response = await $axios.get('/product/getOrganizerProducts', {
      params: { organizationId },
    })

    if (response.data?.payload) {
      commit('SET_PRODUCTS', response.data.payload)
    }

    return response.data.payload
  },

  /**
   * Fetch a single product by ID
   */
  async fetchProductById ({ commit }, productId) {
    const response = await $axios.get('/product/getProductById', {
      params: { productId },
    })

    if (response.data?.payload) {
      commit('SET_CURRENT_PRODUCT', response.data.payload)
    }

    return response.data.payload
  },

  /**
   * Fetch products linked to an event (public)
   */
  async fetchEventProducts ({ commit }, eventId) {
    const response = await $axios.get('/product/getEventProducts', {
      params: { eventId },
    })

    if (response.data?.payload) {
      commit('SET_EVENT_PRODUCTS', response.data.payload)
    }

    return response.data.payload
  },

  /**
   * Add a product to an event
   */
  async addProductToEvent ({ commit }, { eventId, productId, isFeatured }) {
    const response = await $axios.post('/product/addToEvent', {
      eventId,
      productId,
      isFeatured,
    })

    return response.data
  },

  /**
   * Remove a product from an event
   */
  async removeProductFromEvent ({ commit }, { eventId, productId }) {
    const response = await $axios.post('/product/removeFromEvent', {
      eventId,
      productId,
    })

    if (response.data?.data?.removed) {
      commit('REMOVE_PRODUCT_FROM_EVENT', productId)
    }

    return response.data
  },

  /**
   * Update product settings within an event
   */
  async updateEventProductSettings ({ dispatch }, { eventId, productId, isFeatured, displayOrder }) {
    const response = await $axios.post('/product/updateEventProductSettings', {
      eventId,
      productId,
      isFeatured,
      displayOrder,
    })

    return response.data
  },

  /**
   * Bulk reorder products for an event
   */
  async reorderEventProducts ({ commit }, { eventId, productOrders }) {
    const response = await $axios.post('/product/reorderEventProducts', {
      eventId,
      productOrders,
    })

    if (response.data?.data) {
      commit('SET_EVENT_PRODUCTS', response.data.data)
    }

    return response.data
  },

  /**
   * Clear products state
   */
  clearProducts ({ commit }) {
    commit('SET_PRODUCTS', [])
  },

  /**
   * Clear event products state
   */
  clearEventProducts ({ commit }) {
    commit('SET_EVENT_PRODUCTS', [])
  },
}
