<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import TicketDisplayDialog from '@/components/counter/TicketDisplayDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  definePage({
    name: 'counter-pos',
    meta: {
      layout: 'default',
      title: 'Point of Sale',
      titleKey: 'pages.counter.pos_title',
      requiresAuth: true,
      requiresCashier: true,
    },
  })

  const { rounded, density, variant, size } = useUiProps()
  const { t } = useI18n()
  const store = useStore()
  const router = useRouter()

  const activeSession = computed(() => store.state.counter.activeSession)
  const event = computed(() => store.state.event.event)
  const tickets = computed(() => store.state.ticket.tickets)
  const products = computed(() => store.state.product.products)

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
  const appliedPromo = ref(null)
  const applyingPromo = ref(false)

  const totalAmount = computed(() => {
    const subtotal = cart.value.reduce((sum, item) => sum + item.price * item.quantity, 0)
    if (!appliedPromo.value) return subtotal
    
    const { discountType, discountValue } = appliedPromo.value
    
    if (discountType === 'percentage') {
      return Math.max(0, subtotal - (subtotal * discountValue / 100))
    } else if (discountType === 'fixed') {
      return Math.max(0, subtotal - discountValue)
    } else if (discountType === 'free') {
      return 0
    }
    return subtotal
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
    appliedPromo.value = null
    promoCode.value = ''
  }

  async function handleApplyPromoCode () {
    if (!promoCode.value) return
    
    applyingPromo.value = true
    try {
      const response = await store.dispatch('promoCode/validatePromoCode', {
        code: promoCode.value,
        eventId: activeSession.value?.eventId || event.value?.id
      })
      appliedPromo.value = response.data?.payload
    } catch (error) {
      appliedPromo.value = null
      console.error('Promo code validation failed:', error)
    } finally {
      applyingPromo.value = false
    }
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

    const totalTicketQuantity = selectedTickets.reduce((sum, t) => sum + t.quantity, 0)
    const saveAllDetails = event.value?.config?.saveAllAttendeesDetails

    const attendeeList = []
    if (saveAllDetails && totalTicketQuantity > 0) {
      tickets.forEach(t => {
        for (let i = 0; i < t.quantity; i++) {
          attendeeList.push({
            firstName: attendeeList.length === 0 ? 'Walk-in' : 'Guest',
            lastName: attendeeList.length === 0 ? 'Customer' : (attendeeList.length + 1),
            email: email,
            isPrimary: attendeeList.length === 0,
            ticket: {
              id: t.id,
              title: t.name,
              price: t.price,
            },
          })
        }
      })
    } else {
      attendeeList.push({
        firstName: 'Walk-in',
        lastName: 'Customer',
        email: email,
        isPrimary: true,
      })
    }

    const payload = {
      eventId: activeSession.value?.eventId || event.value?.id,
      paymentMethod: paymentMethod.value,
      customerEmail: customerEmail.value || null,
      promoCode: promoCode.value || null,
      attendees: attendeeList,
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
  <v-container>
    <PageTitle
      :subtitle="`${activeSession?.ticketCounterName || t('pages.counter.shift_start.counter_label')} • ${activeSession?.eventName || event?.name || t('home.loading_events')}`"
      :title="t('pages.counter.pos_title')"
      :title-key="'pages.counter.pos_title'"
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
          {{ t('pages.counter.end_session') }}
        </v-btn>
      </template>
    </PageTitle>

    <v-row>
      <!-- Main POS Area -->
      <v-col cols="12" md="8">
        <v-card class="mt-4" elevation="1" :rounded="rounded">
          <v-tabs v-model="tab" color="primary">
            <v-tab value="tickets">{{ t('pages.counter.tickets_tab') }}</v-tab>
            <v-tab value="products">{{ t('pages.counter.merch_tab') }}</v-tab>
          </v-tabs>

          <v-window v-model="tab">
            <v-window-item value="tickets">
              <v-container>
                <v-row>
                  <v-col
                    v-for="ticket in tickets"
                    :key="ticket.id"
                    cols="12"
                    lg="3"
                    md="4"
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
                    lg="3"
                    md="4"
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
            <span>{{ t('pages.counter.cart_title') }}</span>
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
              <p class="text-grey-darken-1 mt-2">{{ t('pages.counter.empty_cart') }}</p>
            </div>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-4 flex-column align-stretch">
            <div class="d-flex justify-space-between mb-1">
              <span class="text-body-2 text-grey">{{ t('pages.counter.subtotal') }}</span>
              <span class="text-body-2 text-grey">{{ formatPrice(cart.reduce((sum, item) => sum + item.price * item.quantity, 0), event?.currency) }}</span>
            </div>
            <div v-if="appliedPromo" class="d-flex justify-space-between mb-1">
              <span class="text-body-2 text-success">{{ t('pages.counter.discount') }}</span>
              <span class="text-body-2 text-success">-{{ appliedPromo.discountType === 'percentage' ? appliedPromo.discountValue + '%' : formatPrice(appliedPromo.discountValue, event?.currency) }}</span>
            </div>
            <div class="d-flex justify-space-between mb-4">
              <span class="text-h6">{{ t('pages.counter.total') }}</span>
              <span class="text-h6 color-primary font-weight-bold">{{ formatPrice(totalAmount, event?.currency) }}</span>
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
              {{ t('pages.counter.checkout_btn') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-dialog v-model="checkoutDialog" max-width="500" scrollable>
      <v-card :rounded="rounded">
        <v-card-title class="pa-4 d-flex align-center">
          <v-icon class="mr-2" color="primary">mdi-check-circle-outline</v-icon>
          {{ t('pages.counter.complete_sale') }}
          <v-spacer />
          <v-btn icon="mdi-close" variant="text" @click="checkoutDialog = false" />
        </v-card-title>

        <v-divider />

        <v-card-text class="pa-0">
          <!-- Summary Area -->
          <div class="bg-surface-variant pa-6 text-center">
            <div class="text-overline mb-1">{{ t('pages.counter.amount_due') }}</div>
            
            <div class="d-flex flex-column align-center">
              <div v-if="appliedPromo" class="text-body-2 text-medium-emphasis text-decoration-line-through mb-1">
                Subtotal: {{ formatPrice(cart.reduce((sum, item) => sum + item.price * item.quantity, 0), event?.currency) }}
              </div>
              
              <div class="text-h3 font-weight-bold text-primary mb-1">
                {{ formatPrice(totalAmount, event?.currency) }}
              </div>

              <v-chip
                v-if="appliedPromo"
                class="mt-2"
                color="success"
                label
                size="small"
                variant="flat"
              >
                <v-icon start>mdi-tag-outline</v-icon>
                -{{ appliedPromo.discountType === 'percentage' ? appliedPromo.discountValue + '%' : formatPrice(appliedPromo.discountValue, event?.currency) }}
              </v-chip>
            </div>
          </div>

          <div class="pa-6">
            <!-- Payment Method Section -->
            <div class="mb-6">
              <p class="text-subtitle-2 font-weight-bold mb-3">{{ t('pages.counter.payment_method') }}</p>
              <v-btn-toggle
                v-model="paymentMethod"
                block
                color="primary"
                mandatory
                variant="outlined"
              >
                <v-btn class="flex-grow-1" prepend-icon="mdi-cash" value="cash">
                  {{ t('pages.counter.cash') }}
                </v-btn>
                <v-btn class="flex-grow-1" prepend-icon="mdi-credit-card" value="card">
                  {{ t('pages.counter.card') }}
                </v-btn>
              </v-btn-toggle>
            </div>

            <!-- Customer Email Section -->
            <div class="mb-6">
              <p class="text-subtitle-2 font-weight-bold mb-3">{{ t('pages.counter.customer_email') }}</p>
              <v-text-field
                v-model="customerEmail"
                :density="density"
                hide-details="auto"
                :label="t('pages.counter.email_label')"
                :placeholder="t('pages.counter.email_placeholder')"
                prepend-inner-icon="mdi-email-outline"
                :rounded="rounded"
                type="email"
                variant="outlined"
              />
            </div>

            <!-- Promo Code Section -->
            <div>
              <p class="text-subtitle-2 font-weight-bold mb-3">{{ t('pages.counter.promo_code') }}</p>
              <v-text-field
                v-model="promoCode"
                :density="density"
                hide-details="auto"
                :label="t('pages.counter.apply_code_label')"
                :placeholder="t('pages.counter.apply_code_placeholder')"
                prepend-inner-icon="mdi-ticket-outline"
                :rounded="rounded"
                variant="outlined"
                @keydown.enter="handleApplyPromoCode"
              >
                <template #append-inner>
                  <v-btn
                    color="primary"
                    :disabled="!promoCode || applyingPromo || !!appliedPromo"
                    :loading="applyingPromo"
                    :rounded="rounded"
                    size="small"
                    variant="flat"
                    @click="handleApplyPromoCode"
                  >
                    {{ appliedPromo ? t('pages.counter.applied_label') : t('pages.counter.apply_btn') }}
                  </v-btn>
                </template>
              </v-text-field>
              
              <div v-if="appliedPromo" class="mt-2 text-success text-caption d-flex align-center">
                <v-icon class="mr-1" size="small">mdi-check-circle-outline</v-icon>
                {{ t('pages.counter.code_success') }}
              </div>
            </div>
          </div>
        </v-card-text>

        <v-divider />

        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            color="grey"
            :rounded="rounded"
            variant="text"
            @click="checkoutDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="submitting"
            :rounded="rounded"
            variant="flat"
            @click="handleProcessSale"
          >
            {{ t('pages.counter.confirm_sale') }}
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

<style>
.payment-toggle .v-btn {
  height: 48px !important;
}
</style>
