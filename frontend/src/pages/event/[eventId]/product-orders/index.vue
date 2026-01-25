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
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-download"
          :rounded="rounded"
          :size="size"
          @click="handleDownload"
        >
          Download
        </v-btn>
      </template>
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

    <!-- Product Orders Table -->
    <v-row justify="center">
      <v-col cols="12">
        <v-card
          class="no-hover"
          elevation="2"
          :rounded="rounded"
        >
          <v-data-table-server
            v-model:items-per-page="itemsPerPage"
            :density="density"
            :headers="[
              { title: 'Order #', key: 'orderNumber', sortable: false },
              { title: 'Customer', key: 'attendee', sortable: false },
              { title: 'Products', key: 'totalProducts', sortable: false },
              { title: 'Total', key: 'totalAmount', sortable: false },
              { title: 'Status', key: 'productStatus', sortable: false },
              { title: 'Date', key: 'orderCreatedAt', sortable: false }
            ]"
            hover
            :items="productOrders"
            :items-length="totalCount"
            :loading="loading"
            @click:row="viewOrderDetails"
            @update:options="loadItems"
          >
            <template #item.attendee="{ item }">
              <div>
                <div class="font-weight-medium">
                  {{ item.attendee.firstName }} {{ item.attendee.lastName }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.attendee.email }}
                </div>
              </div>
            </template>

            <template #item.totalProducts="{ item }">
              <div>
                <div class="font-weight-medium">
                  {{ item.totalProducts }} items
                </div>
                <div class="text-caption text-medium-emphasis">
                  {{ item.totalProductQuantity }} total qty
                </div>
              </div>
            </template>

            <template #item.totalAmount="{ item }">
              <div class="font-weight-medium">
                {{ formatPrice(item.totalAmount, item.currency) }}
              </div>
            </template>

            <template #item.productStatus="{ item }">
              <v-menu>
                <template #activator="{ props }">
                  <v-chip
                    :color="getStatusColor(item.productStatus)"
                    size="small"
                    style="cursor: pointer"
                    v-bind="props"
                    variant="flat"
                    @click.stop
                  >
                    {{ getStatusLabel(item.productStatus) }}
                  </v-chip>
                </template>
                <v-list>
                  <v-list-item
                    v-for="status in statusOptions"
                    :key="status.value"
                    @click="updateOrderStatus(item.orderId, status.value)"
                  >
                    <v-list-item-title>{{ status.label }}</v-list-item-title>
                  </v-list-item>
                </v-list>
              </v-menu>
            </template>

            <template #item.orderCreatedAt="{ item }">
              <div class="text-body-2">
                {{ formatDateTime({input: item.orderCreatedAt}) }}
              </div>
            </template>

            <template #no-data>
              <div class="py-10">
                <AppNoData
                  icon="mdi-package-variant-closed"
                  message="No product orders found for this event. Once attendees purchase products, they will appear here."
                  title="No Product Orders"
                />
              </div>
            </template>
          </v-data-table-server>
        </v-card>
      </v-col>
    </v-row>

  </v-container>

  <!-- Order Details Dialog -->
  <v-dialog
    v-model="showOrderDialog"
    max-width="800"
    scrollable
  >
    <v-card v-if="selectedOrder" class="no-hover">
      <v-card-title class="d-flex align-center justify-space-between">
        <div>
          <h3 class="text-h6">Order Details</h3>
          <p class="text-body-2 text-medium-emphasis mb-0">
            Order #{{ selectedOrder.orderNumber }}
          </p>
        </div>
      </v-card-title>

      <v-card-text>
        <!-- Order Summary -->
        <v-card
          class="mb-4"
          variant="outlined"
        >
          <v-card-title class="text-subtitle-1">
            Order Summary
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">Total Amount</div>
                <div class="text-h6">
                  {{ formatPrice(selectedOrder.totalAmount, selectedOrder.currency) }}
                </div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">Payment Status</div>
                <v-chip
                  :color="selectedOrder.paymentStatus === 'paid' ? 'success' : 'warning'"
                  size="small"
                  variant="flat"
                >
                  {{ selectedOrder.paymentStatus }}
                </v-chip>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Products -->
        <v-card
          v-if="selectedOrder.products.length > 0"
          class="mb-4"
          variant="outlined"
        >
          <v-card-title class="text-subtitle-1">
            Products ({{ selectedOrder.products.length }})
          </v-card-title>
          <v-card-text>
            <div
              v-for="product in selectedOrder.products"
              :key="product.productId"
              class="d-flex justify-space-between align-center py-2 border-b"
            >
              <div>
                <div class="font-weight-medium">{{ product.name }}</div>
                <div class="text-caption text-medium-emphasis">
                  {{ formatPrice(product.price, selectedOrder.currency) }} each
                </div>
              </div>
              <div class="text-right">
                <div class="font-weight-medium">
                  {{ formatPrice(product.totalPrice, selectedOrder.currency) }}
                </div>
                <div class="text-caption text-medium-emphasis">
                  Qty: {{ product.quantity }}
                </div>
              </div>
            </div>
          </v-card-text>
        </v-card>

        <!-- Customer Info -->
        <v-card variant="outlined">
          <v-card-title class="text-subtitle-1">
            Customer Information
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">Name</div>
                <div class="font-weight-medium">
                  {{ selectedOrder.attendee?.firstName }} {{ selectedOrder.attendee?.lastName }}
                </div>
              </v-col>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">Email</div>
                <div class="font-weight-medium">
                  {{ selectedOrder.attendee?.email }}
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>

        <!-- Shipping Information -->
        <v-card
          v-if="selectedOrder.shippingType"
          class="mt-4"
          variant="outlined"
        >
          <v-card-title class="text-subtitle-1">
            <v-icon class="mr-2">mdi-truck-delivery</v-icon>
            Shipping Information
          </v-card-title>
          <v-card-text>
            <v-row>
              <v-col cols="6">
                <div class="text-caption text-medium-emphasis">Shipping Method</div>
                <v-chip
                  :color="selectedOrder.shippingType === 'delivery' ? 'primary' : 'secondary'"
                  size="small"
                  variant="flat"
                >
                  {{ selectedOrder.shippingType === 'delivery' ? 'Delivery' : 'Pickup' }}
                </v-chip>
              </v-col>
              <v-col
                v-if="selectedOrder.shippingCost > 0"
                cols="6"
              >
                <div class="text-caption text-medium-emphasis">Shipping Cost</div>
                <div class="font-weight-medium">
                  {{ formatPrice(selectedOrder.shippingCost, selectedOrder.currency) }}
                </div>
              </v-col>
              <v-col
                v-if="selectedOrder.shippingAddress && selectedOrder.shippingType === 'delivery'"
                cols="12"
              >
                <div class="text-caption text-medium-emphasis mt-2">Shipping Address</div>
                <div class="font-weight-medium">
                  <div v-if="selectedOrder.shippingAddress.line1">
                    {{ selectedOrder.shippingAddress.line1 }}
                  </div>
                  <div v-if="selectedOrder.shippingAddress.line2">
                    {{ selectedOrder.shippingAddress.line2 }}
                  </div>
                  <div
                    v-if="selectedOrder.shippingAddress.city || selectedOrder.shippingAddress.state || selectedOrder.shippingAddress.postal_code"
                  >
                    <template v-if="selectedOrder.shippingAddress.city">
                      {{ selectedOrder.shippingAddress.city }}
                      <template v-if="selectedOrder.shippingAddress.state || selectedOrder.shippingAddress.postal_code">
                        ,
                      </template>
                    </template>
                    <template v-if="selectedOrder.shippingAddress.state">
                      {{ selectedOrder.shippingAddress.state }}
                      <template v-if="selectedOrder.shippingAddress.postal_code" />
                    </template>
                    <template v-if="selectedOrder.shippingAddress.postal_code">
                      {{ selectedOrder.shippingAddress.postal_code }}
                    </template>
                  </div>
                  <div v-if="selectedOrder.shippingAddress.country">
                    {{ getCountryName(selectedOrder.shippingAddress.country) }}
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn
          color="primary"
          :rounded="rounded"
          :size="size"
          :variant="variant"
          @click="showOrderDialog = false"
        >
          Close
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.border-b {
  border-bottom: 1px solid rgba(var(--v-theme-outline), 0.12);
}

.border-b:last-child {
  border-bottom: none;
}

.no-hover {
  transition: none !important;
}

.no-hover:hover {
  transform: none !important;
  box-shadow: none !important;
}
</style>
