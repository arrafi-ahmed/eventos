<script setup>
  import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import PaymentStripe from '@/components/payment/PaymentStripe.vue'
  import PaymentOrangeMoney from '@/components/payment/PaymentOrangeMoney.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatPrice } from '@/utils'
  import { getCurrencyMinorUnitRatio, stripePublic } from '@/utils/common'

  definePage({
    name: 'checkout-slug',
    meta: {
      layout: 'default',
      title: 'Checkout',
    },
  })

  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, size, variant, density } = useUiProps()

  // Checkout Stepper State
  const checkoutStep = ref(1)

  // Payment State
  const paymentComponent = ref(null)
  const paymentGateway = ref(null)
  const selectedPaymentMethod = ref(null) // 'stripe' or 'orange_money'
  const isProcessingPayment = ref(false)
  const clientSecret = ref('')
  const sessionId = ref('')
  const transactionId = ref('')
  const paymentElementLoaded = ref(false)
  const paymentUrl = ref('')

  // Shipping & Promo State
  const shippingOption = ref('delivery')
  const selectedShippingOption = ref('pickup')
  const isShippingOptionSaved = ref(false)
  const isApplyingPromoCode = ref(false)
  const promoCodeInput = ref('')
  const appliedPromoCodeDetails = ref(null)
  const promoDiscountAmount = ref(0)
  const promoNewTaxAmount = ref(null)
  const promoNewTotalAmount = ref(null)
  const showPromoInput = ref(false)

  // Reactivity Trigger for localStorage
  const localStorageTrigger = ref(0)
  function triggerLocalStorageUpdate () {
    localStorageTrigger.value++
  }

  // Computed Data from LocalStorage
  const attendees = computed(() => {
    localStorageTrigger.value
    try {
      return JSON.parse(localStorage.getItem('attendeesData'))
    } catch {
      return null
    }
  })
  const selectedTickets = computed(() => {
    localStorageTrigger.value
    try {
      return JSON.parse(localStorage.getItem('selectedTickets')) || []
    } catch {
      return []
    }
  })
  const selectedProducts = computed(() => {
    localStorageTrigger.value
    try {
      return JSON.parse(localStorage.getItem('selectedProducts')) || []
    } catch {
      return []
    }
  })
  const registration = computed(() => {
    localStorageTrigger.value
    try {
      return JSON.parse(localStorage.getItem('registrationData'))
    } catch {
      return null
    }
  })

  const event = computed(() => store.state.event.event)
  const eventCurrency = computed(() => (event.value?.currency || 'USD').toUpperCase())

  // Totals Calculation
  const subtotalAmount = computed(() => {
    const t = (selectedTickets.value || []).reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 0)), 0)
    const p = (selectedProducts.value || []).reduce((acc, i) => acc + (Number(i.price || 0) * Number(i.quantity || 0)), 0)
    return t + p
  })

  const totalAmount = computed(() => {
    if (promoNewTotalAmount.value !== null) return promoNewTotalAmount.value
    return subtotalAmount.value + taxAmount.value + calculatedShippingCost.value
  })

  const taxAmount = computed(() => {
    if (promoNewTaxAmount.value !== null) return promoNewTaxAmount.value
    if (subtotalAmount.value === 0) return 0
    const tax = event.value?.taxAmount || event.value?.tax_amount || 0
    const type = (event.value?.taxType || event.value?.tax_type || 'percent').toLowerCase()
    if (type === 'percent') return Math.round((subtotalAmount.value * tax) / 100)
    return Math.round(tax)
  })

  const calculatedShippingCost = computed(() => {
    if (selectedProducts.value.length === 0) return 0
    if (selectedShippingOption.value === 'pickup') return 0
    const fee = event.value?.config?.shippingFee || 0
    const ratio = getCurrencyMinorUnitRatio(eventCurrency.value.toLowerCase())
    return Math.round(fee * ratio)
  })

  const isFreeOrder = computed(() => hasCheckoutItems.value && totalAmount.value === 0)
  const hasCheckoutItems = computed(() => (selectedTickets.value.length + selectedProducts.value.length) > 0)
  const requiresShippingAddress = computed(() => selectedProducts.value.length > 0 && selectedShippingOption.value === 'delivery')

  // Shipping Logic
  const shippingOptions = computed(() => {
    const options = [{ title: 'Pickup', value: 'pickup' }]
    if (!event.value?.config?.disableDelivery) {
      options.unshift({ title: 'Delivery', value: 'delivery' })
    }
    return options
  })

  // Dynamic Payment Methods
  const availablePaymentMethods = computed(() => {
    const methods = []
    
    // If event/config not loaded yet, return empty to avoid defaults
    if (!event.value || !event.value.config) return methods

    // Handle both array and potential legacy formats
    // Do NOT default to stripe here, rely strictly on what's in config
    const configMethods = event.value?.config?.paymentMethods || []

    if (configMethods.includes('stripe')) {
      methods.push({ 
        value: 'stripe', 
        label: 'Credit / Debit Card', 
        desc: 'Secure payment via Stripe', 
        icon: 'mdi-credit-card', 
        color: 'primary' 
      })
    }

    // Support both 'om' (from config) and 'orange_money' (legacy/checkout internal)
    if (configMethods.includes('om') || configMethods.includes('orange_money')) {
      methods.push({ 
        value: 'orange_money', 
        label: 'Orange Money', 
        desc: 'Pay with OM mobile wallet', 
        icon: 'mdi-cellphone-check', 
        color: 'orange-darken-2' 
      })
    }

    return methods
  })

  // Auto-select first payment method
  watch(availablePaymentMethods, (newMethods) => {
    // If we have methods available
    if (newMethods.length > 0) {
       // If no method selected, OR current selection is not in the new list (e.g. config changed or loaded)
       const currentValid = newMethods.find(m => m.value === selectedPaymentMethod.value)
       if (!selectedPaymentMethod.value || !currentValid) {
         selectedPaymentMethod.value = newMethods[0].value
       }
    } else {
      // No methods available, clear selection
      selectedPaymentMethod.value = null
    }
  }, { immediate: true })

  // Helper for cart consistency
  function getCartHash () {
    return `${JSON.stringify(selectedTickets.value)}|${JSON.stringify(selectedProducts.value)}`
  }

  // Core Logic
  async function initializeCheckout (silent = false, targetStep = 3) {
    if (!selectedPaymentMethod.value) return
    if (!silent && (isFreeOrder.value || !hasCheckoutItems.value)) return

    // Ensure we are on Step 3 for payment components to show (unless silent)
    if (!silent) checkoutStep.value = targetStep

    try {
      isProcessingPayment.value = true
      const requestData = {
        gateway: selectedPaymentMethod.value, // Use selected payment method
        attendees: attendees.value,
        selectedTickets: selectedTickets.value,
        selectedProducts: selectedProducts.value,
        registration: registration.value,
        eventId: event.value?.id,
        sessionId: sessionId.value || undefined,
      }

      const res = await $axios.post('/payment/init', requestData)
      if (res.data?.payload) {
        // Handle Stripe response
        if (res.data.payload.clientSecret) {
          clientSecret.value = res.data.payload.clientSecret
          paymentGateway.value = 'stripe'
        }
        // Handle Orange Money response
        if (res.data.payload.paymentUrl) {
          paymentUrl.value = res.data.payload.paymentUrl
          clientSecret.value = 'orange_money_ready' // Flag to show OM component
          paymentGateway.value = 'orange_money'
        }
        
        sessionId.value = res.data.payload.sessionId
        transactionId.value = res.data.payload.transactionId
        localStorage.setItem('tempSessionId', sessionId.value)
        localStorage.setItem('cartHash', getCartHash())
      }
    } catch (error) {
      console.error('[Checkout] Init failed:', error)
      store.commit('addSnackbar', { text: 'Failed to initialize payment', color: 'error' })
    } finally {
      isProcessingPayment.value = false
    }
  }

  async function handlePayment () {
    if (isFreeOrder.value) return handleFreeRegistration()
    if (!paymentComponent.value) return

    isProcessingPayment.value = true
    const successUrl = `${window.location.origin}/${route.params.slug}/success?session_id=${sessionId.value}`

    try {
      await paymentComponent.value.processPayment(successUrl)
    } catch (error) {
      console.error('[Checkout] Payment failed:', error)
      isProcessingPayment.value = false
    }
  }

  async function handleFreeRegistration () {
    try {
      isProcessingPayment.value = true
      const registrationData = {
        attendees: attendees.value,
        selectedTickets: selectedTickets.value,
        selectedProducts: selectedProducts.value || [],
        registration: {
          ...registration.value,
          userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          timezoneOffset: new Date().getTimezoneOffset(),
        },
        eventId: event.value.id,
        sessionId: sessionId.value || undefined,
      }

      const res = await $axios.post('/registration/complete-free-registration', registrationData)
      if (res.data.payload?.registrationId) {
        store.dispatch('checkout/clearCheckout')
        router.push({
          name: 'event-register-success-slug',
          params: { slug: route.params.slug },
          query: { registrationId: res.data.payload.registrationId },
        })
      }
    } catch (error) {
      console.error('Free registration failed:', error)
    } finally {
      isProcessingPayment.value = false
    }
  }

  // Helper to save temp registration (moved out of free registration)
  async function saveTempRegistrationForFreeOrder () {
    try {
      const currentSessionId = sessionId.value
      const orders = {
        orderNumber: registration.value?.orderNumber,
        totalAmount: 0,
        currency: eventCurrency.value,
        paymentStatus: 'free',
        subtotal: 0,
        taxAmount: 0,
        eventId: event.value.id,
      }

      // Prepare data for temp registration
      const tempRegData = {
        sessionId: currentSessionId,
        attendees: attendees.value,
        registration: registration.value,
        selectedTickets: selectedTickets.value,
        selectedProducts: selectedProducts.value || [],
        eventId: event.value.id,
        orders: orders, // Include order data structure for consistency
      }

      // Save to backend
      await $axios.post('/temp-registration/store', tempRegData, {
        headers: { 'X-Suppress-Toast': 'true' },
      })
    } catch (error) {
      // Log but don't fail - this is for tracking purposes
      console.warn('[Checkout] Failed to save temp registration for free order:', error)
    }
  }

  // Fetch temp registration data from session query parameter (from abandoned cart email)
  async function loadTempRegistrationFromSession (sessionIdParam) {
    try {
      if (!sessionIdParam) return false

      const response = await $axios.get(`/temp-registration/get/${sessionIdParam}`, {
        headers: { 'X-Suppress-Toast': 'true' },
      })

      if (response.data?.payload) {
        const tempData = response.data.payload

        // Validate eventId matches current event (if event is loaded)
        // Backend converts snake_case to camelCase automatically via db.js
        const sessionEventId = tempData.eventId
        if (event.value && event.value.id && sessionEventId && sessionEventId !== event.value.id) {
          console.warn('[Checkout] Session event ID does not match current event', {
            sessionEventId,
            currentEventId: event.value.id,
          })
          store.commit('addSnackbar', {
            text: 'This checkout link is for a different event. Please select tickets for this event.',
            color: 'warning',
          })
          return false
        }

        // Parse JSONB fields if they're strings (backend converts snake_case to camelCase)
        const selectedTickets = tempData.selectedTickets
        const selectedProducts = tempData.selectedProducts
        const attendees = tempData.attendees
        const registration = tempData.registration

        // Parse if strings, otherwise use as-is
        const tickets = Array.isArray(selectedTickets)
          ? selectedTickets
          : (selectedTickets ? JSON.parse(selectedTickets) : [])

        const products = Array.isArray(selectedProducts)
          ? selectedProducts
          : (selectedProducts ? JSON.parse(selectedProducts) : [])

        const attendeesData = Array.isArray(attendees)
          ? attendees
          : (attendees ? JSON.parse(attendees) : [])

        const registrationData = registration && typeof registration === 'object'
          ? registration
          : (registration ? JSON.parse(registration) : null)

        // Only populate if we have valid data
        if (tickets.length > 0 || products.length > 0) {
          // Update localStorage
          localStorage.setItem('selectedTickets', JSON.stringify(tickets))
          localStorage.setItem('selectedProducts', JSON.stringify(products))

          if (attendeesData.length > 0) {
            localStorage.setItem('attendeesData', JSON.stringify(attendeesData))
          }

          if (registrationData) {
            localStorage.setItem('registrationData', JSON.stringify(registrationData))
          }

          // Store sessionId and generate cart hash
          sessionId.value = sessionIdParam
          localStorage.setItem('tempSessionId', sessionIdParam)
          const cartHash = `${JSON.stringify(tickets)}|${JSON.stringify(products)}`
          localStorage.setItem('cartHash', cartHash)

          // Trigger reactivity for computed properties
          triggerLocalStorageUpdate()

          console.log('[Checkout] Successfully loaded temp registration data into localStorage', {
            tickets: tickets.length,
            products: products.length,
            attendees: attendeesData.length,
          })
          return true
        } else {
          console.warn('[Checkout] Temp registration data found but no tickets/products')
          return false
        }
      }

      return false
    } catch (error) {
      console.error('[Checkout] Error loading temp registration data:', error)
      // Don't show error to user if session not found - just proceed normally
      if (error.response?.status === 404) {
        console.log('[Checkout] Session not found or expired, proceeding with normal flow')
      }
      return false
    }
  }

  import { usePaymentResilience } from '@/composables/usePaymentResilience'

  const { paidSession, checkAndCleanupSession, clearRegistrationLocalData, goToSuccess } = usePaymentResilience()

  onMounted(async () => {
    try {
      // Load event data first
      const slug = route.params.slug
      if (slug && (!event.value || !event.value.id)) {
        await store.dispatch('event/setEventBySlug', { slug })
      }

      // Check if this session is already paid (background resilience check)
      await checkAndCleanupSession(slug, true)

      // If already paid, we don't need to initialize stripe/om immediately
      if (paidSession.value) {
        console.log('[Checkout] Paid session detected. Showing recovery banner.')
        return
      }

      // Check if there's a session query parameter (from abandoned cart email)
      const sessionQueryParam = route.query.session || route.query.session_id
      let loadedFromSession = false

      if (sessionQueryParam) {
        // Try to load temp registration data from session
        loadedFromSession = await loadTempRegistrationFromSession(sessionQueryParam)
        if (loadedFromSession) {
          // Computed properties are already updated via triggerLocalStorageUpdate()
          // Wait one tick for template to update
          await nextTick()

          // Remove session query param from URL to clean it up
          router.replace({ query: { ...route.query, session: undefined, session_id: undefined } })
        }
      }

      // DO NOT auto-initialize. Let the user use the stepper.
      // If loaded from session, we might want to skip to a specific step, but let's stay on 1 for safety.
    } catch (error) {
      console.error('Error in checkout onMounted:', error)
      store.commit('addSnackbar', {
        text: 'Failed to initialize checkout. Please try again.',
        color: 'error',
      })
    }
  })

  onUnmounted(() => {
  // Logic for cleaning up any page-level state if needed
  })
  async function handleApplyPromoCode () {
    if (!promoCodeInput.value) return

    try {
      isApplyingPromoCode.value = true

      // Ensure we have a session/transaction before applying promo
      if (!transactionId.value || !sessionId.value) {
        if (!selectedPaymentMethod.value) {
          // Default to stripe if none selected yet, just to get a session
          selectedPaymentMethod.value = 'stripe'
        }
        await initializeCheckout(true)
      }

      if (!transactionId.value || !sessionId.value) {
        throw new Error('Failed to create payment session')
      }

      const response = await $axios.post('/payment/apply-promo', {
        transactionId: transactionId.value,
        promoCode: promoCodeInput.value,
        sessionId: sessionId.value,
        eventId: event.value?.id,
        gateway: paymentGateway.value,
      })

      if (response.data?.payload) {
        const payload = response.data.payload
        appliedPromoCodeDetails.value = {
          promoCode: payload.promoCode,
          discountType: payload.discountType,
          discountValue: payload.discountValue,
        }
        promoDiscountAmount.value = payload.discountAmount
        promoNewTaxAmount.value = payload.newTaxAmount
        promoNewTotalAmount.value = payload.newTotal

      // Update Stripe elements with new client secret (if backend updated it/amount)
      // Actually stripe.elements doesn't always need new clientSecret if amount updated on backend PI
      // but we should call elements.update if we want to be safe, though amount is hidden from Elements UI usually
      }
    } catch (error) {
      console.error('Failed to apply promo code:', error)
    } finally {
      isApplyingPromoCode.value = false
    }
  }

  function removePromoCode () {
    appliedPromoCodeDetails.value = null
    promoDiscountAmount.value = 0
    promoNewTaxAmount.value = null
    promoNewTotalAmount.value = null
    promoCodeInput.value = ''

    // To truly "remove" it from Stripe PI, we'd need another backend call
    // For now, let's just trigger a re-initialization or update if shipping is saved
    if (isShippingOptionSaved.value) {
      initializeCheckout(true)
    } else {
      initializeCheckout(true)
    }
  }

  async function saveShippingOption () {
    isShippingOptionSaved.value = true
    await initializeCheckout(true)
  }

  function updatePaymentIntentWithShipping () {
    // This is now handled by initializeCheckout
    initializeCheckout(true)
  }

