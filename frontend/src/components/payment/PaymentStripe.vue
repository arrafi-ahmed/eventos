<template>
  <div class="stripe-payment-container">
    <div
      v-if="!paymentElementLoaded"
      class="payment-loading d-flex flex-column align-center justify-center py-8"
    >
      <v-progress-circular
        color="primary"
        indeterminate
        size="32"
      />
      <p class="mt-4 text-body-2 text-medium-emphasis">
        Initializing secure payment form...
      </p>
    </div>

    <!-- Stripe Elements Mount Points -->
    <div
      v-show="paymentElementLoaded"
      class="payment-elements-wrapper"
    >
      <div
        v-if="requiresAddress"
        id="shipping-address-element"
        class="mb-6"
      />
      <div id="payment-element" />
    </div>

    <!-- Error Message -->
    <v-alert
      v-if="errorMessage"
      class="mt-4"
      density="compact"
      type="error"
      variant="tonal"
    >
      {{ errorMessage }}
      <template #append>
        <v-btn
          color="error"
          size="small"
          variant="text"
          @click="retryInitialization"
        >
          Retry
        </v-btn>
      </template>
    </v-alert>
  </div>
</template>

<script setup>
  import { loadStripe } from '@stripe/stripe-js'
  import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
  import { useStore } from 'vuex'
  import { useTheme } from 'vuetify'

  const props = defineProps({
    clientSecret: {
      type: String,
      required: true,
    },
    stripePublicKey: {
      type: String,
      required: true,
    },
    requiresAddress: {
      type: Boolean,
      default: false,
    },
    customerName: {
      type: String,
      default: '',
    },
  })

  const emit = defineEmits(['loaded', 'error', 'success', 'processing'])

  const store = useStore()
  const theme = useTheme()
  const stripe = ref(null)
  const elements = ref(null)
  const paymentElement = ref(null)
  const addressElement = ref(null)
  const paymentElementLoaded = ref(false)
  const errorMessage = ref('')

  async function initializeStripe () {
    try {
      paymentElementLoaded.value = false
      errorMessage.value = ''

      if (!stripe.value) {
        stripe.value = await loadStripe(props.stripePublicKey)
      }

      // Get current theme colors for appearance
      const isDark = theme.global.name.value === 'dark'
      const colors = theme.global.current.value.colors

      const appearance = {
        theme: 'stripe',
        variables: {
          colorPrimary: colors.primary || '#0570de',
          colorBackground: colors.surface || (isDark ? '#1F1F1F' : '#ffffff'),
          colorText: colors['on-surface'] || (isDark ? '#ffffff' : '#30313d'),
          colorTextSecondary: isDark ? '#B0B0B0' : '#686b72',
          colorTextPlaceholder: isDark ? '#555555' : '#aab7c4',
          colorIcon: colors['on-surface'] || (isDark ? '#ffffff' : '#30313d'),
          colorDanger: colors.error || '#df1b41',
          fontFamily: 'Outfit, system-ui, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px',
        },
      }

      elements.value = stripe.value.elements({
        clientSecret: props.clientSecret,
        appearance,
      })

      paymentElement.value = elements.value.create('payment')

      // Create address element if needed
      if (props.requiresAddress) {
        addressElement.value = elements.value.create('address', {
          mode: 'shipping',
          defaultValues: {
            name: props.customerName,
          },
        })
      }

      paymentElement.value.on('ready', () => {
        paymentElementLoaded.value = true
        emit('loaded')
      })

      // Mount them
      await nextTick()
      if (addressElement.value) {
        addressElement.value.mount('#shipping-address-element')
      }
      paymentElement.value.mount('#payment-element')
    } catch (error) {
      console.error('[PaymentStripe] Initialization error:', error)
      errorMessage.value = 'Failed to load the payment form. Please try again.'
      emit('error', error.message)
    }
  }

  async function processPayment (successUrl) {
    if (!stripe.value || !elements.value) return

    emit('processing', true)

    try {
      const confirmParams = {
        return_url: successUrl,
      }

      // Collect address if required
      if (props.requiresAddress && addressElement.value) {
        const { complete, value } = await addressElement.value.getValue()
        if (!complete) {
          errorMessage.value = 'Please complete your shipping address.'
          emit('error', errorMessage.value)
          emit('processing', false)
          return
        }
        confirmParams.shipping = {
          name: value.name,
          address: value.address,
        }
      }

      const { error } = await stripe.value.confirmPayment({
        elements: elements.value,
        confirmParams: confirmParams,
      })

      if (error) {
        errorMessage.value = error.type === 'card_error' || error.type === 'validation_error' ? error.message : 'An unexpected error occurred.'
        emit('error', errorMessage.value)
      }
    } catch {
      errorMessage.value = 'Payment failed. Please try again.'
      emit('error', errorMessage.value)
    } finally {
      emit('processing', false)
    }
  }

  function retryInitialization () {
    initializeStripe()
  }

  // Expose the processPayment method to the parent
  defineExpose({ processPayment })

  onMounted(() => {
    initializeStripe()
  })

  onBeforeUnmount(() => {
    if (paymentElement.value) {
      paymentElement.value.unmount()
    }
  })

  // Watch for clientSecret changes to re-initialize if needed
  watch(() => props.clientSecret, newSecret => {
    if (newSecret && elements.value) {
      elements.value.update({ clientSecret: newSecret })
    }
  })
</script>

<style scoped>
.stripe-payment-container {
  min-height: 100px;
}
</style>
