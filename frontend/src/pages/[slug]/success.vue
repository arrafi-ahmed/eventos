<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatPrice } from '@/utils'

  definePage({
    name: 'event-register-success-slug',
    meta: {
      layout: 'default',
      title: 'Registration Successful',
      titleKey: 'pages.tickets.success',
    },
  })

  const route = useRoute()
  const router = useRouter()
  const theme = useTheme()
  const store = useStore()
  const { t } = useI18n()

  const { rounded, size, variant } = useUiProps()

  const isLoading = ref(true)
  const error = ref(null)
  const tempRegistration = ref(null)
  const showSuccessContent = ref(false)

  const sessionId = computed(() => route.query.session_id)

  function clearRegistrationLocalStorage () {
    try {
      const keysToRemove = [
        'attendeesData', 'registrationData', 'selectedTickets', 'selectedProducts',
        'tempSessionId', 'cartHash', 'isCheckoutExist', 'totalAmount',
        'selectedShippingOption', 'shippingAddress',
        'paymentIntentId', 'clientSecret',
      ]
      keysToRemove.forEach(k => localStorage.removeItem(k))
    } catch (e) { console.warn('Local storage cleanup failed', e) }
  }

  async function fetchRegistrationStatus () {
    try {
      isLoading.value = true
      error.value = null

      if (!sessionId.value) {
        error.value = 'No session ID provided. Please ensure you completed the registration process.'
        return
      }

      const response = await $axios.post('/payment/verify-session', {
        sessionId: sessionId.value,
      }, {
        headers: { 'X-Suppress-Toast': 'true' }
      })
      
      const data = response.data?.payload
      if (!data) {
        error.value = 'Failed to retrieve registration data.'
        return
      }

      tempRegistration.value = data
      const status = data.status || data.orders?.paymentStatus

      if (status === 'paid' || status === 'free' || status === 'completed' || data.paid) {
        clearRegistrationLocalStorage()
        store.dispatch('checkout/clearCheckout')
        
        setTimeout(() => { showSuccessContent.value = true }, 100)
      } else if (status === 'pending') {
        showSuccessContent.value = true
      } else if (status === 'failed' || status === 'cancelled' || status === 'expired') {
        router.replace({ name: 'payment-cancel', params: { slug: route.params.slug } })
      } else if (status === 'deleted') {
        error.value = 'This registration has been deleted. If you believe this is an error, please contact support.'
      } else {
        error.value = 'Registration status could not be verified. It may have been deleted.'
      }
    } catch (err) {
      error.value = err.response?.data?.message || 'Failed to load registration details'
    } finally {
      isLoading.value = false
    }
  }

  const orderRef = computed(() => tempRegistration.value?.order || tempRegistration.value?.orders || {})
  const userEmail = computed(() => {
    return tempRegistration.value?.attendees?.[0]?.email || tempRegistration.value?.registration?.email || 'your email'
  })

  const purchasedItems = computed(() => {
    const orderObj = orderRef.value
    const allItems = []
    
    // Tickets (handling both map styles)
    const tickets = orderObj.itemsTicket || orderObj.items_ticket || orderObj.items || []
    tickets.forEach(item => {
      allItems.push({
        name: item.title || item.name || 'Ticket',
        price: Number(item.price || item.unitPrice || 0),
        quantity: Number(item.quantity || 1),
      })
    })

    // Products
    const products = orderObj.itemsProduct || orderObj.items_product || []
    products.forEach(item => {
      allItems.push({
        name: item.name || 'Product',
        price: Number(item.price || item.unitPrice || 0),
        quantity: Number(item.quantity || 1),
      })
    })

    return allItems
  })

  // Summary Calcs (Calculated in Cents)
  const totalAmount = computed(() => Number(orderRef.value.totalAmount || orderRef.value.total_amount || 0))
  const taxAmount = computed(() => Number(orderRef.value.taxAmount || orderRef.value.tax_amount || 0))
  const discountAmount = computed(() => Number(orderRef.value.discountAmount || orderRef.value.discount_amount || 0))
  const shippingCost = computed(() => Number(orderRef.value.shippingCost || orderRef.value.shipping_cost || 0))

  // Subtotal = Total - Tax - Shipping + Discount
  const subtotalAmount = computed(() => totalAmount.value - taxAmount.value - shippingCost.value + discountAmount.value)

  function goToHome () { router.push('/') }

  onMounted(() => {
    fetchRegistrationStatus()
  })
</script>