</script>
<template>
  <section class="section section-fade">
    <v-container>
      <PageTitle
        :back-route="{ name: 'tickets-slug', params: { slug: route.params.slug } }"
        :compact="true"
        :show-back-button="true"
        :subtitle="event?.name"
        title="Checkout"
      />

      <!-- Paid Session Recovery Banner -->
      <v-alert
        v-if="paidSession"
        class="mb-6"
        color="success"
        elevation="4"
        icon="mdi-check-decagram"
        prominent
        variant="elevated"
      >
        <div class="d-flex flex-column flex-sm-row align-sm-center justify-space-between">
          <div>
            <h3 class="text-h6 font-weight-bold mb-1">Booking Already Successful!</h3>
            <p class="text-body-2">We found a completed booking for this session. You can view your tickets now or start a new booking if this wasn't you.</p>
          </div>
          <div class="mt-3 mt-sm-0 d-flex gap-2">
            <v-btn
              color="white"
              density="comfortable"
              theme="light"
              variant="flat"
              @click="goToSuccess(route.params.slug)"
            >
              View Tickets
            </v-btn>
            <v-btn
              color="white"
              density="comfortable"
              theme="light"
              variant="outlined"
              @click="clearRegistrationLocalData"
            >
              Dismiss
            </v-btn>
          </div>
        </div>
      </v-alert>

      <!-- Empty Cart Alert -->
      <v-row v-if="!hasCheckoutItems" justify="center">
        <v-col cols="auto">
          <v-card
            class="empty-cart-card"
            elevation="4"
            :rounded="rounded"
          >
            <v-card-text class="text-center pa-8">
              <v-icon
                class="mb-4"
                color="warning"
                size="64"
              >
                mdi-cart-off
              </v-icon>
              <h3 class="text-h5 mb-2">
                Your Cart is Empty
              </h3>
              <p class="text-body-1 text-medium-emphasis mb-6">
                You don't have any tickets or products in your cart. Please select items to continue with checkout.
              </p>
              <v-btn
                color="primary"
                :rounded="rounded"
                :size="size"
                variant="elevated"
                @click="router.push({ name: 'event-landing-slug', params: { slug: route.params.slug } })"
              >
                <v-icon left>
                  mdi-account-plus
                </v-icon>
                Go to Registration
              </v-btn>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Checkout Content (only show if items exist) -->
      <template v-else>
        <v-row>
          <!-- Order Summary (Sticky Sidebar) -->
          <v-col
            class="order-summary-col"
            cols="12"
            md="4"
          >
            <v-card
              class="order-summary-card"
              elevation="4"
            >
              <v-card-title class="text-h5 pa-4">
                <v-icon left>mdi-cart</v-icon>
                Order Summary
              </v-card-title>

              <v-card-text class="pa-4">
                <!-- Order Items -->
                <div v-if="selectedTickets?.length">
                  <div v-for="item in selectedTickets" :key="item.ticketId" class="order-item">
                    <div class="d-flex justify-space-between align-center">
                      <div>
                        <div class="d-flex align-center gap-2 mb-1">
                          <v-chip color="primary" size="x-small" variant="flat">Ticket</v-chip>
                          <div class="text-subtitle-2 font-weight-medium">{{ item.title }}</div>
                        </div>
                        <div class="text-caption text-medium-emphasis">Qty: {{ item.quantity }}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-subtitle-2 font-weight-bold">{{ formatPrice(item.price * item.quantity, eventCurrency) }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Products -->
                <div v-if="selectedProducts?.length">
                  <div v-for="item in selectedProducts" :key="`product-${item.id}`" class="order-item">
                    <div class="d-flex justify-space-between align-center">
                      <div>
                        <div class="d-flex align-center gap-2 mb-1">
                          <v-chip color="secondary" size="x-small" variant="flat">Product</v-chip>
                          <div class="text-subtitle-2 font-weight-medium">{{ item.name }}</div>
                        </div>
                        <div class="text-caption text-medium-emphasis">Qty: {{ item.quantity }}</div>
                      </div>
                      <div class="text-right">
                        <div class="text-subtitle-2 font-weight-bold">{{ formatPrice(item.price * item.quantity, eventCurrency) }}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <v-divider class="my-3" />
                <div class="d-flex justify-space-between text-body-2 mb-1">
                  <span class="text-medium-emphasis">Subtotal</span>
                  <span>{{ formatPrice(subtotalAmount, eventCurrency) }}</span>
                </div>
                <!-- Promo Discount -->
                <div v-if="appliedPromoCodeDetails" class="d-flex justify-space-between text-body-2 mb-1 text-success font-weight-medium">
                  <span>Discount ({{ appliedPromoCodeDetails.promoCode }})</span>
                  <span>-{{ formatPrice(promoDiscountAmount, eventCurrency) }}</span>
                </div>
                <div v-if="calculatedShippingCost > 0" class="d-flex justify-space-between text-body-2 mb-1">
                  <span class="text-medium-emphasis">Shipping</span>
                  <span>{{ formatPrice(calculatedShippingCost, eventCurrency) }}</span>
                </div>
                <div v-if="taxAmount > 0" class="d-flex justify-space-between text-body-2 mb-1">
                  <span class="text-medium-emphasis">Tax</span>
                  <span>{{ formatPrice(taxAmount, eventCurrency) }}</span>
                </div>
                <v-divider class="my-3" />
                <div class="d-flex justify-space-between align-center">
                  <span class="text-h6 font-weight-bold">Total</span>
                  <span class="text-h5 font-weight-bold text-primary">{{ formatPrice(totalAmount, eventCurrency) }}</span>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <!-- Stepped Checkout -->
          <v-col cols="12" md="8">
            <v-stepper-vertical
              v-model="checkoutStep"
              vertical
              hide-actions
              class="rounded-xl border shadow-sm"
              flat
              color="primary"
        variant="inset"
            >
              <!-- Step 1: Order Details -->
              <v-stepper-vertical-item
                :complete="checkoutStep > 1"
                title="Order Options"
                value="1"
              >
                <div>
                  
                  <!-- Shipping (Condition on Products) -->
                  <div v-if="selectedProducts?.length" class="mb-6">
                    <div class="d-flex align-center mb-3">
                      <v-icon color="primary" class="mr-2">mdi-truck-delivery-outline</v-icon>
                      <span class="text-subtitle-2 font-weight-bold">Shipping Selection</span>
                    </div>
                    <v-select
                      v-model="selectedShippingOption"
                      :items="shippingOptions"
                      label="Shipping Method"
                      :rounded="rounded"
                      variant="outlined"
                      bg-color="surface"
                      class="mb-2"
                      hide-details
                      :disabled="checkoutStep > 1"
                    />
                    <v-alert v-if="selectedShippingOption === 'pickup'" type="info" variant="tonal" class="mt-3 text-caption">
                      <strong>Pickup:</strong> {{ event?.location || 'Event Venue' }}
                    </v-alert>
                  </div>

                  <!-- Promo Code -->
                  <div class="mb-6">
                    <div class="d-flex align-center mb-3">
                      <v-icon color="primary" class="mr-2">mdi-tag-outline</v-icon>
                      <span class="text-subtitle-2 font-weight-bold">Promo Code</span>
                    </div>
                    
                    <div v-if="!appliedPromoCodeDetails" class="d-flex gap-2">
                      <v-text-field
                        v-model="promoCodeInput"
                        placeholder="Enter promo code"
                        variant="outlined"
                        density="comfortable"
                        hide-details
                        :rounded="rounded"
                        :disabled="checkoutStep > 1"
                        @keydown.enter="handleApplyPromoCode"
                      >
                        <template #append-inner>
                          <v-btn 
                            color="secondary" 
                            variant="text" 
                            :loading="isApplyingPromoCode"
                            :disabled="!promoCodeInput || checkoutStep > 1"
                            :rounded="rounded"
                            icon="mdi-check"
                            @click="handleApplyPromoCode"
                          />
                        </template>
                      </v-text-field>
                    </div>
                    <div v-else class="applied-promo-premium pa-3 rounded-lg d-flex justify-space-between align-center">
                      <div class="d-flex align-center gap-2 text-success">
                        <v-icon>mdi-check-decagram</v-icon>
                        <span class="font-weight-bold">{{ appliedPromoCodeDetails.promoCode }} Applied</span>
                      </div>
                      <v-btn icon="mdi-close" size="x-small" variant="text" @click="removePromoCode" :disabled="checkoutStep > 1" />
                    </div>
                  </div>

                  <v-btn 
                    color="primary" 
                    :size="size" 
                    :variant="variant" 
                    :rounded="rounded"
                    class="mt-1 font-weight-bold"
                    block
                    @click="checkoutStep = 2"
                  >
                    Continue to Payment Method
                    <v-icon end>mdi-arrow-right</v-icon>
                  </v-btn>
                </div>
              </v-stepper-vertical-item>

              <!-- Step 2: Payment Method Selection -->
              <v-stepper-vertical-item
                :complete="checkoutStep > 2"
                title="Payment Method"
                value="2"
              >
                <div>
                  <div class="text-subtitle-1 font-weight-bold mb-4">Choose how to pay</div>
                  
                  <v-radio-group
                    v-model="selectedPaymentMethod"
                    hide-details
                    class="px-0"
                  >
                    <div class="payment-grid">
                      <v-card
                        v-for="method in availablePaymentMethods"
                        :key="method.value"
                        :class="['payment-method-card', { 'active': selectedPaymentMethod === method.value }]"
                        variant="outlined"
                        @click="selectedPaymentMethod = method.value"
                      >
                        <div class="d-flex align-center pa-4">
                          <v-radio :value="method.value" color="primary" class="ma-0 mr-2" />
                          <v-avatar :color="method.color" size="40" variant="tonal" class="mr-3">
                            <v-icon :color="method.color" size="20">{{ method.icon }}</v-icon>
                          </v-avatar>
                          <div class="flex-grow-1">
                            <div class="text-subtitle-2 font-weight-bold">{{ method.label }}</div>
                          </div>
                        </div>
                      </v-card>
                    </div>
                  </v-radio-group>

                  <div class="d-flex gap-2 mt-8 align-center">
                    <v-btn 
                      icon="mdi-arrow-left" 
                      variant="text" 
                      @click="checkoutStep = 1"
                      :rounded="rounded"
                    />
                    <v-btn 
                      color="primary" 
                      :size="size" 
                      :variant="variant" 
                      :rounded="rounded"
                      class="flex-grow-1 font-weight-bold"
                      :disabled="!selectedPaymentMethod"
                      @click="initializeCheckout()"
                    >
                      Process Payment ({{ formatPrice(totalAmount, eventCurrency) }})
                    </v-btn>
                  </div>
                </div>
              </v-stepper-vertical-item>

              <!-- Step 3: Complete Payment -->
              <v-stepper-vertical-item
                title="Complete Payment"
                value="3"
              >
                <div class="py-4">
                  <div v-if="isProcessingPayment && !clientSecret" class="text-center py-8">
                    <v-progress-circular indeterminate color="primary" size="48" />
                    <p class="mt-4 text-medium-emphasis">Preparing your secure payment session...</p>
                  </div>

                  <template v-else-if="clientSecret">
                    <PaymentStripe
                      v-if="paymentGateway === 'stripe'"
                      ref="paymentComponent"
                      :client-secret="clientSecret"
                      :customer-name="registration ? `${registration.firstName} ${registration.lastName}` : ''"
                      :requires-address="requiresShippingAddress"
                      :stripe-public-key="stripePublic"
                      @error="store.commit('addSnackbar', { text: $event, color: 'error' })"
                      @loaded="paymentElementLoaded = true"
                      @processing="isProcessingPayment = $event"
                    />
                    <PaymentOrangeMoney
                      v-else-if="paymentGateway === 'orange_money'"
                      ref="paymentComponent"
                      :session-id="sessionId"
                      :total-amount="totalAmount"
                      :currency="event?.currency || 'USD'"
                      :payment-url="paymentUrl"
                      @error="store.commit('addSnackbar', { text: $event, color: 'error' })"
                      @loaded="paymentElementLoaded = true"
                      @processing="isProcessingPayment = $event"
                    />

                    <div class="d-flex gap-2 mt-6 align-center">
                      <v-btn 
                        icon="mdi-arrow-left" 
                        variant="text" 
                        @click="checkoutStep = 2"
                        :disabled="isProcessingPayment"
                        :rounded="rounded"
                      />
                      <v-btn
                        class="flex-grow-1 font-weight-bold"
                        color="primary"
                        :size="size"
                        :variant="variant"
                        :rounded="rounded"
                        :loading="isProcessingPayment"
                        @click="handlePayment"
                      >
                        <v-icon start>mdi-lock-outline</v-icon>
                        Complete Purchase
                      </v-btn>
                    </div>

                    <!-- Powered by Stripe Branding -->
                    <v-fade-transition>
                      <div v-if="paymentGateway === 'stripe'" class="mt-6 d-flex justify-center">
                        <v-img
                          src="/stripe.svg"
                          max-width="120"
                          alt="Powered by Stripe"
                          class="opacity-60"
                        />
                      </div>
                    </v-fade-transition>
                  </template>
                </div>
              </v-stepper-vertical-item>
            </v-stepper-vertical>
          </v-col>
        </v-row>
      </template>
    </v-container>
  </section>
