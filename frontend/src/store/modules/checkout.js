// Helper for safe localStorage access
function getFromStorage (key, defaultValue) {
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
}

function normalizeTicket (ticket) {
  return {
    ...ticket,
    price: Number(ticket.price ?? 0),
  }
}

function normalizeProduct (product) {
  return {
    ...product,
    price: Number(product.price ?? 0),
  }
}

export const mutations = {
  setCheckoutExists (state, exists) {
    state.isCheckoutExist = exists
    try {
      localStorage.setItem('isCheckoutExist', JSON.stringify(exists))
    } catch (error) {
      console.error('Error syncing isCheckoutExist to localStorage:', error)
    }
  },
  setSelectedTickets (state, tickets) {
    state.selectedTickets = (tickets || []).map(normalizeTicket)
    try {
      localStorage.setItem('selectedTickets', JSON.stringify(state.selectedTickets))
    } catch (error) {
      console.error('Error syncing selectedTickets to localStorage:', error)
    }
  },
  setSelectedProducts (state, products) {
    state.selectedProducts = (products || []).map(normalizeProduct)
    try {
      localStorage.setItem('selectedProducts', JSON.stringify(state.selectedProducts))
    } catch (error) {
      console.error('Error syncing selectedProducts to localStorage:', error)
    }
  },
  setTotalAmount (state, amount) {
    state.totalAmount = amount
    try {
      localStorage.setItem('totalAmount', JSON.stringify(amount))
    } catch (error) {
      console.error('Error syncing totalAmount to localStorage:', error)
    }
  },
  addTicket (state, ticket) {
    state.selectedTickets.push(normalizeTicket(ticket))
    try {
      localStorage.setItem('selectedTickets', JSON.stringify(state.selectedTickets))
    } catch (error) {
      console.error('Error syncing selectedTickets to localStorage:', error)
    }
  },
  addProduct (state, product) {
    state.selectedProducts.push(normalizeProduct(product))
    try {
      localStorage.setItem('selectedProducts', JSON.stringify(state.selectedProducts))
    } catch (error) {
      console.error('Error syncing selectedProducts to localStorage:', error)
    }
  },
  removeTicket (state, ticketId) {
    state.selectedTickets = state.selectedTickets.filter(t => t.ticketId !== ticketId)
    try {
      localStorage.setItem('selectedTickets', JSON.stringify(state.selectedTickets))
    } catch (error) {
      console.error('Error syncing selectedTickets to localStorage:', error)
    }
  },
  removeProduct (state, productId) {
    state.selectedProducts = state.selectedProducts.filter(p => p.productId !== productId)
    try {
      localStorage.setItem('selectedProducts', JSON.stringify(state.selectedProducts))
    } catch (error) {
      console.error('Error syncing selectedProducts to localStorage:', error)
    }
  },
  clearCheckout (state) {
    state.selectedTickets = []
    state.selectedProducts = []
    state.isCheckoutExist = false
    state.totalAmount = 0

    // Also clear from localStorage immediately
    try {
      localStorage.setItem('selectedTickets', '[]')
      localStorage.setItem('selectedProducts', '[]')
      localStorage.setItem('isCheckoutExist', 'false')
      localStorage.setItem('totalAmount', '0')
    } catch (error) {
      console.error('Error clearing state in localStorage:', error)
    }
  },
}

