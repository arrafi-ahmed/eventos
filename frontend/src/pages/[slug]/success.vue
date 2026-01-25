<script setup>
  import QRCodeVue3 from 'qrcode-vue3'

  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import DigitalTicketCard from '@/components/ticket/DigitalTicketCard.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatPrice } from '@/utils'
  import { isGroupTicket as checkIsGroupTicket, getQrTitle } from '@/utils/ticketUtils'

  definePage({
    name: 'event-register-success-slug',
    meta: {
      layout: 'default',
      title: 'Registration Successful',
    },
  })

  const route = useRoute()
  const router = useRouter()
  const theme = useTheme()
  const store = useStore()

  const { rounded, size, variant, density } = useUiProps()

  const isLoading = ref(true)
  const error = ref(null)
  const tempRegistration = ref(null)
  const showSuccessContent = ref(false)

  const sessionId = computed(() => route.query.session_id)
  const registrationId = computed(() => route.query.registration_id)

  function clearRegistrationLocalStorage () {
    try {
      // Clear all registration and checkout-related data
      const keysToRemove = [
        'attendeesData',
        'registrationData',
        'selectedTickets',
        'selectedProducts',
        'tempSessionId',
        'cartHash',
        'isCheckoutExist',
        'totalAmount',
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
    } catch (error) {
      console.warn('Failed to clear registration localStorage:', error)
    }
  }

  // Get ticket information for a specific attendee
  function getAttendeeTicket (attendee) {
    if (!tempRegistration.value?.selectedTickets || !attendee.ticketId) {
      return null
    }

    // Find the ticket that matches this attendee's ticketId
    return tempRegistration.value.selectedTickets.find(
      ticket => ticket.ticketId === attendee.ticketId,
    )
  }

  async function fetchTempRegistration () {
    try {
      isLoading.value = true
      error.value = null

      // Handle free registration (registration_id + attendee_ids + qr_uuids) or paid registration (session_id)
      if (registrationId.value) {
        const attendeeIds = route.query.attendee_ids?.split(',') || []
        const qrUuids = route.query.qr_uuids?.split(',') || []

        // For free registrations with multiple attendees, we need to validate each attendee
        if (attendeeIds.length > 0 && qrUuids.length > 0) {
          // Fetch complete free registration data using the new endpoint
          const response = await $axios.get(`/registration/getFreeRegistrationConfirmation`, {
            params: {
              registrationId: registrationId.value,
            },
            headers: { 'X-Suppress-Toast': 'true' },
          })

          if (response.data.payload) {
            // Validate that all attendees exist and have matching QR UUIDs
            const attendees = response.data.payload.attendees || []
            const validAttendees = attendees.filter(
              attendee =>
                attendeeIds.includes(attendee.id.toString()) && qrUuids.includes(attendee.qrUuid),
            )

            if (validAttendees.length === attendeeIds.length) {
              // Transform the data to match the expected format
              const selectedTickets = validAttendees.map(attendee => ({
                ticketId: attendee.ticketId,
                title: attendee.ticketTitle || 'Unknown Ticket',
                price: attendee.price || 0, // Use real price from backend
                quantity: 1,
              }))

              // Use the complete data structure from the new endpoint
              tempRegistration.value = {
                attendees: validAttendees,
                selectedTickets: selectedTickets,
                orders: response.data.payload.order,
                registration: response.data.payload.registration,
                event: response.data.payload.event,
                eventId: response.data.payload.registration?.eventId,
              }
            } else {
              store.commit('addSnackbar', {
                text: `QR UUID validation failed. Expected ${attendeeIds.length} attendees, found ${validAttendees.length} valid.`,
                color: 'error',
              })
            }
          }
        } else {
          store.commit('addSnackbar', { text: 'Invalid registration data. Please contact support.', color: 'error' })
        }
      } else if (sessionId.value) {
        // Fallback: check localStorage if session_id not in URL
        if (!sessionId.value) {
          const storedSessionId = localStorage.getItem('tempSessionId')
          if (storedSessionId) {
            sessionId.value = storedSessionId
          }
        }

        if (!sessionId.value) {
          error.value = 'No session ID provided. Please ensure you completed the payment process.'
          return
        }

        const response = await $axios.get(`/temp-registration/success/${sessionId.value}`, {
          headers: { 'X-Suppress-Toast': 'true' },
        })
        // Ensure event config is included
        tempRegistration.value = {
          ...response.data.payload,
          event: response.data.payload.event || null,
        }
      } else {
        error.value
          = 'No registration information provided. Please ensure you completed the registration process.'
        return
      }

      // Clear registration-related localStorage after successful fetch
      clearRegistrationLocalStorage()

      // Also clear Vuex store to prevent pre-selected items on next visit
      store.dispatch('checkout/clearCheckout')

      // Show content with a slight delay for better UX
      setTimeout(() => {
        showSuccessContent.value = true
      }, 100)
    } catch (error_) {
      error.value = error_.response?.data?.message || 'Failed to load registration details'
    } finally {
      isLoading.value = false
    }
  }

  function retryFetch () {
    fetchTempRegistration()
  }

  function goToHome () {
    router.push('/')
  }

  onMounted(() => {
    fetchTempRegistration()
  })

  // Derive all purchased items (tickets + products) from selectedTickets and selectedProducts
  const purchasedItems = computed(() => {
    const allItems = []

    // Get tickets from selectedTickets
    const tickets = tempRegistration.value?.selectedTickets || []
    for (const item of tickets) {
      allItems.push({
        id: item.ticketId,
        name: item.title,
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        ticketId: item.ticketId,
      })
    }

    // Get products from selectedProducts
    const products = tempRegistration.value?.selectedProducts || []
    for (const item of products) {
      allItems.push({
        id: item.productId || item.id,
        name: item.name || item.title, // Use name for products
        price: Number(item.price || 0),
        quantity: Number(item.quantity || 1),
        productId: item.productId || item.id,
      })
    }

    return allItems
  })

  // Calculate total items quantity
  const totalItemsQuantity = computed(() => {
    return purchasedItems.value.reduce((sum, item) => sum + item.quantity, 0)
  })

  // Check if this is a group ticket scenario using utility
  const isGroup = computed(() => {
    return checkIsGroupTicket({
      saveAllAttendeesDetails: tempRegistration.value?.event?.config?.saveAllAttendeesDetails,
      totalQuantity: totalItemsQuantity.value,
    })
  })

  // Calculate subtotal from all purchased items
  const subtotalAmount = computed(() => {
    return purchasedItems.value.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  })

  // Calculate shipping amount
  const shippingAmount = computed(() => {
    // Check if shipping fee exists in order data
    const order = tempRegistration.value?.orders
    if (order?.shippingCost && order.shippingCost > 0) {
      return order.shippingCost
    }
    return 0
  })

  const discountAmount = computed(() => {
    return tempRegistration.value?.orders?.discountAmount || 0
  })

  // Calculate tax amount
  const taxAmount = computed(() => {
    // No tax on free orders
    if (subtotalAmount.value === 0) return 0

    const total = tempRegistration.value?.orders?.totalAmount || 0
    const shipping = shippingAmount.value
    const discount = discountAmount.value
    // Back-calculate tax from total if available, else derive?
    // Actually, taxAmount is usually provided or derived.
    // If we trust total, then tax = total - (subtotal - discount + shipping)
    // Let's use the stored tax from order if available, else calc
    return tempRegistration.value?.orders?.taxAmount ?? (total - (subtotalAmount.value - discount + shipping))
  })

  // Calculate total amount
  const totalAmount = computed(() => {
    // If we have an order total, use it
    if (tempRegistration.value?.orders?.totalAmount) {
      return tempRegistration.value.orders.totalAmount
    }
    return subtotalAmount.value - discountAmount.value + taxAmount.value + shippingAmount.value
  })

  const displayedTotal = computed(() => {
    return Math.max(0, totalAmount.value)
  })

</script>

<template>
  <v-container class="fill-height pa-0">
    <v-row align="center" class="fill-height" justify="center" no-gutters>
      <!-- Loading State -->
      <v-col v-if="isLoading" class="text-center" cols="12">
        <v-progress-circular
          color="primary"
          indeterminate
          size="64"
        />
        <p class="mt-4 text-medium-emphasis">Finalizing registration...</p>
      </v-col>

      <!-- Error State -->
      <v-col
        v-else-if="error"
        cols="12"
        lg="4"
        md="6"
        sm="8"
      >
        <v-card class="text-center pa-8 rounded-xl border-dashed" variant="outlined">
          <v-icon class="mb-4" color="error" size="48">mdi-alert-circle-outline</v-icon>
          <h3 class="text-h5 font-weight-bold mb-2">Something went wrong</h3>
          <p class="text-body-1 text-medium-emphasis mb-6">{{ error }}</p>
          <v-btn color="primary" variant="flat" @click="retryFetch">
            Try Again
          </v-btn>
        </v-card>
      </v-col>

      <!-- Success Content -->
      <v-col
        v-else-if="tempRegistration && showSuccessContent"
        class="pa-4"
        cols="12"
        lg="8"
        md="10"
      >

        <!-- Header Section -->
        <div class="text-center mb-8 d-flex align-center justify-center flex-column">
          <div class="d-flex align-center mb-2">
            <h1 class="text-h4 font-weight-bold">Payment Successful</h1>
            <v-icon class="ml-3" color="success" size="32">mdi-check-circle</v-icon>
          </div>
          <p class="text-body-1 text-medium-emphasis">
            You're all set! We've sent the confirmation to your email.
          </p>
        </div>

        <!-- Stacked Layout: Tickets first, then Summary -->
        <v-col class="mx-auto pa-0" cols="12" style="max-width: 700px;">
          <!-- Tickets -->
          <h2 class="text-h6 font-weight-bold mb-4 d-flex align-center">
            <v-icon class="mr-2" color="primary" size="20">mdi-ticket-confirmation-outline</v-icon>
            Your Tickets
          </h2>

          <div v-for="(attendee, index) in tempRegistration.attendees" :key="index" class="mb-6">
            <DigitalTicketCard
              :attendee="attendee"
              :event-name="tempRegistration.event?.name || 'Event'"
              :location="tempRegistration.event?.location"
              :qr-uuid="attendee.qrUuid"
              :registration-id="registrationId || attendee.registrationId"
              :start-date="tempRegistration.event?.startDatetime || tempRegistration.event?.startDate || tempRegistration.event?.start_datetime"
              :ticket-title="getAttendeeTicket(attendee)?.title || 'Event Entry'"
            />
          </div>

          <!-- Summary -->
          <h2 class="text-h6 font-weight-bold mb-4 d-flex align-center mt-8">
            <v-icon class="mr-2" color="primary" size="20">mdi-receipt-text-outline</v-icon>
            Order Summary
          </h2>

          <v-card :rounded="rounded" variant="flat" class="bg-surface-variant pa-5 mb-8">
            <!-- Order Meta -->
            <div class="d-flex justify-space-between mb-3 text-caption">
              <span class="text-medium-emphasis">Order #{{ tempRegistration.orders.orderNumber }}</span>
              <span class="font-weight-bold">{{ new Date().toLocaleDateString() }}</span>
            </div>

            <v-divider class="mb-4 border-opacity-100" />

            <!-- Items -->
            <div v-for="(item, idx) in purchasedItems" :key="idx" class="d-flex justify-space-between mb-2">
              <div class="d-flex align-center">
                <span class="font-weight-medium text-body-2 mr-2">{{ item.quantity }}x</span>
                <span class="text-body-2 text-medium-emphasis text-truncate" style="max-width: 150px;">
                  {{ item.name }}
                </span>
              </div>
              <span class="text-body-2 font-weight-medium">
                {{ formatPrice(item.price * item.quantity, tempRegistration.orders.currency) }}
              </span>
            </div>

            <v-divider class="mt-4 mb-4 border-opacity-100" />

            <!-- Totals -->
            <div class="d-flex justify-space-between mb-1 text-body-2">
              <span class="text-medium-emphasis">Subtotal</span>
              <span>{{ formatPrice(subtotalAmount, tempRegistration.orders.currency) }}</span>
            </div>

            <div v-if="discountAmount > 0" class="d-flex justify-space-between mb-1 text-body-2 text-success">
              <span class="text-medium-emphasis">Discount</span>
              <span>-{{ formatPrice(discountAmount, tempRegistration.orders.currency) }}</span>
            </div>

            <div v-if="taxAmount > 0" class="d-flex justify-space-between mb-1 text-body-2">
              <span class="text-medium-emphasis">Tax</span>
              <span>{{ formatPrice(taxAmount, tempRegistration.orders.currency) }}</span>
            </div>

            <div v-if="shippingAmount > 0" class="d-flex justify-space-between mb-3 text-body-2">
              <span class="text-medium-emphasis">Shipping</span>
              <span>{{ formatPrice(shippingAmount, tempRegistration.orders.currency) }}</span>
            </div>

            <div class="d-flex justify-space-between align-center mt-4 pt-2 border-t">
              <span class="text-h6 font-weight-bold">Total</span>
              <span class="text-h5 font-weight-bold text-primary">
                {{ formatPrice(displayedTotal, tempRegistration.orders.currency) }}
              </span>
            </div>
          </v-card>

          <div class="text-center">
            <v-btn
              class="font-weight-bold"
              color="primary"
              :rounded="rounded"
              size="large"
              variant="text"
              @click="goToHome"
            >
              <v-icon start>mdi-arrow-left</v-icon>
              Return to Home
            </v-btn>
          </div>
        </v-col>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
/* Vuetify handles most styling, but we add a few utility tweaks */
.border-dashed {
  border-style: dashed !important;
}

/* Ensure consistent borders on responsive layout */
@media (min-width: 600px) {
  .border-e-sm-0 {
    border-right: 0 !important;
  }
}
</style>