</template>

<style scoped>
.checkout-container {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  padding: 24px;
}

.checkout-card {
  border-radius: 16px;
  overflow: hidden;
}

.order-summary-card {
  border-radius: 16px;
  overflow: hidden;
  height: fit-content;
  position: sticky;
  top: 24px;
}

.order-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
}

.order-item:last-child {
  border-bottom: none;
}

.registration-info {
  background: rgba(0, 0, 0, 0.02);
  padding: 12px;
  border-radius: 8px;
}

.registration-info .text-body-2 {
  margin-bottom: 4px;
}

.registration-info .text-body-2:last-child {
  margin-bottom: 0;
}

.payment-btn {
  border-radius: 12px;
  text-transform: none;
  font-weight: 500;
  height: 56px;
  margin-top: 13px;
}

#payment-element {
  margin-bottom: 24px;
}

/* Payment Loading State */
.payment-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  min-height: 200px;
  background: rgba(var(--v-theme-surface-variant-rgb), 0.3);
  border-radius: 12px;
  border: 1px dashed rgba(var(--v-theme-outline-rgb), 0.3);
}

/* Payment Error State */
.payment-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  min-height: 200px;
}

/* Stripe Element Theme Integration */
#payment-element .p-Input {
  border-radius: 12px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

#payment-element .p-Input:focus {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
}

