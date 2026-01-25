<script setup>
  import { computed, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  const { rounded, size, variant } = useUiProps()
  const { xs } = useDisplay()
  const store = useStore()
  const route = useRoute()
  const router = useRouter()

  // Cart dialog state
  const showCartDialog = ref(false)

  // Get data from checkout store
  const event = computed(() => store.state.event.event)
  const selectedTickets = computed(() => store.getters['checkout/selectedTickets'])
  const selectedProducts = computed(() => store.getters['checkout/selectedProducts'])
  const isCheckoutExist = computed(() => store.getters['checkout/isCheckoutExist'])

  // Total selected tickets
  const totalSelectedTickets = computed(() =>
    selectedTickets.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  )

  // Total selected products
  const totalSelectedProducts = computed(() =>
    selectedProducts.value.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  )

  // Total items (tickets + products, only if merchandise shop is enabled)
  const totalSelectedItems = computed(() => {
    const tickets = totalSelectedTickets.value
    const products = event.value?.config?.enableMerchandiseShop ? totalSelectedProducts.value : 0
    return tickets + products
  })

  // Ticket selection limits
  const maxTicketsPerRegistration = computed(() => event.value?.config?.maxTicketsPerRegistration || 10)
  const isAtSelectionLimit = computed(() => totalSelectedTickets.value >= maxTicketsPerRegistration.value)

  // Subtotal calculation (without shipping)
  function getSubtotalAmount () {
    const ticketsTotal = (selectedTickets.value || []).reduce((sum, item) => {
      return sum + ((item.price || 0) * (item.quantity || 0))
    }, 0)

    const productsTotal = event.value?.config?.enableMerchandiseShop
      ? (selectedProducts.value || []).reduce((sum, item) => {
        return sum + ((item.price || 0) * (item.quantity || 0))
      }, 0)
      : 0

    return ticketsTotal + productsTotal
  }

  // Total price calculation (including shipping)
  function getTotalAmount () {
    const subtotal = getSubtotalAmount()
    const shipping = shippingCost.value || 0
    return subtotal + shipping
  }

  const eventCurrency = computed(() => event.value?.currency || 'USD')

  // Calculate shipping cost for products
  const shippingCost = computed(() => {
    // Only calculate shipping if there are products AND shipping option is 'delivery'
    // Since shipping option is only selected on checkout page, don't calculate shipping in cart summary
    // Shipping will only be calculated when user selects their preferred shipping method on checkout page
    return 0
  })

  // Helper function for restrictions (same as tickets page)
  function getTicketById (ticketId) {
    return store.state.ticket?.tickets?.find(t => t.id === ticketId)
  }

  // Cart management functions
  function openCartDialog () {
    showCartDialog.value = true
  }

  function closeCartDialog () {
    showCartDialog.value = false
  }

  function updateTicketQuantity (ticketId, newQuantity) {
    const ticket = selectedTickets.value.find(t => t.ticketId === ticketId)
    if (!ticket) return

    if (newQuantity <= 0) {
      store.dispatch('checkout/removeTicket', ticketId)
    } else {
      // Update quantity using action
      store.dispatch('checkout/addTicket', {
        ...ticket,
        quantity: newQuantity,
      })
    }
  }

  function updateProductQuantity (productId, newQuantity) {
    const product = selectedProducts.value.find(p => p.productId === productId)
    if (!product) return

    if (newQuantity <= 0) {
      store.dispatch('checkout/removeProduct', productId)
    } else {
      // Update quantity using action
      store.dispatch('checkout/addProduct', {
        ...product,
        quantity: newQuantity,
      })
    }
  }

  function removeTicket (ticketId) {
    store.dispatch('checkout/removeTicket', ticketId)
  }

  function removeProduct (productId) {
    store.dispatch('checkout/removeProduct', productId)
  }

  function goToCheckout () {
    // Use the centralized routing logic from the store
    store.dispatch('checkout/goToCheckout', { router, route })
  }

  // Watch for state changes and sync with localStorage
  watch(
    () => selectedTickets.value,
    newTickets => {
      localStorage.setItem('selectedTickets', JSON.stringify(newTickets))
    },
    { deep: true },
  )

  watch(
    () => selectedProducts.value,
    newProducts => {
      localStorage.setItem('selectedProducts', JSON.stringify(newProducts))
    },
    { deep: true },
  )

  watch(
    () => isCheckoutExist.value,
    newVal => {
      localStorage.setItem('isCheckoutExist', newVal)
    },
  )
</script>

<template>
  <!-- Quick Continue Button - Fixed Bottom Bar -->
  <v-fade-transition>
    <div
      v-show="totalSelectedItems > 0"
      class="quick-continue-bar"
    >
      <v-container :class="{ 'py-2': xs }">
        <div
          class="d-flex align-center justify-space-between text-gradient"
          :class="{ 'flex-column align-stretch': xs }"
        >
          <div class="d-flex align-center">
            <v-icon
              class="mr-2"
              size="20"
            >
              mdi-check-circle
            </v-icon>
            <div :class="{ 'mb-2': xs }">
              <div class="text-body-2 font-weight-medium">
                <span v-if="totalSelectedTickets > 0">
                  <span>{{ totalSelectedTickets }} ticket{{ totalSelectedTickets > 1 ? 's' : '' }}</span>
                </span>
                <span
                  v-if="totalSelectedTickets > 0 && event?.config?.enableMerchandiseShop && totalSelectedProducts > 0"
                >, </span>
                <span v-if="event?.config?.enableMerchandiseShop && totalSelectedProducts > 0">
                  {{ totalSelectedProducts }} product{{ totalSelectedProducts > 1 ? 's' : '' }}
                </span>
                <span> selected</span>
              </div>
              <div class="text-body-2 font-weight-bold">
                Total: {{ formatPrice(getTotalAmount(), eventCurrency) }}
              </div>
            </div>
          </div>
          <div
            class="d-flex align-center gap-2"
            :class="{ 'w-100 justify-space-between': xs }"
          >
            <v-btn
              :class="{ 'flex-grow-1': xs }"
              :rounded="rounded"
              size="default"
              :variant="variant"
              @click="openCartDialog"
            >
              <v-icon
                class="mr-1"
                size="16"
              >
                mdi-cart
              </v-icon>
              Cart
            </v-btn>
            <v-btn
              class="ml-2 flex-grow-1"
              :disabled="totalSelectedTickets === 0"
              :loading="false"
              :rounded="rounded"
              size="default"
              :variant="variant"
              @click="goToCheckout"
            >
              <v-icon
                class="mr-2"
                size="18"
              >
                mdi-arrow-right
              </v-icon>
              {{ xs ? 'Continue?' : 'Continue to Registration' }}
            </v-btn>
          </div>
        </div>
      </v-container>
    </div>
  </v-fade-transition>

  <!-- Cart Dialog -->
  <v-dialog
    v-model="showCartDialog"
    max-width="440"
    persistent
    transition="dialog-bottom-transition"
  >
    <v-card
      class="modern-cart-dialog rounded-lg"
      elevation="0"
      rounded="lg"
    >
      <!-- Sleek Header -->
      <div class="cart-header text-gradient">
        <div class="d-flex justify-space-between align-center pa-4">
          <div class="d-flex align-center">
            <div class="cart-icon-wrapper">
              <v-icon
                size="18"
              >
                mdi-shopping
              </v-icon>
            </div>
            <div class="ml-3">
              <div class="text-h6 font-weight-bold">
                Cart
              </div>
              <div class="text-caption">
                {{ totalSelectedItems }} item{{ totalSelectedItems !== 1 ? 's' : '' }}
              </div>
            </div>
          </div>
          <v-btn
            class="close-btn"
            color="white"
            icon
            rounded
            variant="text"
            @click="closeCartDialog"
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
            variant="outlined"
            @click="closeCartDialog"
          >
            Continue Shopping
          </v-btn>
        </div>

        <div
          v-else
          class="cart-content"
        >
          <!-- Tickets List -->
          <div class="cart-items-list px-4">
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
                      variant="text"
                      @click="updateTicketQuantity(item.ticketId, item.quantity - 1)"
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
                        !getTicketById(item.ticketId)?.currentStock ||
                          getTicketById(item.ticketId)?.currentStock <= 0 ||
                          isAtSelectionLimit ||
                          (selectedTickets.find(t => t.ticketId === item.ticketId)?.quantity >= getTicketById(item.ticketId)?.currentStock)
                      "
                      icon
                      rounded
                      :size="size"
                      variant="text"
                      @click="updateTicketQuantity(item.ticketId, item.quantity + 1)"
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
                    variant="text"
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
                v-if="selectedTickets.length > 0 && selectedProducts.length > 0"
                class="item-divider"
              />
            </div>
          </div>

          <!-- Products List -->
          <div
            v-if="selectedProducts.some(p => p.quantity > 0)"
            class="cart-items-list px-4"
          >
            <div
              v-for="(item, index) in selectedProducts.filter(p => p.quantity > 0)"
              :key="`product-${item.productId}`"
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
                      variant="text"
                      @click="updateProductQuantity(item.productId, item.quantity - 1)"
                    >
                      <v-icon size="14">
                        mdi-minus
                      </v-icon>
                    </v-btn>
                    <span class="quantity-text">{{ item.quantity }}</span>
                    <v-btn
                      class="quantity-btn"
                      color="grey-darken-1"
                      :disabled="(item.stock ?? 0) <= item.quantity"
                      icon
                      rounded
                      :size="size"
                      variant="text"
                      @click="updateProductQuantity(item.productId, item.quantity + 1)"
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
                    variant="text"
                    @click="removeProduct(item.productId)"
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
              v-if="shippingCost > 0"
              class="summary-line"
            >
              <span class="summary-label">Shipping</span>
              <span class="summary-amount">{{ formatPrice(shippingCost, eventCurrency) }}</span>
            </div>
            <div class="summary-line total-line">
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
              :rounded="rounded"
              :size="size"
              @click="goToCheckout"
            >
              <v-icon
                class="mr-2"
                size="18"
              >
                mdi-credit-card-outline
              </v-icon>
              <span class="font-weight-medium">
                Checkout
              </span>
            </v-btn>

            <div class="text-center mt-2">
              <v-btn
                class="continue-shopping-btn"
                color="grey-lighten-1"
                density="comfortable"
                :rounded="rounded"
                :size="size"
                variant="text"
                @click="closeCartDialog"
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
/* Local component styles */
.cart-header {
  position: relative;
  overflow: hidden;
}

/* Component styles are now centralized in @/styles/components.css */
</style>