<template>
  <v-container class="fill-height pa-0">
    <v-row align="center" class="fill-height" justify="center" no-gutters>
      <!-- Loading State -->
      <v-col v-if="isLoading" class="text-center" cols="12">
        <v-progress-circular color="primary" indeterminate size="64" />
        <p class="mt-4 text-medium-emphasis">{{ t('pages.success.finalizing') }}</p>
      </v-col>

      <!-- Error State -->
      <v-col v-else-if="error" cols="12" sm="8" md="6" lg="5">
        <v-card class="text-center pa-10 rounded-xl" variant="outlined" border>
          <v-icon class="mb-6" color="warning" size="80">mdi-calendar-remove-outline</v-icon>
          <h3 class="text-h5 font-weight-bold mb-3">{{ t('pages.success.invalid_title') }}</h3>
          <p class="text-body-1 text-medium-emphasis mb-8">{{ error }}</p>
          <div class="d-flex flex-column gap-3">
            <v-btn color="primary" variant="flat" size="large" :rounded="rounded" block @click="goToHome">
              {{ t('pages.success.back_events') }}
            </v-btn>
          </div>
        </v-card>
      </v-col>

      <!-- Success Content (Receipt Style) -->
      <v-col v-else-if="tempRegistration && showSuccessContent" class="pa-4" cols="12" md="8" lg="6">
        
        <div class="text-center mb-8">
          <v-avatar color="success" size="72" class="mb-4 elevation-4">
            <v-icon color="white" size="40">mdi-check</v-icon>
          </v-avatar>
          <h1 class="text-h4 font-weight-bold mb-2">{{ t('pages.success.payment_received') }}</h1>
          <p class="text-body-1 text-medium-emphasis">
            {{ t('pages.success.sent_to') }} <strong class="text-high-emphasis">{{ userEmail }}</strong>
          </p>
          <v-chip v-if="tempRegistration.status === 'pending'" color="warning" class="mt-2" variant="tonal">
            {{ t('pages.success.processing') }}
          </v-chip>
        </div>

        <v-card :rounded="rounded" class="elevation-1 border overflow-hidden">
          <div class="bg-surface-variant pa-4 d-flex justify-space-between align-center">
            <span class="text-subtitle-2 font-weight-bold">{{ t('pages.success.order_summary') }}</span>
            <span class="text-caption">#{{ orderRef.orderNumber || orderRef.order_number || 'Pending' }}</span>
          </div>
          
          <v-card-text class="pa-6">
            <div v-for="(item, idx) in purchasedItems" :key="idx" class="d-flex justify-space-between align-center mb-3">
              <div class="d-flex align-center">
                <span class="text-body-1 mr-2">{{ item.name }}</span>
                <v-chip
                  class="font-weight-bold"
                  color="primary"
                  size="small"
                  variant="flat"
                  rounded="lg"
                >
                  {{ item.quantity }}
                </v-chip>
              </div>
              <span class="text-body-1 font-weight-medium">{{ formatPrice(item.price * item.quantity, orderRef.currency) }}</span>
            </div>

            <v-divider class="my-4" />

            <div class="d-flex justify-space-between mb-2 text-body-2 text-medium-emphasis">
              <span>{{ t('pages.checkout.subtotal') }}</span>
              <span>{{ formatPrice(subtotalAmount, orderRef.currency) }}</span>
            </div>
            
            <div v-if="discountAmount > 0" class="d-flex justify-space-between mb-2 text-body-2 text-success">
              <span>{{ t('pages.checkout.discount') }}</span>
              <span>-{{ formatPrice(discountAmount, orderRef.currency) }}</span>
            </div>

            <div v-if="taxAmount > 0" class="d-flex justify-space-between mb-2 text-body-2 text-medium-emphasis">
              <span>{{ t('pages.checkout.tax') }}</span>
              <span>{{ formatPrice(taxAmount, orderRef.currency) }}</span>
            </div>

            <div class="d-flex justify-space-between align-center mt-6">
              <span class="text-h6 font-weight-bold">{{ t('pages.success.total_paid') }}</span>
              <span class="text-h5 font-weight-black text-primary">{{ formatPrice(totalAmount, orderRef.currency) }}</span>
            </div>
          </v-card-text>

          <v-divider />
          
          <v-card-actions class="pa-6 bg-surface">
            <v-btn block color="primary" variant="flat" size="large" :rounded="rounded" @click="goToHome">
              {{ t('pages.success.return_home') }}
            </v-btn>
          </v-card-actions>
        </v-card>

        <p class="text-center mt-6 text-caption text-medium-emphasis">
          {{ t('pages.success.questions') }}
        </p>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.border-dashed { border-style: dashed !important; }
</style>
