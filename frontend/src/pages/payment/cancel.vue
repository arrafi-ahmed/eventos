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
          <v-icon
            color="warning"
            size="64"
          >
            mdi-close-circle-outline
          </v-icon>
          <h2 class="text-h5 mt-6 font-weight-bold">
            Payment Cancelled
          </h2>
          <p class="text-body-1 mt-2 text-medium-emphasis">
            Your payment with Orange Money was cancelled. No charges have been made to your account.
          </p>
          <v-btn
            block
            class="mt-6"
            color="primary"
            :size="size"
            :density="density"
            :rounded="rounded"
            @click="goBack"
          >
            Return to Checkout
          </v-btn>
          <v-btn
            block
            class="mt-3"
            variant="text"
            :size="size"
            :density="density"
            :rounded="rounded"
            @click="goHome"
          >
            Go to Home
          </v-btn>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useUiProps } from '@/composables/useUiProps'

definePage({
  name: 'payment-cancel',
  meta: {
    layout: 'headerless',
    title: 'Payment Cancelled',
    titleKey: 'pages.payment.cancel',
  },
})

const route = useRoute()
const router = useRouter()
const { rounded, size, density, variant } = useUiProps()

const eventSlug = computed(() => route.params.slug || route.query.slug || null)

function goBack() {
  if (eventSlug.value) {
    router.push({ name: 'checkout-slug', params: { slug: eventSlug.value } })
  } else {
    // router.back() is unsafe here as it might loop back to payment gateway
    // Default to home if no slug found
    router.push({ name: 'homepage' })
  }
}

function goHome() {
  if (eventSlug.value) {
    router.push({ name: 'event-landing-slug', params: { slug: eventSlug.value } })
  } else {
    router.push({ name: 'homepage' })
  }
}
</script>
