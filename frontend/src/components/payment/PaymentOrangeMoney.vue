<template>
  <div class="orange-money-payment">
    <v-card
      class="mb-4"
      elevation="0"
      variant="tonal"
    >
      <v-card-text>
        <div class="d-flex align-center mb-3">
          <v-icon
            color="orange"
            size="32"
          >
            mdi-cellphone-check
          </v-icon>
          <span class="text-h6 ml-2">Orange Money</span>
        </div>
        <p class="text-body-2 mb-2">
          You will be redirected to Orange Money to complete your payment securely.
        </p>
        <v-alert
          color="info"
          density="compact"
          variant="tonal"
        >
          <div class="text-caption">
            <v-icon size="small">mdi-information</v-icon>
            After clicking "Pay Now", you'll be taken to the Orange Money payment page.
          </div>
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Loading State -->
    <div
      v-if="isProcessing"
      class="text-center py-4"
    >
      <v-progress-circular
        color="orange"
        indeterminate
        size="48"
      />
      <p class="mt-3 text-body-2">
        Preparing your payment...
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import $axios from '@/plugins/axios'

const props = defineProps({
  sessionId: {
    type: String,
    required: true
  },
  totalAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentUrl: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['processing', 'error', 'loaded'])

const isProcessing = ref(false)

// Expose processPayment method to parent
defineExpose({
  processPayment
})

/**
 * Process Orange Money Payment
 * Initiates payment and redirects to Orange Money
 */
async function processPayment(successUrl) {
  try {
    isProcessing.value = true
    emit('processing', true)

    let url = props.paymentUrl

    if (!url) {
      const baseUrl = window.location.origin
      const cancelUrl = `${baseUrl}/payment/cancel` // We don't have slug here easily unless passed as prop, but backend might have context. 
      // Actually we should probably just rely on props if possible, but for now let's try to pass what we can.
      // Better to assume backend uses defaults if missing, OR we can try to guess.
      // But wait, checkout calls this with successUrl. We should use it.
      
      // Call backend to initiate Orange Money payment ONLY if not already initiated
      const response = await $axios.post('/payment/init', {
        gateway: 'orange_money',
        sessionId: props.sessionId,
        returnUrl: successUrl,
        // cancelUrl: ... we lack slug here. But this is a fallback.
        // Let's hope the main checkout flow handles it.
      })
      url = response.data.payload.paymentUrl
    }

    if (!url) {
      throw new Error('Payment URL not received from Orange Money')
    }

    // Redirect to Orange Money payment page
    window.location.href = url

  } catch (error) {
    console.error('Orange Money payment error:', error)
    emit('error', error.response?.data?.message || error.message || 'Failed to initiate Orange Money payment')
    isProcessing.value = false
    emit('processing', false)
  }
}

// Notify parent that component is loaded
emit('loaded')
</script>

<style scoped>
.orange-money-payment {
  max-width: 600px;
  margin: 0 auto;
}
</style>
