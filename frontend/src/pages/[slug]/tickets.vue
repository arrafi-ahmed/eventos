<script setup>
  import { computed, onMounted, ref, watch } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import CartSummary from '@/components/CartSummary.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  definePage({
    name: 'tickets-slug',
    meta: {
      layout: 'default',
      title: 'Tickets',
    },
  })

  const { xs } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  const selectedTickets = computed(() => store.getters['checkout/selectedTickets'])
  const selectedProducts = computed(() => store.getters['checkout/selectedProducts'])
  const isLoading = ref(true)
  const isProcessingPayment = ref(false)
  const showCartDialog = ref(false)

  const event = computed(() => store.state.event.event)
  const tickets = computed(() => store.state.ticket.tickets)
  const eventProducts = computed(() => store.state.product.eventProducts)

  // Max tickets per registration from event config
  const maxTicketsPerRegistration = computed(() => {
    const val = Number(event.value?.config?.maxTicketsPerRegistration)
    return Number.isFinite(val) && val > 0 ? val : Infinity
  })

  // Total selected tickets across all ticket types
  const totalSelectedTickets = computed(() =>
    selectedTickets.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  )

  // Total selected products across all product types
  const totalSelectedProducts = computed(() =>
    selectedProducts.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  )

  const isAtSelectionLimit = computed(() => totalSelectedTickets.value >= maxTicketsPerRegistration.value)

  const getTicketById = ticketId => tickets.value.find(t => t.id === ticketId)

  // Get currency from event
  const eventCurrency = computed(() => {
    // Check if event has currency field, otherwise default to USD
    const currency = event.value?.currency
    if (currency && typeof currency === 'string' && currency.length === 3) {
      return currency.toUpperCase()
    }
    return 'USD'
  })

  // Helper check for sale window
  function isTicketSaleActive (ticket) {
    if (!ticket.saleStartDate && !ticket.saleEndDate) return true // Always active if no dates

    const now = new Date()
    if (ticket.saleStartDate && new Date(ticket.saleStartDate) > now) return false // Not started
    if (ticket.saleEndDate && new Date(ticket.saleEndDate) < now) return false // Ended

    return true
  }

  function getTicketStatus (ticket) {
    if (!ticket.saleStartDate && !ticket.saleEndDate) return null

    const now = new Date()
    if (ticket.saleStartDate && new Date(ticket.saleStartDate) > now) {
      return { label: 'Coming Soon', color: 'info', available: false }
    }
    if (ticket.saleEndDate && new Date(ticket.saleEndDate) < now) {
      return { label: 'Sale Ended', color: 'grey', available: false }
    }
    if (ticket.saleEndDate) {
      // Active with end date
      return {
        label: `Ends ${new Date(ticket.saleEndDate).toLocaleDateString()}`,
        color: 'warning',
        available: true,
        isEarlyBird: true,
      }
    }
    return null
  }

  function getDiscountLabel (ticket) {
    if (ticket.originalPrice && ticket.originalPrice > ticket.price) {
      const savings = ticket.originalPrice - ticket.price
      const percent = Math.round((savings / ticket.originalPrice) * 100)
      if (percent >= 5) {
        return `SAVE ${percent}%`
      }
    }
    return null
  }

  async function fetchTickets () {
    try {
      isLoading.value = true

      const slug = route.params.slug

      // Try to fetch by slug first if available and event is not in store
      if (!event.value.id) {
        try {
          await store.dispatch('event/setEventBySlug', { slug })
        } catch {}
      }

      if (event.value.id) {
        // Fetch tickets for this event using store action
        try {
          await store.dispatch('ticket/setTickets', event.value.id)
        } catch {
          tickets.value = []
        }

        // Fetch products for this event
        try {
          await store.dispatch('product/fetchEventProducts', event.value.id)
        } catch {
        // Products are optional, don't fail if they don't exist
        }
      } else {
        tickets.value = []
      }
    } catch {
      tickets.value = []
    } finally {
      isLoading.value = false
    }
  }

  function selectTicket (ticket, quantityChange = 1) {
    const existingIndex = selectedTickets.value.findIndex(item => item.ticketId === ticket.id)

    if (existingIndex === -1) {
      // Add new selection (only if quantityChange is positive)
      if (quantityChange > 0 && quantityChange <= ticket.currentStock) {
        // Enforce global per-registration limit
        const prospectiveTotal = totalSelectedTickets.value + quantityChange
        if (prospectiveTotal > maxTicketsPerRegistration.value) {
          store.commit('addSnackbar', {
            text: `You can select up to ${maxTicketsPerRegistration.value === Infinity ? 0 : maxTicketsPerRegistration.value} tickets per registration`,
            color: 'error',
          })
          return
        }
        store.dispatch('checkout/addTicket', {
          ticketId: ticket.id,
          title: ticket.title,
          price: ticket.price,
          currency: eventCurrency.value,
          quantity: quantityChange,
        })
      }
    } else {
      // Update existing selection
      const currentQuantity = selectedTickets.value[existingIndex].quantity
      const newQuantity = currentQuantity + quantityChange
      // Enforce global per-registration limit
      if (quantityChange > 0) {
        const prospectiveTotal = totalSelectedTickets.value + quantityChange
        if (prospectiveTotal > maxTicketsPerRegistration.value) {
          store.commit('addSnackbar', {
            text: `You can select up to ${maxTicketsPerRegistration.value === Infinity ? 0 : maxTicketsPerRegistration.value} tickets per registration`,
            color: 'error',
          })
          return
        }
      }

      if (newQuantity <= 0) {
        // Remove from cart if quantity becomes 0 or negative
        store.dispatch('checkout/removeTicket', ticket.id)
      } else if (newQuantity <= ticket.currentStock) {
        // Update quantity if within stock limits
        store.dispatch('checkout/addTicket', {
          ...selectedTickets.value[existingIndex],
          quantity: newQuantity,
        })
      }
    // If newQuantity > currentStock, do nothing (button will be disabled)
    }
  }

  function removeTicket (ticketId) {
    store.dispatch('checkout/removeTicket', ticketId)
  }

  function updateQuantity (ticketId, newQuantity) {
    const ticket = tickets.value.find(t => t.id === ticketId)
    if (!ticket) return

    if (newQuantity <= 0) {
      store.dispatch('checkout/removeTicket', ticketId)
    } else if (newQuantity <= ticket.currentStock) {
      const existingTicket = selectedTickets.value.find(item => item.ticketId === ticketId)
      if (existingTicket) {
        store.dispatch('checkout/addTicket', {
          ...existingTicket,
          quantity: newQuantity,
        })
      } else {
        store.dispatch('checkout/addTicket', {
          ticketId: ticket.id,
          title: ticket.title,
          price: ticket.price,
          currency: eventCurrency.value,
          quantity: newQuantity,
        })
      }
    }
  }

  function updateProductQuantity (productId, newQuantity) {
    const product = eventProducts.value.find(p => p.id === productId)
    if (!product) return

    if (newQuantity <= 0) {
      // Remove from selected products - use the productId from the selected products array
      const existingProduct = selectedProducts.value.find(item => item.productId === productId)
      if (existingProduct) {
        store.dispatch('checkout/removeProduct', existingProduct.productId)
      }
    } else if (newQuantity <= product.stock) {
      const existingProduct = selectedProducts.value.find(item => item.productId === productId)
      if (existingProduct) {
        store.dispatch('checkout/addProduct', {
          ...existingProduct,
          productId: product.id,
          price: existingProduct.price || product.price,
          quantity: newQuantity,
        })
      } else {
        store.dispatch('checkout/addProduct', {
          ...product,
          productId: product.id,
          price: product.price,
          quantity: newQuantity,
        })
      }
    }
  }

  function isTicketInCart (ticketId) {
    return selectedTickets.value.some(item => item.ticketId === ticketId)
  }

  function isProductInCart (productId) {
    const product = selectedProducts.value.find(item => item.id === productId)
    return product && product.quantity > 0
  }

  function getButtonText (ticket) {
    if (ticket.currentStock === 0) {
      return 'Sold Out'
    } else if (isTicketInCart(ticket.id)) {
      return 'In Cart'
    } else {
      return 'Add to Cart'
    }
  }

  function getSubtotalAmount () {
    const ticketsTotal = selectedTickets.value.reduce((total, item) => {
      return total + (item.price || 0) * (item.quantity || 0)
    }, 0)

    const productsTotal = event.value?.config?.enableMerchandiseShop
      ? selectedProducts.value.reduce((total, item) => {
        return total + (item.price || 0) * (item.quantity || 0)
      }, 0)
      : 0

    return ticketsTotal + productsTotal
  }

  function getTaxConfig () {
    const cfg = event.value?.config
    if (!cfg || typeof cfg !== 'object') return { type: 'percent', amount: 0 }
    return { type: (cfg.type || 'percent').toLowerCase(), amount: Number(cfg.amount || 0) }
  }

  function getTaxAmount () {
    const { type, amount } = getTaxConfig()
    if (!amount || amount <= 0) return 0
    if (type === 'percent') {
      return Math.round((getSubtotalAmount() * amount) / 100)
    }
    // fixed amount in cents
    return Math.round(amount)
  }

  function getTotalAmount () {
    return getSubtotalAmount() + getTaxAmount()
  }

  function proceedToForm () {
    // Use the centralized routing logic from the store
    store.dispatch('checkout/goToCheckout', { router, route })
  }

  function goBack () {
    // Only slug-based routing
    router.push({
      name: 'event-landing-slug',
      params: { slug: route.params.slug },
    })
  }

  import { usePaymentResilience } from '@/composables/usePaymentResilience'

  const { checkAndCleanupSession } = usePaymentResilience()

  onMounted(async () => {
    // Clear sessionId and cart hash when starting fresh ticket selection
    // This ensures new session is created when items change
    const existingSessionId = localStorage.getItem('tempSessionId')
    if (existingSessionId) {
      await checkAndCleanupSession(route.params.slug)
    }

    // Clear sessionId and cart hash when starting fresh ticket selection
    // This ensures new session is created when items change
    localStorage.removeItem('tempSessionId')
    localStorage.removeItem('cartHash')

    // Check if localStorage is empty but store still has values
    // This can happen if user visited success page which cleared localStorage but not store
    const storedTickets = localStorage.getItem('selectedTickets')
    const storedProducts = localStorage.getItem('selectedProducts')

    // If localStorage is empty but store has values, clear the store
    if ((!storedTickets || storedTickets === '[]') && selectedTickets.value && selectedTickets.value.length > 0) {
      store.dispatch('checkout/clearCheckout')
    } else if ((!storedProducts || storedProducts === '[]') && selectedProducts.value && selectedProducts.value.length > 0) {
      store.dispatch('checkout/clearCheckout')
    }

    // Fetch event and tickets first
    await fetchTickets()
  })

  // Watch for products changes and initialize selected products
  watch(() => eventProducts.value, newProducts => {
    if (newProducts && Array.isArray(newProducts)) {
      // Load selected products from localStorage
      const savedProducts = localStorage.getItem('selectedProducts')
      if (savedProducts) {
        const parsedProducts = JSON.parse(savedProducts)
        selectedProducts.value = parsedProducts
      } else {
        selectedProducts.value = newProducts.map(product => ({
          ...product,
          quantity: 0,
        }))
      }
    }
  }, { immediate: true })

  // Watch for selected products changes and save to localStorage
  watch(selectedProducts, newProducts => {
    localStorage.setItem('selectedProducts', JSON.stringify(newProducts))
  }, { deep: true })
