<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatDateTime, formatPrice } from '@/utils'

  definePage({
    name: 'dashboard-organizer-event-product-orders',
    meta: {
      layout: 'default',
      title: 'Product Orders',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { rounded, size, density, variant } = useUiProps()
  const store = useStore()
  const route = useRoute()
  const router = useRouter()

  const eventId = computed(() => route.params.eventId)
  const event = computed(() => store.state.event.event)
  const productOrders = computed(() => store.state.productOrder?.productOrders || [])
  const pagination = computed(() => store.state.productOrder?.pagination || {
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    itemsPerPage: 10,
    hasNextPage: false,
    hasPrevPage: false,
  })
  const error = computed(() => store.state.productOrder?.error || null)

  const currentPage = ref(1)
  const itemsPerPage = ref(10)
  const selectedOrder = ref(null)
  const showOrderDialog = ref(false)
  const statusUpdateLoading = ref(false)
  const searchKeyword = ref('')
  const loading = ref(false)
  const totalCount = ref(0)

  const statusOptions = [
    { value: 'pending', label: 'Pending', color: 'warning' },
    { value: 'processing', label: 'Processing', color: 'info' },
    { value: 'shipped', label: 'Shipped', color: 'indigo' },
    { value: 'delivered', label: 'Delivered', color: 'success' },
    { value: 'cancelled', label: 'Cancelled', color: 'error' },
  ]

  function getStatusColor (status) {
    const option = statusOptions.find(opt => opt.value === status)
    return option ? option.color : 'grey'
  }

  function getStatusLabel (status) {
    const option = statusOptions.find(opt => opt.value === status)
    return option ? option.label : status
  }

  function getCountryName (countryCode) {
    // Convert country code to readable country name
    const countryNames = {
      US: 'United States',
      GB: 'United Kingdom',
      CA: 'Canada',
      AU: 'Australia',
      ID: 'Indonesia',
      MY: 'Malaysia',
      SG: 'Singapore',
      PH: 'Philippines',
      TH: 'Thailand',
      VN: 'Vietnam',
      IN: 'India',
      JP: 'Japan',
      KR: 'South Korea',
      CN: 'China',
    // Add more common countries as needed
    }
    return countryNames[countryCode?.toUpperCase()] || countryCode?.toUpperCase() || countryCode
  }

  async function loadItems ({ page = 1, itemsPerPage = 10 } = {}) {
    loading.value = true
    try {
      const { totalItems } = await store.dispatch('productOrder/fetchProductOrders', {
        eventId: eventId.value,
        page,
        itemsPerPage,
        fetchTotalCount: true,
        searchKeyword: searchKeyword.value,
      })
      totalCount.value = totalItems
    } finally {
      loading.value = false
    }
  }

  function handleSearch () {
    loadItems()
  }

  function viewOrderDetails (event, { item }) {
    // Use existing order data from listing instead of making API call
    selectedOrder.value = item
    showOrderDialog.value = true
  }

  async function updateOrderStatus (orderId, newStatus) {
    try {
      statusUpdateLoading.value = true
      await store.dispatch('productOrder/updateProductOrderStatus', {
        orderId,
        productStatus: newStatus,
      })
    // Backend handles success/error messages
    } catch (error) {
      console.error('Error updating order status:', error)
    // Backend handles error messages
    } finally {
      statusUpdateLoading.value = false
    }
  }

  function goToPage (page) {
    currentPage.value = page
  }

  watch(currentPage, () => {
    loadItems()
  })


  onMounted(async () => {
    if (event.value.id !== eventId.value) {
      await store.dispatch('event/setEvent', { eventId: eventId.value })
    }
    return loadItems()
  })
</script>

<template>
  <v-container>
    <PageTitle
      :back-route="{ name: 'dashboard-organizer' }"
      :compact="true"
      :show-back-button="true"
      :subtitle="`${event?.name}${totalCount ? ' • ' + totalCount + ' Orders' : ''}`"
      title="Product Orders"
    >
    </PageTitle>

    <!-- Search Section -->
    <div class="d-flex align-center justify-end my-2 my-md-4">
      <v-text-field
        v-model="searchKeyword"
        append-inner-icon="mdi-magnify"
        clearable
        :density="density"
        hide-details
        label="Search by name/email/order #"
        :rounded="rounded"
        single-line
        :variant="variant"
        @click:append-inner="handleSearch"
        @keydown.enter="handleSearch"
      />
    </div>

    <!-- Product Orders Section -->
    <v-row justify="center">
      <v-col cols="12">
        <v-card
          class="overflow-hidden"
          elevation="2"
          :rounded="rounded"
        >
          <!-- Loading State Overlay -->
          <v-overlay
            class="align-center justify-center"
            contained
            :model-value="loading"
            persistent
          >
            <v-progress-circular color="primary" indeterminate />
          </v-overlay>

          <v-list v-if="productOrders && productOrders.length > 0" class="pa-0">
            <template v-for="(item, index) in productOrders" :key="item.orderId">
              <v-list-item
                class="py-4 px-4 order-list-item"
                :ripple="true"
                @click="viewOrderDetails(null, { item })"
              >
                <template #prepend>
                  <v-avatar
                    class="mr-4 elevation-1"
                    :color="getStatusColor(item.productStatus)"
                    size="48"
                  >
                    <span class="text-white font-weight-bold">
                      {{ (item.attendee?.firstName?.[0] || '') + (item.attendee?.lastName?.[0] || '') }}
                    </span>
                  </v-avatar>
                </template>

                <v-list-item-title class="d-flex align-center flex-wrap gap-2 mb-1">
                  <span class="text-h6 font-weight-bold mr-2">
                    {{ item.attendee?.firstName }} {{ item.attendee?.lastName }}
                  </span>
                  <v-chip
                    class="font-weight-bold"
                    :color="getStatusColor(item.productStatus)"
                    size="x-small"
                    variant="flat"
                  >
                    {{ getStatusLabel(item.productStatus) }}
                  </v-chip>
                  <v-chip
                    v-if="item.paymentStatus === 'paid'"
                    class="font-weight-bold"
                    color="success"
                    prepend-icon="mdi-check-circle"
                    size="x-small"
                    variant="tonal"
                  >
                    Paid
                  </v-chip>
                </v-list-item-title>

                <v-list-item-subtitle class="d-flex flex-column">
                  <span class="text-body-2 text-medium-emphasis d-flex align-center mb-1">
                    <v-icon class="mr-1" size="small">mdi-email-outline</v-icon>
                    {{ item.attendee?.email }}
                  </span>
                  <div class="d-flex align-center flex-wrap gap-x-4 gap-y-1">
                    <span class="text-caption text-grey d-flex align-center">
                      <v-icon class="mr-1" size="14">mdi-identifier</v-icon>
                      Order #{{ item.orderNumber }}
                    </span>
                    <span class="text-caption text-grey d-flex align-center">
                      <v-icon class="mr-1" size="14">mdi-calendar-clock</v-icon>
                      {{ formatDateTime({input: item.orderCreatedAt}) }}
                    </span>
                    <span class="text-caption font-weight-bold text-primary d-flex align-center">
                      <v-icon class="mr-1" size="14">mdi-cash</v-icon>
                      {{ formatPrice(item.totalAmount, item.currency) }}
                    </span>
                  </div>
                </v-list-item-subtitle>

                <template #append>
                  <div class="d-flex align-center">
                    <v-menu transition="scale-transition">
                      <template #activator="{ props }">
                        <v-btn
                          :density="density"
                          icon="mdi-dots-vertical"
                          v-bind="props"
                          variant="text"
                          @click.stop
                        />
                      </template>
                      <v-list density="compact" :rounded="rounded">
                        <v-list-item
                          prepend-icon="mdi-eye-outline"
                          title="View Details"
                          @click="viewOrderDetails(null, { item })"
                        />
                        <v-divider class="my-1" />
                        <v-list-subheader>Update Status</v-list-subheader>
                        <v-list-item
                          v-for="status in statusOptions"
                          :key="status.value"
                          :active="item.productStatus === status.value"
                          @click="updateOrderStatus(item.orderId, status.value)"
                        >
                          <template #prepend>
                            <v-icon :color="status.color" size="small">mdi-circle</v-icon>
                          </template>
                          <v-list-item-title>{{ status.label }}</v-list-item-title>
                        </v-list-item>
                      </v-list>
                    </v-menu>
                  </div>
                </template>
              </v-list-item>
              <v-divider v-if="index < productOrders.length - 1" :key="'divider-'+index" inset />
            </template>
          </v-list>

          <div v-else-if="!loading" class="py-10">
            <AppNoData
              icon="mdi-package-variant-closed"
              message="No product orders found for this event. Once attendees purchase products, they will appear here."
              title="No Product Orders"
            />
          </div>

          <!-- Pagination Footer -->
          <v-divider />
          <div class="pa-4 d-flex justify-center">
            <v-pagination
              v-model="currentPage"
              active-color="primary"
              density="comfortable"
              :length="pagination.totalPages"
              :total-visible="7"
              variant="text"
              @update:model-value="loadItems({ page: $event })"
            />
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- Order Details Dialog -->
  <v-dialog
    v-model="showOrderDialog"
    scrollable
    width="600"
  >
    <v-card v-if="selectedOrder" class="border" :rounded="rounded">
      <v-card-title class="pa-4 d-flex align-center bg-surface">
        <v-icon class="mr-2" color="primary" icon="mdi-package-variant" />
        <span class="text-h5 font-weight-bold">Order Details</span>
        <v-spacer />
        <v-btn
          density="compact"
          icon="mdi-close"
          variant="text"
          @click="showOrderDialog = false"
        />
      </v-card-title>

      <v-card-text class="pa-0">
        <div class="pa-4">
          <!-- Order Header Info -->
          <div class="d-flex align-center mb-6">
            <v-avatar class="mr-4 elevation-2" :color="getStatusColor(selectedOrder.productStatus)" size="80">
              <span class="text-h4 text-white">
                {{ (selectedOrder.attendee?.firstName?.[0] || '') + (selectedOrder.attendee?.lastName?.[0] || '') }}
              </span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ selectedOrder.attendee?.firstName }} {{ selectedOrder.attendee?.lastName }}</div>
              <div class="text-body-1 text-medium-emphasis">{{ selectedOrder.attendee?.email || '-' }}</div>
              <div class="text-caption text-grey mt-1">
                Order #{{ selectedOrder.orderNumber }} • Date: {{ formatDateTime({input: selectedOrder.orderCreatedAt}) }}
              </div>
            </div>
          </div>

          <v-divider class="mb-6" />

          <!-- Payment Summary -->
          <div class="section-label text-overline font-weight-bold text-primary mb-3">Order Summary</div>
          <v-card class="pa-4 rounded-lg mb-6" color="primary" variant="tonal">
            <div class="d-flex justify-space-between align-center">
              <div>
                <div class="text-subtitle-2 text-primary font-weight-bold">Total Amount</div>
                <div class="text-h4 font-weight-bold">{{ formatPrice(selectedOrder.totalAmount, selectedOrder.currency) }}</div>
              </div>
              <div class="text-right">
                <v-chip
                  class="font-weight-bold"
                  :color="selectedOrder.paymentStatus === 'paid' ? 'success' : 'warning'"
                  variant="flat"
                >
                  {{ selectedOrder.paymentStatus?.toUpperCase() }}
                </v-chip>
              </div>
            </div>
          </v-card>

          <!-- Products Section -->
          <div class="section-label text-overline font-weight-bold text-primary mb-3">Items Purchased</div>
          <v-list class="bg-transparent pa-0">
            <v-list-item
              v-for="product in selectedOrder.products"
              :key="product.productId"
              class="px-0 py-2 border-b"
            >
              <template #prepend>
                <v-avatar color="indigo-lighten-4" rounded size="40">
                  <v-icon color="indigo" icon="mdi-package-variant-closed" />
                </v-avatar>
              </template>
              <v-list-item-title class="font-weight-bold">{{ product.name }}</v-list-item-title>
              <v-list-item-subtitle>
                {{ product.quantity }} x {{ formatPrice(product.price, selectedOrder.currency) }}
              </v-list-item-subtitle>
              <template #append>
                <span class="font-weight-bold">{{ formatPrice(product.totalPrice, selectedOrder.currency) }}</span>
              </template>
            </v-list-item>
          </v-list>

          <v-divider class="my-6" />

          <!-- Shipping Section -->
          <div v-if="selectedOrder.shippingType" class="section-label text-overline font-weight-bold text-primary mb-3">Shipping Information</div>
          <v-card v-if="selectedOrder.shippingType" class="border rounded-lg pa-4 elevation-1 mb-6">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-3" color="primary" size="32">
                {{ selectedOrder.shippingType === 'delivery' ? 'mdi-truck-delivery' : 'mdi-store' }}
              </v-icon>
              <div>
                <div class="text-h6 font-weight-bold">
                  {{ selectedOrder.shippingType === 'delivery' ? 'Home Delivery' : 'Pickup' }}
                </div>
                <div v-if="selectedOrder.shippingCost > 0" class="text-caption text-medium-emphasis">
                  Shipping Cost: {{ formatPrice(selectedOrder.shippingCost, selectedOrder.currency) }}
                </div>
              </div>
            </div>

            <div v-if="selectedOrder.shippingAddress && selectedOrder.shippingType === 'delivery'" class="ml-11">
              <div class="text-caption text-grey mb-1">Shipping Address</div>
              <div class="text-body-2 font-weight-medium">
                <div>{{ selectedOrder.shippingAddress.line1 }}</div>
                <div v-if="selectedOrder.shippingAddress.line2">{{ selectedOrder.shippingAddress.line2 }}</div>
                <div>
                  {{ selectedOrder.shippingAddress.city }}
                  <template v-if="selectedOrder.shippingAddress.state">, {{ selectedOrder.shippingAddress.state }}</template>
                  {{ selectedOrder.shippingAddress.postal_code }}
                </div>
                <div>{{ getCountryName(selectedOrder.shippingAddress.country) }}</div>
              </div>
            </div>
          </v-card>

          <!-- Status Update Section -->
          <div class="section-label text-overline font-weight-bold text-primary mb-3">Product Status</div>
          <v-card class="border rounded-lg pa-4 elevation-1">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-3" :color="getStatusColor(selectedOrder.productStatus)" size="32">
                mdi-circle-slice-8
              </v-icon>
              <div class="text-h6 font-weight-bold">
                {{ getStatusLabel(selectedOrder.productStatus) }}
              </div>
            </div>

            <div class="mb-2">
              <div class="text-caption text-grey mb-1 ml-11">Update Order Status</div>
              <v-select
                v-model="selectedOrder.productStatus"
                class="ml-11"
                density="compact"
                hide-details
                item-title="label"
                item-value="value"
                :items="statusOptions"
                :rounded="rounded"
                style="max-width: 250px;"
                :variant="variant"
                @update:model-value="updateOrderStatus(selectedOrder.orderId, $event)"
              />
            </div>
          </v-card>
        </div>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn
          class="px-6"
          color="primary"
          :rounded="rounded"
          variant="flat"
          @click="showOrderDialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.order-list-item {
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.order-list-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.05);
  border-left-color: rgb(var(--v-theme-primary));
}

.section-label {
  letter-spacing: 1px;
}

.gap-x-4 {
  column-gap: 16px;
}

.gap-y-1 {
  row-gap: 4px;
}

.border-b {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.border-b:last-child {
  border-bottom: none;
}
</style>