#payment-element .p-Label {
  font-weight: 500 !important;
  letter-spacing: 0.5px !important;
}

#payment-element .p-Tab {
  border-radius: 8px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

#payment-element .p-Tab:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1) !important;
}

#payment-element .p-Tab--selected {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2) !important;
}

/* Stripe Payment Element Responsiveness */
#payment-element {
  width: 100%;
  min-height: 200px;
}

/* Shipping Card Styles */
.shipping-card {
  border-radius: 12px;
}

.shipping-card .v-card-title {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary-rgb), 0.1), rgba(var(--v-theme-secondary-rgb), 0.1));
  border-bottom: 1px solid rgba(var(--v-theme-outline-rgb), 0.2);
}

/* Payment Card Styles */
.checkout-card .v-card-title {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary-rgb), 0.1), rgba(var(--v-theme-secondary-rgb), 0.1));
  border-bottom: 1px solid rgba(var(--v-theme-outline-rgb), 0.2);
}

#shipping-address-element {
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-outline-rgb), 0.3);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 200px; /* Ensure enough space for all fields including postal code */
}

#shipping-address-element:focus-within {
  border-color: rgb(var(--v-theme-primary));
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary-rgb), 0.2);
}

/* Stripe Address Element styling */
#shipping-address-element .p-Input {
  border-radius: 8px !important;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