</script>

<template>
  <!-- Main Section -->
  <section class="section section-fade">
    <v-container>
      <PageTitle
        :back-route="{ name: 'event-landing-slug', params: { slug: route.params.slug } }"
        :compact="true"
        :show-back-button="true"
        :subtitle="event?.name"
        title="Available Tickets"
      >
        <template #actions>
          <!-- Shop Button - Only show if merchandise shop is enabled -->
          <v-btn
            v-if="event?.config?.enableMerchandiseShop && eventProducts && eventProducts.length > 0"
            color="primary"
            :density="density"
            :rounded="rounded"
            :size="size"
            :variant="variant"
            @click="router.push(`/${route.params.slug}/shop`)"
          >
            <v-icon class="mr-2">
              mdi-package-variant
            </v-icon>
            Browse Shop
          </v-btn>
        </template>
      </PageTitle>

      <v-row v-if="isLoading" justify="center">
        <v-col
          class="text-center"
          cols="12"
        >
          <v-progress-circular
            color="primary"
            indeterminate
            size="64"
          />
          <p class="mt-4">
            Loading tickets...
          </p>
        </v-col>
      </v-row>

      <v-row v-else-if="tickets.length === 0" justify="center">
        <v-col
          class="text-center"
          cols="12"
        >
          <v-card
            class="mx-auto"
            elevation="4"
            max-width="500"
          >
            <v-card-text class="pa-6">
              <v-icon
                class="mb-4"
                color="info"
                size="64"
              >
                mdi-ticket-outline
              </v-icon>
              <h3 class="text-h5 mb-4">
                No Tickets Available Yet
              </h3>
              <p class="text-body-1 mb-4">
                Tickets for this event have not been created by the organizer yet. Please check back later or contact
                the event organizer for more information.
              </p>
              <v-btn
                class="mt-4"
                color="primary"
                :rounded="rounded"
                :size="size"
                @click="goBack"
              >
                Back to Event
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <v-row v-else justify="center">
        <v-col
          v-for="ticket in tickets"
          :key="ticket.id"
          class="mb-6"
          cols="12"
          md="4"
          sm="6"
        >
          <v-card
            class="ticket-card-modern mx-auto"
            :class="{ 'ticket-selected': isTicketInCart(ticket.id) }"
            elevation="0"
            :max-width="xs ? 320 : undefined"
            :rounded="rounded"
          >
            <!-- Vertical Accent Bar -->
            <div class="ticket-accent-bar" />

            <v-card-text class="pa-5 d-flex flex-column h-100">
              <div class="d-flex justify-space-between align-start mb-1">
                <h3 class="text-h5 font-weight-black line-clamp-2 flex-grow-1 min-width-0 mr-2">
                  {{ ticket.title }}
                </h3>
                <v-chip
                  v-if="isTicketInCart(ticket.id)"
                  class="font-weight-bold flex-shrink-0"
                  color="success"
                  size="small"
                  variant="flat"
                >
                  <v-icon size="14" start>mdi-check</v-icon>
                  In Cart
                </v-chip>
              </div>
              <div class="d-flex align-center flex-wrap gap-2 mb-4">
                <div class="text-h5 font-weight-bold text-primary">
                  {{ formatPrice(ticket.price, eventCurrency) }}
                </div>
                <div
                  v-if="ticket.originalPrice && ticket.originalPrice > ticket.price"
                  class="text-body-2 text-decoration-line-through text-medium-emphasis"
                >
                  {{ formatPrice(ticket.originalPrice, eventCurrency) }}
                </div>
                <v-chip
                  v-if="getDiscountLabel(ticket)"
                  class="font-weight-bold"
                  color="error"
                  size="x-small"
                  variant="flat"
                >
                  {{ getDiscountLabel(ticket) }}
                </v-chip>
                <v-chip
                  v-if="ticket.saleStartDate || ticket.saleEndDate"
                  class="font-weight-bold"
                  color="secondary"
                  size="x-small"
                  variant="flat"
                >
                  Early Bird
                </v-chip>
              </div>

              <p v-if="ticket.description" class="text-body-2 mb-2 text-medium-emphasis line-clamp-2">
                {{ ticket.description }}
              </p>

              <div class="ticket-meta-modern">
                <div class="d-flex align-center flex-wrap gap-2">
                  <v-icon class="mr-2" :color="ticket.currentStock > 0 ? 'success' : 'error'" size="16">
                    {{ ticket.currentStock > 0 ? 'mdi-check-circle' : 'mdi-close-circle' }}
                  </v-icon>
                  <span class="text-caption font-weight-bold text-uppercase letter-spacing-1 mr-3">
                    {{ ticket.currentStock || 0 }} Available
                  </span>

                  <!-- Sale Status Chip -->
                  <v-chip
                    v-if="getTicketStatus(ticket)"
                    class="font-weight-bold"
                    :color="getTicketStatus(ticket).color"
                    size="x-small"
                    variant="flat"
                  >
                    {{ getTicketStatus(ticket).label }}
                  </v-chip>
                </div>
              </div>

              <v-spacer />

              <!-- Quantity Selection / Dynamic Add to Cart -->
              <div class="quantity-control-modern">
                <!-- Dynamic Swap: Single button that transforms into +/- control -->
                <v-btn
                  v-if="!isTicketInCart(ticket.id)"
                  block
                  class="font-weight-bold"
                  color="primary"
                  :disabled="!isTicketSaleActive(ticket) || !ticket.currentStock || ticket.currentStock <= 0 || isAtSelectionLimit"
                  elevation="0"
                  height="48"
                  prepend-icon="mdi-cart-plus"
                  rounded="xl"
                  @click="selectTicket(ticket, 1)"
                >
                  {{ isTicketSaleActive(ticket) ? 'Add to Cart' : (getTicketStatus(ticket)?.label || 'Unavailable') }}
                </v-btn>

                <div
                  v-else
                  class="d-flex align-center justify-center gap-4 pa-2 bg-surface-variant-light rounded-xl"
                  style="height: 48px;"
                >
                  <v-btn
                    density="comfortable"
                    :disabled="!ticket.currentStock || ticket.currentStock <= 0"
                    icon="mdi-minus"
                    rounded="lg"
                    size="small"
                    variant="tonal"
                    @click="selectTicket(ticket, -1)"
                  />

                  <div class="quantity-display-modern">
                    {{ selectedTickets.find(item => item.ticketId === ticket.id)?.quantity || 0 }}
                  </div>

                  <v-btn
                    density="comfortable"
                    :disabled="
                      !ticket.currentStock ||
                        ticket.currentStock <= 0 ||
                        isAtSelectionLimit ||
                        (selectedTickets.find(item => item.ticketId === ticket.id)?.quantity >= ticket.currentStock)
                    "
                    icon="mdi-plus"
                    rounded="lg"
                    size="small"
                    variant="tonal"
                    @click="selectTicket(ticket, 1)"
                  />
                </div>
              </div>
            </v-card-text>

            <!-- Notched Cutouts -->
            <div class="notch notch-left" />
            <div class="notch notch-right" />
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>

  <!-- Checkout Button Component -->
  <CartSummary />

  <!-- Bottom padding to prevent content from being hidden behind fixed checkout -->
  <div class="checkout-spacer" />

  <!-- Modern Cart Dialog -->
  <v-dialog
    v-model="showCartDialog"
    max-width="380"
    persistent
    transition="dialog-bottom-transition"
  >
    <v-card
      class="modern-cart-dialog rounded-lg"
      elevation="0"
      rounded="lg"
    >
      <!-- Sleek Header -->
      <div class="cart-header">
        <div class="d-flex justify-space-between align-center pa-4">
          <div class="d-flex align-center">
            <div class="cart-icon-wrapper">
              <v-icon
                class="text-gradient-icon"
                size="18"
              >
                mdi-shopping
              </v-icon>
            </div>
            <div class="ml-3">
              <div class="text-h6 font-weight-bold text-gradient">
                Cart
              </div>
              <div class="text-caption text-gradient">
                {{ totalSelectedItems }} item{{ totalSelectedItems !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>
          <v-btn
            class="close-btn"
            color="white"
            icon
            rounded
            :size="size"
            :variant="variant"
            @click="showCartDialog = false"
          >
            <v-icon size="16">
              mdi-close
            </v-icon>
          </v-btn>
        </div>
      </div>

      <!-- Content -->
      <v-card-text class="pa-0">
        <div
          v-if="totalSelectedItems === 0"
          class="text-center py-12"
        >
          <div class="empty-cart-icon">
            <v-icon
              color="grey-lighten-2"
              size="40"
            >
              mdi-shopping-outline
            </v-icon>
          </div>
          <h3 class="text-h6 text-grey-darken-1 mb-2 mt-4">
            Your cart is empty
          </h3>
          <p class="text-body-2 text-grey-lighten-1 mb-6">
            Select tickets or products to get started
          </p>
          <v-btn
            class="continue-btn"
            color="primary"
            :rounded="rounded"
            :size="size"
            :variant="variant"
            @click="showCartDialog = false"
          >
            Continue Shopping
          </v-btn>
        </div>

        <div
          v-else
          class="cart-content"
        >
          <!-- Items List -->
          <div class="cart-items-list pa-4">
            <div
              v-for="(item, index) in selectedTickets"
              :key="item.ticketId"
              class="cart-item-modern"
            >
              <div class="cart-item-content">
                <div class="item-info">
                  <h6 class="item-title">
                    {{ item.title }}
                  </h6>
                  <div class="item-price">
                    {{ formatPrice(item.price, eventCurrency) }} each
                  </div>
                </div>

                <div class="item-controls">
                  <div class="quantity-controls">
                    <v-btn
                      class="quantity-btn"
                      color="grey-darken-1"
                      :disabled="item.quantity <= 1"
                      icon
                      rounded
                      :size="size"
                      :variant="variant"
                      @click="updateQuantity(item.ticketId, item.quantity - 1)"
                    >
                      <v-icon size="14">
                        mdi-minus
                      </v-icon>
                    </v-btn>
                    <span class="quantity-text">{{ item.quantity }}</span>
                    <v-btn
                      class="quantity-btn"
                      color="grey-darken-1"
                      :disabled="
                        isAtSelectionLimit ||
                          (getTicketById(item.ticketId)?.currentStock ?? 0) <= item.quantity
                      "
                      icon
                      rounded
                      :size="size"
                      :variant="variant"
                      @click="updateQuantity(item.ticketId, item.quantity + 1)"
                    >
                      <v-icon size="14">
                        mdi-plus
                      </v-icon>
                    </v-btn>
                  </div>

                  <div class="item-total">
                    {{ formatPrice(item.price * item.quantity, eventCurrency) }}
                  </div>

                  <v-btn
                    class="remove-btn"
                    color="grey-lighten-1"
                    icon
                    rounded
                    :size="size"
                    :variant="variant"
                    @click="removeTicket(item.ticketId)"
                  >
                    <v-icon size="14">
                      mdi-close
                    </v-icon>
                  </v-btn>
                </div>
              </div>

              <!-- Subtle divider -->
              <div
                v-if="index < selectedTickets.length - 1"
                class="item-divider"
              />
            </div>
          </div>

          <!-- Products List -->
          <div
            v-if="selectedProducts.some(p => p.quantity > 0)"
            class="cart-items-list pa-4"
          >
            <div
              v-for="(item, index) in selectedProducts.filter(p => p.quantity > 0)"
              :key="`product-${item.id}`"
              class="cart-item-modern"
            >
              <div class="cart-item-content">
                <div class="item-info">
                  <h6 class="item-title">
                    {{ item.name }}
                  </h6>
                  <div class="item-price">
                    {{ formatPrice(item.price, eventCurrency) }} each
                  </div>
                </div>

                <div class="item-controls">
                  <div class="quantity-controls">
                    <v-btn
                      class="quantity-btn"
                      color="grey-darken-1"
                      :disabled="item.quantity <= 1"
                      icon
                      rounded
                      :size="size"
                      :variant="variant"
                      @click="updateProductQuantity(item.id, item.quantity - 1)"
                    >
                      <v-icon size="14">
                        mdi-minus
                      </v-icon>
                    </v-btn>
                    <span class="quantity-text">{{ item.quantity }}</span>
                    <v-btn
                      class="quantity-btn"
                      color="grey-darken-1"
                      :disabled="item.stock <= item.quantity"
                      icon
                      rounded
                      :size="size"
                      :variant="variant"
                      @click="updateProductQuantity(item.id, item.quantity + 1)"
                    >
                      <v-icon size="14">
                        mdi-plus
                      </v-icon>
                    </v-btn>
                  </div>

                  <div class="item-total">
                    {{ formatPrice(item.price * item.quantity, eventCurrency) }}
                  </div>

                  <v-btn
                    class="remove-btn"
                    color="grey-lighten-1"
                    icon
                    rounded
                    :size="size"
                    :variant="variant"
                    @click="updateProductQuantity(item.id, 0)"
                  >
                    <v-icon size="14">
                      mdi-close
                    </v-icon>
                  </v-btn>
                </div>
              </div>

              <!-- Subtle divider -->
              <div
                v-if="index < selectedProducts.filter(p => p.quantity > 0).length - 1"
                class="item-divider"
              />
            </div>
          </div>

          <!-- Summary Section -->
          <div class="cart-summary">
            <div class="summary-line">
              <span class="summary-label">Subtotal</span>
              <span class="summary-amount">{{ formatPrice(getSubtotalAmount(), eventCurrency) }}</span>
            </div>
            <div
              v-if="getTaxAmount() > 0"
              class="summary-line"
            >
              <span class="summary-label">Tax</span>
              <span class="summary-amount">{{ formatPrice(getTaxAmount(), eventCurrency) }}</span>
            </div>
            <v-divider class="my-2" />
            <div class="summary-line summary-total">
              <span class="summary-label">Total</span>
              <span class="summary-amount">{{ formatPrice(getTotalAmount(), eventCurrency) }}</span>
            </div>

            <v-btn
              block
              class="checkout-btn"
              color="primary"
              :disabled="totalSelectedTickets === 0"
              elevation="0"
              height="48"
              :loading="isProcessingPayment"
              :rounded="rounded"
              :size="size"
              @click="proceedToForm"
            >
              <v-icon
                class="mr-2"
                size="18"
              >
                mdi-credit-card-outline
              </v-icon>
              <span class="font-weight-medium">
                {{ isProcessingPayment ? 'Processing...' : 'Checkout' }}
              </span>
            </v-btn>

            <div class="text-center mt-4">
              <v-btn
                class="continue-shopping-btn"
                color="grey-darken-1"
                :rounded="rounded"
                :size="size"
                :variant="variant"
                @click="showCartDialog = false"
              >
                Continue Shopping
              </v-btn>
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

</template>

<style scoped>
.hero-section {
  position: relative;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    120deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  z-index: 1;
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(30, 60, 114, 0.35);
  z-index: 2;
}

.hero-section .v-container {
  position: relative;
  z-index: 3;
  min-height: 60vh;
}

/* Quick Continue Bar Styles */
.quick-continue-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-accent)) 100%);
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.15);
  z-index: 999;
  padding: 16px 0;
  backdrop-filter: blur(10px);
}

