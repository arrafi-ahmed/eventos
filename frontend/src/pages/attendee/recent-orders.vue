<script setup>
  import { computed, onMounted, ref } from 'vue'
  import TicketDialog from '@/components/TicketDialog.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatPrice } from '@/utils'
  import { useStore } from 'vuex'

  definePage({
    name: 'recent-orders',
    meta: {
      layout: 'default',
      requiresAuth: true,
      title: 'My Orders',
    },
  })

  const store = useStore()
  const { rounded } = useUiProps()

  const orders = ref([])
  const isLoading = ref(true)
  const isResending = ref(null) // Stores orderId being resent
  
  const showTicketDialog = ref(false)
  const selectedOrder = ref(null)

  // Pagination state
  const currentPage = ref(1)
  const itemsPerPage = 10

  const totalPages = computed(() => Math.ceil(orders.value.length / itemsPerPage))

  const paginatedOrders = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage
    const end = start + itemsPerPage
    return orders.value.slice(start, end)
  })

  async function fetchOrders () {
    try {
      isLoading.value = true
      const response = await $axios.get('/attendee-order/my-orders')
      orders.value = response.data.payload || []
    } catch (error) {
      console.error('Failed to fetch orders:', error)
      store.commit('addSnackbar', { text: 'Failed to load orders', color: 'error' })
    } finally {
      isLoading.value = false
    }
  }

  async function resendTicket (orderId) {
    try {
      isResending.value = orderId
      await $axios.post('/attendee-order/email-ticket', { orderId })
      store.commit('addSnackbar', { text: 'Tickets have been sent to your email!', color: 'success' })
    } catch (error) {
      console.error('Failed to resend ticket:', error)
      store.commit('addSnackbar', { text: 'Failed to resend tickets', color: 'error' })
    } finally {
      isResending.value = null
    }
  }

  function viewTicket (order) {
    selectedOrder.value = order
    showTicketDialog.value = true
  }

  function formatDate (dateStr) {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  onMounted(() => {
    fetchOrders()
  })
</script>

<template>
  <v-container class="py-12">
    <div class="max-width-container mx-auto">
      <!-- Header -->
      <div class="d-flex align-center justify-space-between mb-8">
        <div>
          <h1 class="text-h4 font-weight-bold mb-1">My Orders</h1>
          <p class="text-body-1 text-medium-emphasis">View and manage your ticket history</p>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="d-flex justify-center align-center py-16">
        <v-progress-circular indeterminate color="primary" size="48" />
      </div>

      <!-- Empty State -->
      <div v-else-if="orders.length === 0" class="text-center py-16">
        <v-avatar color="surface-variant" size="80" class="mb-4">
          <v-icon size="40" color="medium-emphasis">mdi-ticket-outline</v-icon>
        </v-avatar>
        <h2 class="text-h5 font-weight-bold mb-2">No orders yet</h2>
        <p class="text-medium-emphasis mb-6">Looks like you haven't purchased any tickets.</p>
        <v-btn
          color="primary"
          :rounded="rounded"
          size="large"
          flat
          :to="{ name: 'events-browse' }"
        >
          Browse Events
        </v-btn>
      </div>

      <!-- Orders List -->
      <div v-else>
        <v-card
          v-for="order in paginatedOrders"
          :key="order.id"
          class="mb-4 hover-card"
          elevation="0"
          border
          :rounded="rounded"
        >
          <div class="d-flex flex-column flex-md-row align-md-center pa-5">
            <!-- Order Date Block -->
            <div class="d-flex flex-column align-center justify-center bg-surface-variant rounded-lg px-4 py-2 mr-md-6 mb-4 mb-md-0" style="min-width: 80px;">
              <span class="text-overline font-weight-bold text-medium-emphasis mb-n1">{{ order.eventDate ? new Date(order.eventDate).toLocaleString('default', { month: 'short' }).toUpperCase() : 'N/A' }}</span>
              <span class="text-h5 font-weight-black text-primary">{{ order.eventDate ? new Date(order.eventDate).getDate() : '--' }}</span>
            </div>

            <!-- Event Details -->
            <div class="flex-grow-1 mb-4 mb-md-0">
              <div class="text-caption text-medium-emphasis mb-1">Order #{{ order.orderNumber }} • {{ formatDate(order.createdAt) }}</div>
              <h3 class="text-h6 font-weight-bold mb-1">{{ order.eventName }}</h3>
              <div class="d-flex align-center gap-2">
                <v-chip
                  :color="order.paymentStatus === 'paid' ? 'success' : 'warning'"
                  size="x-small"
                  variant="tonal"
                  label
                  class="font-weight-bold text-uppercase"
                >
                  {{ order.paymentStatus || 'Pending' }}
                </v-chip>
                <span class="text-body-2 text-medium-emphasis">{{ formatPrice(order.totalAmount, order.currency) }}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="d-flex flex-row align-center gap-3">
              <v-btn
                prepend-icon="mdi-email-outline"
                variant="text"
                color="medium-emphasis"
                size="small"
                :loading="isResending === order.id"
                @click="resendTicket(order.id)"
              >
                Resend Email
              </v-btn>
              <v-btn
                color="primary"
                variant="flat"
                :rounded="rounded"
                prepend-icon="mdi-ticket-confirmation-outline"
                @click="viewTicket(order)"
              >
                View Ticket
              </v-btn>
            </div>
          </div>
        </v-card>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="d-flex justify-center mt-8">
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="5"
            rounded="circle"
            active-color="primary"
            variant="text"
          />
        </div>
      </div>
    </div>

    <!-- Ticket View Dialog -->
    <TicketDialog
      v-if="selectedOrder"
      v-model="showTicketDialog"
      :order="selectedOrder"
    />
  </v-container>
</template>

<style scoped>
.max-width-container {
  max-width: 800px;
}
.gap-2 {
  gap: 8px;
}
.gap-3 {
  gap: 12px;
}
.hover-card {
  transition: all 0.2s ease;
}
.hover-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
  border-color: rgba(var(--v-theme-primary), 0.5);
}
</style>
