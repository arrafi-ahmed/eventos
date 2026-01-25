<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import CartSummary from '@/components/CartSummary.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import ProductCard from '@/components/product/ProductCard.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  definePage({
    name: 'shop-slug',
    meta: {
      layout: 'default',
      title: 'Event Shop',
    },
  })

  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, size, variant, density } = useUiProps()

  const isLoading = ref(false)

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
        :subtitle="`Available Products (${sortedProducts.length})`"
        :title="`${event?.name} Shop`"
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
            Back to Tickets
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