.quick-continue-bar .v-container {
  padding-top: 8px;
  padding-bottom: 8px;
}

.continue-btn {
  font-weight: 600 !important;
  text-transform: none !important;
  min-width: 180px !important;
}

.review-btn {
  font-weight: 500 !important;
  text-transform: none !important;
  min-width: 80px !important;
}

.gap-2 {
  gap: 8px;
}

.modern-cart-dialog {
  overflow: hidden;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
}

/* Cart Header */
.cart-header {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  );
  position: relative;
  overflow: hidden;
}

.cart-header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="25" cy="25" r="1" fill="white" opacity="0.1"/><circle cx="75" cy="75" r="1" fill="white" opacity="0.1"/><circle cx="50" cy="10" r="0.5" fill="white" opacity="0.1"/><circle cx="10" cy="60" r="0.5" fill="white" opacity="0.1"/><circle cx="90" cy="40" r="0.5" fill="white" opacity="0.1"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
  opacity: 0.3;
}

.cart-icon-wrapper {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}

.close-btn {
  background: rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
  backdrop-filter: blur(10px);
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
}

/* Empty Cart */
.empty-cart-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surfaceVariant)) 0%,
    rgb(var(--v-theme-outline)) 100%
  );
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
}

.continue-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 500 !important;
}

