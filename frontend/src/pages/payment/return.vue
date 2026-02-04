<template>
  <v-container class="fill-height">
    <v-row
      align="center"
      justify="center"
    >
      <v-col
        class="text-center"
        cols="12"
        md="6"
      >
        <v-card
          class="pa-8"
          elevation="4"
          :rounded="rounded"
        >
          <div v-if="loading">
            <v-progress-circular
              color="orange"
              indeterminate
              size="64"
            />
            <h2 class="text-h5 mt-6 font-weight-bold">
              Verifying Payment...
            </h2>
            <p class="text-body-1 mt-2 text-medium-emphasis">
              Please wait while we confirm your Orange Money transaction. Do not refresh this page.
            </p>
          </div>

          <div v-else-if="error">
            <v-icon
              color="error"
              size="64"
            >
              mdi-alert-circle
            </v-icon>
            <h2 class="text-h5 mt-6 font-weight-bold">
              Verification Failed
            </h2>
            <v-alert
              class="mt-4 text-left"
              type="error"
              variant="tonal"
            >
              {{ errorMessage }}
            </v-alert>
            <v-btn
              block
              class="mt-6"
              color="primary"
              size="large"
              @click="goBack"
            >
              Try Again or Contact Support
            </v-btn>
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import $axios from '@/plugins/axios'
import { useUiProps } from '@/composables/useUiProps'

definePage({
  name: 'payment-return',
  meta: {
    layout: 'headerless',
    title: 'Payment Return',
    titleKey: 'pages.payment.return',
  },
})

const route = useRoute()
const router = useRouter()
const store = useStore()
const { rounded } = useUiProps()

const loading = ref(true)
const error = ref(false)
const errorMessage = ref('')
const eventSlug = ref(null)

onMounted(async () => {
  // Try multiple ways to get the order_id
  let orderId = route.query.order_id
  
  // Try to pre-extract slug from route if possible
  const potentialSlug = route.params.slug
  if (potentialSlug) eventSlug.value = potentialSlug

  // Fallback 1: Check if it's in the URL hash (some payment gateways use this)
  if (!orderId && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    orderId = hashParams.get('order_id')
  }
  
  // Fallback 2: Check session storage (we'll store it before redirect)
  if (!orderId) {
    orderId = sessionStorage.getItem('om_pending_order_id')
  }
  
  if (!orderId) {
    loading.value = false
    error.value = true
    errorMessage.value = 'No transaction identifier found. Please contact support with your payment confirmation.'
    return
  }

  // Clear session storage
  sessionStorage.removeItem('om_pending_order_id')

  const MAX_RETRIES = 3
  const RETRY_DELAY_MS = 5000
  let attempt = 0
  let verified = false

  while (attempt < MAX_RETRIES && !verified) {
    if (attempt > 0) {
      // Wait for the delay
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS))
    }
    
    attempt++

    try {
      const response = await $axios.get(`/payment/verify/orange_money/${orderId}`)
      
      if (response.data?.payload?.status === 'paid') {
        const { sessionId, eventSlug: verifiedSlug } = response.data.payload
        verified = true
        eventSlug.value = verifiedSlug || eventSlug.value

        if (eventSlug.value && sessionId) {
          // Redirect to the event-specific success page
          router.push({
            name: 'event-register-success-slug',
            params: { slug: eventSlug.value },
            query: { session_id: sessionId }
          })
          return
        } else {
          loading.value = false
          error.value = true
          errorMessage.value = 'Payment verified but could not determine order details.'
          return
        }
      } else {
         // Keep track of slug even if not paid yet, if returned
         if (response.data?.payload?.eventSlug) {
            eventSlug.value = response.data.payload.eventSlug
         }

         if (attempt === MAX_RETRIES) {
            // Last attempt failed or still pending
            loading.value = false
            error.value = true
            errorMessage.value = 'Payment status is still pending after multiple checks. If you have been charged, please do not worry; our system will process it shortly. Please contact support if you don\'t receive your tickets within 30 minutes.'
         }
      }
    } catch (err) {
      if (err.response?.data?.payload?.eventSlug) {
        eventSlug.value = err.response.data.payload.eventSlug
      }

      if (attempt === MAX_RETRIES) {
        loading.value = false
        error.value = true
        errorMessage.value = err.response?.data?.message || 'Failed to verify payment with Orange Money. Please contact support if the charge appears on your account.'
      }
      console.error(`[Payment Return] Verification attempt ${attempt} failed:`, err.message)
    }
  }
})

function goBack() {
  if (eventSlug.value) {
    router.push({ name: 'event-landing-slug', params: { slug: eventSlug.value } })
  } else {
    router.push({ name: 'homepage' })
  }
}
</script>
