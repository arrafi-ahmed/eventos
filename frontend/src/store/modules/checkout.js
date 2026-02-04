// Helper for safe localStorage access
function getFromStorage(key, defaultValue) {
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error(`Error parsing localStorage key ${key}:`, error)
    return defaultValue
  }
}

export const namespaced = true

export const state = {
  isCheckoutExist: getFromStorage('isCheckoutExist', false),
  selectedTickets: getFromStorage('selectedTickets', []),
  selectedProducts: getFromStorage('selectedProducts', []),
  totalAmount: getFromStorage('totalAmount', 0),
  cartEventSlug: getFromStorage('cartEventSlug', null),
}

function normalizeTicket(ticket) {
  return {
    ...ticket,
    price: Number(ticket.price ?? 0),
  }
}

function normalizeProduct(product) {
  return {
    ...product,
    price: Number(product.price ?? 0),
  }
}

export const mutations = {
  setCheckoutExists(state, exists) {
    state.isCheckoutExist = exists
    try {
      localStorage.setItem('isCheckoutExist', JSON.stringify(exists))
    } catch (error) {
      console.error('Error syncing isCheckoutExist to localStorage:', error)
    }
  },
  setSelectedTickets(state, tickets) {
    state.selectedTickets = (tickets || []).map(normalizeTicket)
    try {
      localStorage.setItem('selectedTickets', JSON.stringify(state.selectedTickets))
    } catch (error) {
      console.error('Error syncing selectedTickets to localStorage:', error)
    }
  },
  setSelectedProducts(state, products) {
    state.selectedProducts = (products || []).map(normalizeProduct)
    try {
      localStorage.setItem('selectedProducts', JSON.stringify(state.selectedProducts))
    } catch (error) {
      console.error('Error syncing selectedProducts to localStorage:', error)
    }
  },
  setTotalAmount(state, amount) {
    state.totalAmount = amount
    try {
      localStorage.setItem('totalAmount', JSON.stringify(amount))
    } catch (error) {
      console.error('Error syncing totalAmount to localStorage:', error)
    }
  },
  addTicket(state, ticket) {
    state.selectedTickets.push(normalizeTicket(ticket))
    try {
      localStorage.setItem('selectedTickets', JSON.stringify(state.selectedTickets))
    } catch (error) {
      console.error('Error syncing selectedTickets to localStorage:', error)
    }
  },
  addProduct(state, product) {
    state.selectedProducts.push(normalizeProduct(product))
    try {
      localStorage.setItem('selectedProducts', JSON.stringify(state.selectedProducts))
    } catch (error) {
      console.error('Error syncing selectedProducts to localStorage:', error)
    }
  },
  removeTicket(state, ticketId) {
    state.selectedTickets = state.selectedTickets.filter(t => t.ticketId !== ticketId)
    try {
      localStorage.setItem('selectedTickets', JSON.stringify(state.selectedTickets))
    } catch (error) {
      console.error('Error syncing selectedTickets to localStorage:', error)
    }
  },
  removeProduct(state, productId) {
    state.selectedProducts = state.selectedProducts.filter(p => p.productId !== productId)
    try {
      localStorage.setItem('selectedProducts', JSON.stringify(state.selectedProducts))
    } catch (error) {
      console.error('Error syncing selectedProducts to localStorage:', error)
    }
  },
  setCartEventSlug(state, slug) {
    state.cartEventSlug = slug
    try {
      if (slug) {
        localStorage.setItem('cartEventSlug', JSON.stringify(slug))
      } else {
        localStorage.removeItem('cartEventSlug')
      }
    } catch (error) {
      console.error('Error syncing cartEventSlug to localStorage:', error)
    }
  },
  clearCheckout(state) {
    state.selectedTickets = []
    state.selectedProducts = []
    state.isCheckoutExist = false
    state.totalAmount = 0
    state.cartEventSlug = null

    // Also clear from localStorage immediately
    try {
      localStorage.setItem('selectedTickets', '[]')
      localStorage.setItem('selectedProducts', '[]')
      localStorage.setItem('isCheckoutExist', 'false')
      localStorage.setItem('totalAmount', '0')
      localStorage.removeItem('cartEventSlug')
    } catch (error) {
      console.error('Error clearing state in localStorage:', error)
    }
  },
}