/* Cart Items */
.cart-items-list {
  background: rgb(var(--v-theme-surface));
}

/* Component styles are now centralized in @/styles/components.css */

/* Cart Summary */
.cart-summary {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surfaceVariant)) 0%,
    rgb(var(--v-theme-surface)) 100%
  );
  border-top: 1px solid rgb(var(--v-theme-outline));
  padding: 20px;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.summary-label {
  font-size: 1rem;
  font-weight: 600;
  color: rgb(var(--v-theme-onSurface));
}

.summary-amount {
  font-size: 1.25rem;
  font-weight: 700;
  color: rgb(var(--v-theme-onSurface));
}

.checkout-btn {
  border-radius: 12px !important;
  text-transform: none !important;
  font-weight: 500 !important;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
}

.checkout-btn:hover {
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4) !important;
  transform: translateY(-1px);
}

.continue-shopping-btn {
  text-transform: none !important;
  font-weight: 500 !important;
  border-radius: 12px !important;
}

.continue-shopping-btn:hover {
  background: rgba(0, 0, 0, 0.05) !important;
}

/* Modern Ticket Card Styles */
.ticket-card-modern {
  position: relative;
  background: rgba(var(--v-theme-surface), 0.7) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05) !important;
  min-height: 280px;
  height: 100%;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: visible !important; /* Allow notches to "cut out" */
}

