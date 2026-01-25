<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import TicketDisplayDialog from '@/components/counter/TicketDisplayDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  definePage({
    name: 'counter-pos',
    meta: {
      layout: 'default',
      title: 'Point of Sale',
      requiresAuth: true,
      requiresCashier: true,
    },
  })

  const { rounded, density, variant, size } = useUiProps()
  const store = useStore()
  const router = useRouter()

  const activeSession = computed(() => store.state.counter.activeSession)
  const event = computed(() => store.state.event.event)
  const tickets = computed(() => store.state.ticket.tickets)
  const products = computed(() => store.state.product.organizerProducts)

  const loading = ref(false)
  const submitting = ref(false)
  const tab = ref('tickets')
  const cart = ref([])

  const checkoutDialog = ref(false)
  const customerEmail = ref('')
  const paymentMethod = ref('cash')
  const promoCode = ref('')

  const ticketDialog = ref(false)
  const saleResult = ref(null)
  const lastCartItems = ref([])

  const totalAmount = computed(() => {
    return cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
  })

  function addToCart (item, type) {
    const existing = cart.value.find(i => i.id === item.id && i.type === type)
    if (existing) {
      existing.quantity++
    } else {
      cart.value.push({
        id: item.id,
        type,
        name: item.name || item.title,
        price: item.price,
        quantity: 1,
      })
    }
  }

  function removeFromCart (index) {
    if (cart.value[index].quantity > 1) {
      cart.value[index].quantity--
    } else {
      cart.value.splice(index, 1)
    }
  }

  function clearCart () {
    cart.value = []
  }

  async function handleProcessSale () {
    submitting.value = true

    const tickets = cart.value.filter(i => i.type === 'ticket')
    const products = cart.value.filter(i => i.type === 'product')

    const selectedTickets = tickets.map(t => ({
      ticketId: t.id,
      title: t.name,
      quantity: t.quantity,
      price: t.price,
    }))

    const selectedProducts = products.map(p => ({
      productId: p.id,
      title: p.name,
      quantity: p.quantity,
      price: p.price,
    }))

    // Create placeholder attendee
    // Use entered email or generate a placeholder
    const email = customerEmail.value && customerEmail.value.includes('@')
      ? customerEmail.value
      : `walkin-${Date.now()}@pos.local`

    const attendee = {
      firstName: 'Walk-in',
      lastName: 'Customer',
      email: email,
      isPrimary: true,
    }

    const payload = {
      eventId: activeSession.value?.eventId || event.value?.id,
      paymentMethod: paymentMethod.value,
      customerEmail: customerEmail.value || null,
      promoCode: promoCode.value || null,
      attendees: [attendee],
      selectedTickets,
      selectedProducts,
      registration: {
        userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timezoneOffset: new Date().getTimezoneOffset(),
      },
    }

    store
      .dispatch('counter/processSale', payload)
      .then(result => {
        // Success handled by global interceptor/store
        saleResult.value = result.data?.payload || result.data
        lastCartItems.value = [...cart.value]
        clearCart()
        customerEmail.value = ''
        checkoutDialog.value = false
        ticketDialog.value = true
      })
      .finally(() => {
        submitting.value = false
      })
  }

  function loadData () {
    loading.value = true

    if (!activeSession.value) {
      router.push({ name: 'counter-shift-start' })
      return
    }

    const eventPromise = store.dispatch('event/setEventByEventIdnOrganizationId', {
      eventId: activeSession.value.eventId,
      organizationId: activeSession.value.organizationId,
    })

    const ticketsPromise = store.dispatch('ticket/setTickets', activeSession.value.eventId)

    const productsPromise = store.dispatch('product/fetchOrganizerProducts', activeSession.value.organizationId)

    Promise.all([eventPromise, ticketsPromise, productsPromise])
      .finally(() => {
        loading.value = false
      })
  }

  onMounted(() => {
    store.dispatch('counter/setActiveSession').then(session => {
      if (session) {
        loadData()
      } else {
        router.push({ name: 'counter-shift-start' })
      }
    })
  })
</script>