export const actions = {
  addTicket ({ commit, state }, ticket) {
    const existingIndex = state.selectedTickets.findIndex(t => t.ticketId === ticket.ticketId)
    if (existingIndex === -1) {
      // Add new ticket
      commit('addTicket', ticket)
    } else {
      // Update existing ticket
      const updatedTickets = [...state.selectedTickets]
      updatedTickets[existingIndex] = ticket
      commit('setSelectedTickets', updatedTickets)
    }
    commit('setCheckoutExists', true)
    // Clear sessionId when items change
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  addProduct ({ commit, state }, product) {
    const existingIndex = state.selectedProducts.findIndex(p => p.productId === product.productId)
    if (existingIndex === -1) {
      // Add new product
      commit('addProduct', product)
    } else {
      // Update existing product
      const updatedProducts = [...state.selectedProducts]
      updatedProducts[existingIndex] = product
      commit('setSelectedProducts', updatedProducts)
    }
    commit('setCheckoutExists', true)
    // Clear sessionId when items change
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  removeTicket ({ commit, state }, ticketId) {
    const remainingTickets = state.selectedTickets.filter(t => t.ticketId !== ticketId)
    commit('removeTicket', ticketId)
    commit('setCheckoutExists', remainingTickets.length > 0 || state.selectedProducts.length > 0)
    // Clear sessionId when items change
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  removeProduct ({ commit, state }, productId) {
    const remainingProducts = state.selectedProducts.filter(p => p.productId !== productId)
    commit('removeProduct', productId)
    commit('setCheckoutExists', state.selectedTickets.length > 0 || remainingProducts.length > 0)
    // Clear sessionId when items change
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')
  },

  clearCheckout ({ commit }) {
    commit('clearCheckout')

    // Clear from localStorage
    const keysToRemove = [
      'selectedTickets',
      'selectedProducts',
      'isCheckoutExist',
      'totalAmount',
      'attendeesData',
      'registrationData',
      'tempSessionId',
      'cartHash',
      'sponsorshipData',
      'selectedShippingOption',
      'shippingAddress',
      'paymentIntentId',
      'clientSecret',
    ]

    for (const key of keysToRemove) {
      try {
        localStorage.removeItem(key)
      } catch (error) {
        console.warn(`Failed to remove localStorage key: ${key}`, error)
      }
    }
  },

  initializeFromStorage ({ commit }) {
    commit('setCheckoutExists', getFromStorage('isCheckoutExist', false))
    commit('setSelectedTickets', getFromStorage('selectedTickets', []))
    commit('setSelectedProducts', getFromStorage('selectedProducts', []))
    commit('setTotalAmount', getFromStorage('totalAmount', 0))
  },

  // Clear all data and reset to initial state
  resetAll ({ dispatch }) {
    dispatch('clearCheckout')
  },

  // Handle routing logic for checkout/attendee-form
  goToCheckout ({ state, rootState, commit, dispatch }, { router, route }) {
    // Load registration data from localStorage
    const storedData = localStorage.getItem('registrationData')
    const storedAttendee = localStorage.getItem('attendeesData')

    if (!storedData || !storedAttendee) {
      commit('addSnackbar', { text: 'Please complete the registration form first', color: 'error' }, { root: true })
      return
    }

    let registrationData
    try {
      registrationData = JSON.parse(storedData)
    } catch {
      commit('addSnackbar', {
        text: 'Invalid registration data. Please complete the registration form again.',
        color: 'error',
      }, { root: true })
      return
    }

    // Validate registration data
    if (!registrationData.eventId) {
      commit('addSnackbar', { text: 'Please complete the registration form first', color: 'error' }, { root: true })
      return
    }

    // Save tickets to localStorage
    const transformedTickets = state.selectedTickets.map(ticket => {
      return {
        ticketId: ticket.ticketId,
        title: ticket.title,
        price: Number(ticket.price || 0),
        quantity: Number(ticket.quantity || 1),
      }
    })
    localStorage.setItem('selectedTickets', JSON.stringify(transformedTickets))

    // Save products to localStorage
    const selectedProductItems = rootState.event.event?.config?.enableMerchandiseShop
      ? state.selectedProducts.filter(item => item.quantity > 0).map(product => {
          return {
            productId: product.productId,
            name: product.name,
            price: Number(product.price || 0),
            quantity: Number(product.quantity || 1),
          }
        })
      : []
    localStorage.setItem('selectedProducts', JSON.stringify(selectedProductItems))

    // Determine if we can skip the attendee-form
    // If saveAllAttendeesDetails is false, we only ever need one (the primary) attendee's info
    // which we already collected on the landing page.
    const saveAllAttendeesDetails = rootState.event.event?.config?.saveAllAttendeesDetails === true
    const shouldSkipAttendeeForm = !saveAllAttendeesDetails

    if (shouldSkipAttendeeForm) {
      const [parsedAttendee] = JSON.parse(storedAttendee)
      // Single/Group order with simplified details: go directly to checkout
      // Create a single attendee entry for the group from the primary attendee
      const primaryAttendee = {
        firstName: parsedAttendee.firstName || '',
        lastName: parsedAttendee.lastName || '',
        email: parsedAttendee.email || '',
        phone: parsedAttendee.phone || '',
        isPrimary: true,
      }

      localStorage.setItem('attendeesData', JSON.stringify([primaryAttendee]))

      // Navigate to checkout
      router.push({
        name: 'checkout-slug',
        params: {
          slug: route.params.slug,
        },
      })
    } else {
      // Multi-attendee details enabled: go to attendee form page
      router.push({
        name: 'attendee-form-slug',
        params: {
          slug: route.params.slug,
        },
      })
    }
  },
}

export const getters = {
  isCheckoutExist: state => state.isCheckoutExist,
  selectedTickets: state => state.selectedTickets,
  selectedProducts: state => state.selectedProducts,
  totalAmount: state => state.totalAmount,
  totalItems: state => state.selectedTickets.length + state.selectedProducts.length,
}