.ticket-card-modern:hover {
  transform: translateY(-4px);
  border-color: rgba(var(--v-theme-primary), 0.3) !important;
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.3) !important;
}

.ticket-selected.ticket-card-modern {
  border-color: rgba(var(--v-theme-success), 0.5) !important;
  box-shadow: 0 0 20px rgba(var(--v-theme-success), 0.1) !important;
}

.ticket-accent-bar {
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 0;
  width: 4px;
  background: rgb(var(--v-theme-primary));
  opacity: 0.8;
  border-radius: 0 4px 4px 0;
}

.ticket-selected .ticket-accent-bar {
  background: rgb(var(--v-theme-success));
}

.ticket-meta-modern {
  background: rgba(var(--v-theme-surfaceVariant), 0.3);
  padding: 8px 12px;
  border-radius: 8px;
  display: inline-block;
}

/* Notches */
.notch {
  position: absolute;
  width: 24px;
  height: 24px;
  background: rgb(var(--v-theme-background)); /* Matches page bg to look like cutout */
  border-radius: 50%;
  z-index: 5;
  top: 50%;
  transform: translateY(-50%);
}

.notch-left {
  left: -12px;
  box-shadow: inset -4px 0 4px rgba(0, 0, 0, 0.1);
}

.notch-right {
  right: -12px;
  box-shadow: inset 4px 0 4px rgba(0, 0, 0, 0.1);
}