<template>
  <v-container fluid>
    <PageTitle
      :subtitle="`${activeSession?.ticketCounterName || 'Counter'} • ${activeSession?.eventName || event?.name || 'Loading...'}`"
      title="Point of Sale"
    >
      <template #actions>
        <v-btn
          color="error"
          :density="density"
          prepend-icon="mdi-logout"
          :rounded="rounded"
          :size="size"
          variant="text"
          @click="router.push({ name: 'counter-shift-end' })"
        >
          End Shift
        </v-btn>
      </template>
    </PageTitle>

    <v-row>
      <!-- Main POS Area -->
      <v-col cols="12" md="8">
        <v-card class="mt-4" elevation="1" :rounded="rounded">
          <v-tabs v-model="tab" color="primary">
            <v-tab value="tickets">Tickets</v-tab>
            <v-tab value="products">Merchandise</v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <v-window-item value="tickets">
              <v-container>
                <v-row>
                  <v-col
                    v-for="ticket in tickets"
                    :key="ticket.id"
                    cols="12"
                    lg="4"
                    sm="6"
                  >
                    <v-card border elevation="0" :rounded="rounded" @click="addToCart(ticket, 'ticket')">
                      <v-card-item>
                        <v-card-title class="text-subtitle-1">{{ ticket.title }}</v-card-title>
                        <v-card-subtitle class="text-primary font-weight-bold">
                          {{ formatPrice(ticket.price, event?.currency) }}
                          <span class="text-caption text-grey ml-2">
                            ({{ ticket.currentStock }} left)
                          </span>
                        </v-card-subtitle>
                      </v-card-item>
                      <v-card-actions>
                        <v-spacer />
                        <v-icon color="grey">mdi-plus-circle</v-icon>
                      </v-card-actions>
                    </v-card>
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>

            <v-window-item value="products">
              <v-container>
                <v-row>
                  <v-col
                    v-for="product in products"
                    :key="product.id"
                    cols="12"
                    lg="4"
                    sm="6"
                  >
                    <v-card border elevation="0" :rounded="rounded" @click="addToCart(product, 'product')">
                      <v-card-item>
                        <v-card-title class="text-subtitle-1">{{ product.name }}</v-card-title>
                        <v-card-subtitle class="text-primary font-weight-bold">
                          {{ formatPrice(product.price, event?.currency) }}
                        </v-card-subtitle>
                      </v-card-item>
                      <v-card-actions>
                        <v-spacer />
                        <v-icon color="grey">mdi-plus-circle</v-icon>
                      </v-card-actions>
                    </v-card>
                  </v-col>
                </v-row>
              </v-container>
            </v-window-item>
          </v-window>
        </v-card>
      </v-col>

      <!-- Cart Side Area -->
      <v-col cols="12" md="4">
        <v-card class="h-100 d-flex flex-column" elevation="2" :rounded="rounded">
          <v-card-title class="pa-4 d-flex justify-space-between align-center">
            <span>Cart</span>
            <v-btn
              color="grey"
              density="compact"
              icon="mdi-delete-sweep"
              variant="text"
              @click="clearCart"
            />
          </v-card-title>

          <v-divider />

          <v-card-text class="pa-0 flex-grow-1 overflow-y-auto">
            <v-list v-if="cart.length > 0">
              <v-list-item v-for="(item, index) in cart" :key="`${item.type}-${item.id}`">
                <template #prepend>
                  <v-avatar color="primary" rounded="sm" size="32">
                    <v-icon color="white" size="20">
                      {{ item.type === 'ticket' ? 'mdi-ticket' : 'mdi-package-variant' }}
                    </v-icon>
                  </v-avatar>
                </template>

                <v-list-item-title class="text-body-2">{{ item.name }}</v-list-item-title>
                <v-list-item-subtitle>{{ formatPrice(item.price, event?.currency) }}</v-list-item-subtitle>

                <template #append>
                  <div class="d-flex align-center">
                    <v-btn
                      density="compact"
                      icon="mdi-minus"
                      size="small"
                      variant="text"
                      @click="removeFromCart(index)"
                    />
                    <span class="mx-2 font-weight-bold">{{ item.quantity }}</span>
                    <v-btn
                      density="compact"
                      icon="mdi-plus"
                      size="small"
                      variant="text"
                      @click="addToCart(item, item.type)"
                    />
                  </div>
                </template>
              </v-list-item>
            </v-list>
            <div v-else class="text-center py-10">
              <v-icon color="grey-lighten-1" size="48">mdi-cart-outline</v-icon>
              <p class="text-grey-darken-1 mt-2">Cart is empty</p>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-4 flex-column align-stretch">
            <div class="d-flex justify-space-between mb-4">
              <span class="text-h6">Total</span>
              <span class="text-h6 color-primary">{{ formatPrice(totalAmount, event?.currency) }}</span>
            </div>
            <v-btn
              block
              color="primary"
              :disabled="cart.length === 0"
              :rounded="rounded"
              size="large"
              variant="flat"
              @click="checkoutDialog = true"
            >
              Checkout
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <!-- Checkout Modal -->
    <v-dialog v-model="checkoutDialog" max-width="500">
      <v-card class="pa-4" :rounded="rounded">
        <v-card-title>Complete Sale</v-card-title>
        <v-card-text>
          <div class="text-h4 text-center py-4 text-primary font-weight-bold">
            {{ formatPrice(totalAmount, event?.currency) }}
          </div>

          <v-divider class="mb-6" />

          <v-label class="mb-2">Payment Method</v-label>
          <v-btn-toggle
            v-model="paymentMethod"
            block
            class="mb-6"
            color="primary"
            hide-details="auto"
            mandatory
            variant="outlined"
          >
            <v-btn prepend-icon="mdi-cash" value="cash">Cash</v-btn>
            <v-btn prepend-icon="mdi-credit-card" value="card">Card</v-btn>
          </v-btn-toggle>

          <v-text-field
            v-model="customerEmail"
            :density="density"
            hide-details="auto"
            label="Customer Email (Optional)"
            placeholder="For sending digital ticket"
            prepend-inner-icon="mdi-email"
            :rounded="rounded"
            type="email"
            :variant="variant"
          />

          <v-text-field
            v-model="promoCode"
            class="mt-4"
            :density="density"
            hide-details="auto"
            label="Promo Code (Optional)"
            placeholder="Enter discount code"
            prepend-inner-icon="mdi-ticket-percent"
            :rounded="rounded"
            :variant="variant"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn color="secondary" :rounded="rounded" variant="text" @click="checkoutDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :loading="submitting"
            :rounded="rounded"
            variant="flat"
            @click="handleProcessSale"
          >
            Confirm Sale
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Ticket Display Dialog -->
    <TicketDisplayDialog
      v-model="ticketDialog"
      :cart-items="lastCartItems"
      :event="event"
      :sale-data="saleResult"
    />
  </v-container>
</template>

<style scoped>
.h-100 {
  height: calc(100vh - 120px);
}
.overflow-y-auto {
  overflow-y: auto;
}
</style>
