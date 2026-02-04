<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import CartSummary from '@/components/CartSummary.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import ProductCard from '@/components/product/ProductCard.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  const { t } = useI18n()

  definePage({
    name: 'shop-slug',
    meta: {
      layout: 'default',
      title: 'Shop',
      titleKey: 'pages.event.shop',
    },
  })

  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, size, variant, density } = useUiProps()

  // Computed UI Pattern
  const ui = computed(() => ({
    title: (name) => t('shop.title', { name }),
    subtitle: (count) => t('shop.subtitle', { count }),
    back_to_tickets: t('shop.back_to_tickets'),
  }))

  const isLoading = ref(false)
  const showClearCartDialog = ref(false)
  const pendingAction = ref(null) // { type: 'product', productId, quantity }

  // Store state
  const event = computed(() => store.state.event.event)
  const eventProducts = computed(() => store.state.product.eventProducts || [])
  const allProducts = computed(() => store.state.product.products || [])
  const selectedProducts = computed(() => store.getters['checkout/selectedProducts'])

  // Sort products: featured first, then regular
  const sortedProducts = computed(() => {
    if (!eventProducts.value || eventProducts.value.length === 0) return []

    const featured = eventProducts.value.filter(p => p.is_featured)
    const regular = eventProducts.value.filter(p => !p.is_featured)

    return [...featured, ...regular]
  })

  function isProductInCart (productId) {
    const product = selectedProducts.value.find(item => item.productId === productId)
    return product && product.quantity > 0
  }

  async function updateProductQuantity (productId, newQuantity, skipCheck = false) {
    const product = eventProducts.value.find(p => p.id === productId)
    if (!product) return

    if (newQuantity > 0 && !skipCheck) {
      // Check for cart mismatch
      const result = await store.dispatch('checkout/checkMismatch', route.params.slug)
      if (result.mismatch) {
        pendingAction.value = { type: 'product', productId, quantity: newQuantity }
        showClearCartDialog.value = true
        return
      }
    }

    if (newQuantity <= 0) {
      // Remove from selected products - use the productId from the selected products array
      const existingProduct = selectedProducts.value.find(item => item.productId === productId)
      if (existingProduct) {
        store.dispatch('checkout/removeProduct', existingProduct.productId)
      }
    } else if (newQuantity <= product.stock) {
      // Add or update selected product
      const existingProduct = selectedProducts.value.find(item => item.productId === productId)
      if (existingProduct) {
        store.dispatch('checkout/addProduct', {
          ...existingProduct,
          productId: product.id,
          quantity: newQuantity,
        })
      } else {
        store.dispatch('checkout/addProduct', {
          ...product,
          productId: product.id,
          quantity: newQuantity,
        })
      }
    }
  }

  async function confirmClearCart () {
    const action = pendingAction.value
    if (!action) return

    // Clear the cart
    await store.dispatch('checkout/clearCheckout')

    // Set the new event slug
    store.commit('checkout/setCartEventSlug', route.params.slug)

    // Proceed with the pending action (with bypass)
    if (action.type === 'product') {
      await updateProductQuantity(action.productId, action.quantity, true)
    }

    // Reset and close
    pendingAction.value = null
    showClearCartDialog.value = false
  }

  import { usePaymentResilience } from '@/composables/usePaymentResilience'

  const { checkAndCleanupSession } = usePaymentResilience()

  onMounted(async () => {
    try {
      isLoading.value = true
      const slug = route.params.slug

      // Perform background check for existing paid sessions and cleanup
      checkAndCleanupSession(slug)

      // Load event first if not already loaded
      if (!event.value?.id) {
        try {
          await store.dispatch('event/setEventBySlug', { slug })
        } catch (error) {
          console.error('Error loading event:', error)
          return
        }
      }

      // Always fetch products from store
      if (event.value?.id) {
        await store.dispatch('product/fetchEventProducts', event.value.id)
      }
    } catch (error) {
      console.error('Error loading products:', error)
    } finally {
      isLoading.value = false
    }
  })

  // Watch for changes in event products and initialize selected products
  watch(() => eventProducts.value, newProducts => {
    if (newProducts && Array.isArray(newProducts) && newProducts.length > 0) {
      // Only initialize if selectedProducts is empty or doesn't have the current products
      const hasCurrentProducts = newProducts.every(product =>
        selectedProducts.value.some(selected => selected.productId === product.id),
      )

      if (!hasCurrentProducts) {
        store.commit('checkout/setSelectedProducts', newProducts.map(product => ({
          ...product,
          productId: product.id,
          quantity: 0,
        })))
      }
    }
  }, { immediate: true })
</script>

<template>
  <!-- Main Section -->
  <section class="section section-fade pb-16">
    <v-container>
      <PageTitle
        :back-route="`/${route.params.slug}/tickets`"
        :compact="true"
        :show-back-button="false"
        :subtitle="ui.subtitle(sortedProducts.length)"
        :title="ui.title(event?.name || '')"
      >
        <template #actions>
          <v-btn
            color="primary"
            :density="density"
            :rounded="rounded"
            :size="size"
            :variant="variant"
            @click="router.push(`/${route.params.slug}/tickets`)"
          >
            <v-icon class="mr-2">
              mdi-arrow-left
            </v-icon>
            {{ ui.back_to_tickets }}
          </v-btn>
        </template>
      </PageTitle>

      <v-row justify="center">
        <v-col
          v-for="product in sortedProducts"
          :key="product.id"
          cols="12"
          md="4"
          sm="6"
        >
          <ProductCard
            :initial-quantity="selectedProducts.find(p => p.productId === product.id)?.quantity || 0"
            :is-featured="product.is_featured"
            :product="product"
            :show-description="true"
            :show-quantity-selector="true"
            :show-stock="true"
            :use-cart-logic="true"
            @quantity-change="({ quantity }) => updateProductQuantity(product.id, quantity)"
          />
        </v-col>
      </v-row>
    </v-container>
  </section>

  <!-- Checkout Button Component -->
  <CartSummary />

  <!-- Clear Cart Confirmation Dialog -->
  <v-dialog v-model="showClearCartDialog" max-width="450" persistent>
    <v-card class="rounded-xl overflow-hidden shadow-2xl">
      <v-card-title class="pa-6 d-flex align-center text-white" style="background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-accent)) 100%);">
        <v-icon class="mr-4" color="white">mdi-alert-circle</v-icon>
        <span class="text-h6 font-weight-bold">Clear Your Cart?</span>
      </v-card-title>
      
      <v-card-text class="pa-6 text-center">
        <p class="text-body-1 mb-6">
          Your cart already contains items from another event. 
          To add items for <strong>{{ event?.name }}</strong>, your current cart must be cleared.
        </p>
        
        <div class="d-flex flex-column gap-3">
          <v-btn
            color="primary"
            class="py-6 rounded-lg text-none font-weight-bold"
            size="large"
            block
            @click="confirmClearCart"
          >
            Clear Cart and Add
          </v-btn>
          
          <v-btn
            variant="text"
            class="rounded-lg text-none"
            size="large"
            block
            @click="showClearCartDialog = false"
          >
            Cancel
          </v-btn>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>

  <!-- Bottom padding to prevent content from being hidden behind fixed checkout -->
  <div class="checkout-spacer" />
</template>

<style scoped>
/* Layout styles are now centralized in @/styles/components.css */

/* Checkout Spacer */
.checkout-spacer {
  height: 120px; /* Space for fixed checkout bar */
}
</style>