.quantity-control-modern {
  background: rgba(var(--v-theme-surfaceVariant), 0.2);
  border-radius: 12px;
  padding: 8px;
}

.quantity-display-modern {
  font-size: 1.25rem;
  font-weight: 800;
  min-width: 32px;
  text-align: center;
  color: rgb(var(--v-theme-primary));
}

.letter-spacing-1 {
  letter-spacing: 1px;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.min-width-0 {
  min-width: 0;
}

/* Gradient Background */
.bg-gradient-primary {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-accent)) 100%
  ) !important;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .sticky-cart {
    position: static;
    margin-top: 20px;
  }

  .cart-items {
    max-height: 200px;
  }

  .ticket-card {
    min-height: 160px;
  }
}

/* Layout and utility styles are now centralized in @/styles/components.css */

.cart-card {
  position: sticky;
  top: 100px;
  border-radius: 12px;
}

/* Quantity Controls Styling - now centralized in @/styles/components.css */

.quantity-display {
  min-width: 40px;
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  color: var(--v-theme-on-surface);
  display: flex;
  align-items: center;
  justify-content: center;
}

.gap-2 {
  gap: 8px;
}

/* Cart Summary Styling */
.summary-total {
  font-weight: 600;
  font-size: 1.1rem;
}

.summary-total .summary-label {
  font-weight: 700;
}

.summary-total .summary-amount {
  font-weight: 700;
  color: var(--v-theme-primary);
}

/* Checkout Spacer */
.checkout-spacer {
  height: 120px; /* Space for fixed checkout bar */
}

</style>