#shipping-address-element .p-Input:focus {
  border-color: rgb(var(--v-theme-primary)) !important;
  box-shadow: 0 0 0 2px rgba(var(--v-theme-primary-rgb), 0.2) !important;
}

#shipping-address-element .p-Label {
  font-weight: 500 !important;
  color: rgba(var(--v-theme-on-surface-rgb), 0.87) !important;
}

/* Mobile Responsive Styles */
@media (max-width: 768px) {
  .checkout-container {
    padding: 16px;
    align-items: flex-start;
    min-height: auto;
  }

  .order-summary-col {
    order: 1;
  }

  .shipping-form-col {
    order: 2;
  }

  .payment-form-col {
    order: 3;
  }

  .order-summary-card {
    position: static;
    margin-bottom: 24px;
  }

  .checkout-card .v-card-title {
    font-size: 1.5rem !important;
    padding: 16px !important;
  }

  .checkout-card .v-card-text {
    padding: 16px !important;
  }

  .order-summary-card .v-card-title {
    font-size: 1.25rem !important;
    padding: 16px !important;
  }

  .order-summary-card .v-card-text {
    padding: 16px !important;
  }

  .payment-btn {
    height: 48px !important;
    font-size: 0.875rem !important;
  }

  #payment-element {
    min-height: 180px;
    margin-bottom: 20px;
  }

  /* Mobile Stripe Element Styling */
  #payment-element .p-Input {
    font-size: 16px !important; /* Prevent zoom on iOS */
    padding: 12px !important;
  }

  #payment-element .p-Tab {
    padding: 12px 16px !important;
    font-size: 14px !important;
  }

  /* Improve touch targets */
  .order-item {
    padding: 16px 0;
  }

  .attendee-info .text-body-2 {
    padding: 4px 0;
  }
}