export const actions = {
  async addTicket({ commit, state, rootState, dispatch }, ticket) {
    // Always sync slug if cart is empty
    if (state.selectedTickets.length === 0 && state.selectedProducts.length === 0) {
      const currentSlug = rootState.routeInfo?.to?.params?.slug
      if (currentSlug) {
        commit('setCartEventSlug', currentSlug)
      }
    }

    const existingIndex = state.selectedTickets.findIndex(t => t.ticketId === ticket.ticketId)
    if (existingIndex === -1) {
      commit('addTicket', ticket)
    } else {
      const updatedTickets = [...state.selectedTickets]
      updatedTickets[existingIndex] = ticket
      commit('setSelectedTickets', updatedTickets)
    }
    commit('setCheckoutExists', true)
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  async addProduct({ commit, state, rootState }, product) {
    // Always sync slug if cart is empty
    if (state.selectedTickets.length === 0 && state.selectedProducts.length === 0) {
      const currentSlug = rootState.routeInfo?.to?.params?.slug
      if (currentSlug) {
        commit('setCartEventSlug', currentSlug)
      }
    }

    const existingIndex = state.selectedProducts.findIndex(p => p.productId === product.productId)
    if (existingIndex === -1) {
      commit('addProduct', product)
    } else {
      const updatedProducts = [...state.selectedProducts]
      updatedProducts[existingIndex] = product
      commit('setSelectedProducts', updatedProducts)
    }
    commit('setCheckoutExists', true)
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  removeTicket({ commit, state }, ticketId) {
    const remainingTickets = state.selectedTickets.filter(t => t.ticketId !== ticketId)
    commit('removeTicket', ticketId)
    commit('setCheckoutExists', remainingTickets.length > 0 || state.selectedProducts.length > 0)
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  removeProduct({ commit, state }, productId) {
    const remainingProducts = state.selectedProducts.filter(p => p.productId !== productId)
    commit('removeProduct', productId)
    commit('setCheckoutExists', state.selectedTickets.length > 0 || remainingProducts.length > 0)
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  clearCheckout({ commit }) {
    commit('clearCheckout')
    const keysToRemove = [
      'selectedTickets', 'selectedProducts', 'isCheckoutExist', 'totalAmount',
      'attendeesData', 'registrationData', 'tempSessionId', 'cartHash',
      'selectedShippingOption', 'shippingAddress', 'paymentIntentId', 'clientSecret',
    ]
    for (const key of keysToRemove) {
      try { localStorage.removeItem(key) } catch (error) { }
    }
  },

  initializeFromStorage({ commit }) {
    commit('setCheckoutExists', getFromStorage('isCheckoutExist', false))
    commit('setSelectedTickets', getFromStorage('selectedTickets', []))
    commit('setSelectedProducts', getFromStorage('selectedProducts', []))
    commit('setTotalAmount', getFromStorage('totalAmount', 0))
    commit('setCartEventSlug', getFromStorage('cartEventSlug', null))
  },

  resetAll({ dispatch }) {
    dispatch('clearCheckout')
  },

  checkMismatch({ state, getters }, currentSlug) {
    if (!currentSlug) return { mismatch: false }

    // Check if we have items
    const hasItems = getters.totalItems > 0 ||
      getFromStorage('selectedTickets', []).length > 0 ||
      getFromStorage('selectedProducts', []).length > 0

    let storedSlug = state.cartEventSlug || getFromStorage('cartEventSlug', null)

    console.log('[checkMismatch] Checking:', { currentSlug, storedSlug, hasItems })

    if (hasItems && storedSlug && String(storedSlug).trim() !== String(currentSlug).trim()) {
      console.warn('[checkMismatch] MISMATCH FOUND:', { storedSlug, currentSlug })
      return { mismatch: true, storedSlug }
    }

    return { mismatch: false }
  },

  enforceExclusivity({ commit, state, getters }, currentSlug) {
    if (!currentSlug) return

    const hasItems = getters.totalItems > 0 ||
      getFromStorage('selectedTickets', []).length > 0 ||
      getFromStorage('selectedProducts', []).length > 0

    if (!hasItems) {
      commit('setCartEventSlug', currentSlug)
    }
  },

  goToCheckout({ state, rootState, commit }, { router, route }) {
    const storedData = localStorage.getItem('registrationData')
    const storedAttendee = localStorage.getItem('attendeesData')

    if (!storedData || !storedAttendee) {
      commit('addSnackbar', { text: 'Please complete the registration form first', color: 'error' }, { root: true })
      return
    }

    let registrationData
    try { registrationData = JSON.parse(storedData) } catch { return }

    if (!registrationData.eventId) { return }

    const transformedTickets = state.selectedTickets.map(ticket => ({
      ticketId: ticket.ticketId,
      title: ticket.title,
      price: Number(ticket.price || 0),
      quantity: Number(ticket.quantity || 1),
    }))
    localStorage.setItem('selectedTickets', JSON.stringify(transformedTickets))

    const selectedProductItems = rootState.event.event?.config?.enableMerchandiseShop
      ? state.selectedProducts.filter(item => item.quantity > 0).map(product => ({
        productId: product.productId,
        name: product.name,
        price: Number(product.price || 0),
        quantity: Number(product.quantity || 1),
      }))
      : []
    localStorage.setItem('selectedProducts', JSON.stringify(selectedProductItems))

    const saveAllAttendeesDetails = rootState.event.event?.config?.saveAllAttendeesDetails === true
    if (!saveAllAttendeesDetails) {
      const [parsedAttendee] = JSON.parse(storedAttendee)
      localStorage.setItem('attendeesData', JSON.stringify([{
        firstName: parsedAttendee.firstName || '',
        lastName: parsedAttendee.lastName || '',
        email: parsedAttendee.email || '',
        phone: parsedAttendee.phone || '',
        isPrimary: true,
      }]))
      router.push({ name: 'checkout-slug', params: { slug: route.params.slug } })
    } else {
      router.push({ name: 'attendee-form-slug', params: { slug: route.params.slug } })
    }
  },
}

export const getters = {
  isCheckoutExist: state => state.isCheckoutExist,
  selectedTickets: state => state.selectedTickets,
  selectedProducts: state => state.selectedProducts,
  totalAmount: state => state.totalAmount,
  totalItems: state => (state.selectedTickets?.length || 0) + (state.selectedProducts?.length || 0),
}