@media (max-width: 480px) {
  .checkout-container {
    padding: 12px;
  }

  .checkout-card .v-card-title {
    font-size: 1.25rem !important;
    padding: 12px !important;
  }

  .checkout-card .v-card-text {
    padding: 12px !important;
  }

  .order-summary-card .v-card-title {
    font-size: 1.125rem !important;
    padding: 12px !important;
  }

  .order-summary-card .v-card-text {
    padding: 12px !important;
  }

  .order-item {
    padding: 8px 0;
  }

  .text-h6 {
    font-size: 1.125rem !important;
  }

  .text-subtitle-2 {
    font-size: 0.875rem !important;
  }

  .text-body-2 {
    font-size: 0.875rem !important;
  }

  .payment-btn {
    height: 44px !important;
    font-size: 0.8125rem !important;
  }

  .attendee-info .text-body-2 {
    font-size: 0.8125rem !important;
    line-height: 1.4;
  }

  #payment-element {
    min-height: 160px;
    margin-bottom: 16px;
  }

  /* Extra small screens Stripe styling */
  #payment-element .p-Input {
    font-size: 16px !important;
    padding: 10px !important;
    border-radius: 8px !important;
  }

  #payment-element .p-Tab {
    padding: 10px 12px !important;
    font-size: 13px !important;
    border-radius: 6px !important;
  }

  #payment-element .p-Label {
    font-size: 13px !important;
  }

  /* Ensure minimum touch target size */
  .payment-btn {
    min-height: 44px !important;
  }

  .order-item {
    min-height: 44px !important;
    display: flex !important;
    align-items: center !important;
  }
}
.bg-surface-variant-light {
  background: rgba(var(--v-theme-surfaceVariant), 0.2);
}

.applied-promo-premium {
  background: rgba(var(--v-theme-primary), 0.05);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
}

.letter-spacing-1 {
  letter-spacing: 1px;
}

.line-height-1 {
  line-height: 1;
}

.gap-3 {
  gap: 12px;
}

.payment-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;
  width: 100%;
}

.payment-method-card {
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 12px !important;
  border: 2px solid transparent !important;
  background: rgba(var(--v-theme-surface), 0.5) !important;
}

.payment-method-card:hover {
  transform: translateY(-2px);
  background: rgba(var(--v-theme-surface), 1) !important;
  border-color: rgba(var(--v-theme-primary), 0.2) !important;
}

.payment-method-card.active {
  border-color: rgb(var(--v-theme-primary)) !important;
  background: rgba(var(--v-theme-primary), 0.04) !important;
}

.payment-method-card :deep(.v-radio) {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0; /* Just using card click */
}

@media (max-width: 600px) {
  .payment-grid {
    grid-template-columns: 1fr;
  }
}
</style>
