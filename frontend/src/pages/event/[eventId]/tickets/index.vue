<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'event-tickets',
    meta: {
      layout: 'default',
      title: 'Event Tickets',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  // Import formatPrice and getCurrencySymbol from utils
  import { formatPrice, getCurrencySymbol } from '@/utils'

  const { xs } = useDisplay()
  const { rounded, variant, density, size } = useUiProps()
  const store = useStore()
  const route = useRoute()
  const router = useRouter()

  const event = computed(() => store.state.event.event)

  const tickets = computed(() => store.state.ticket.tickets)
  const isLoading = ref(false)

  // Ticket form data
  const ticketDialog = ref(false)
  const isEditing = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)

  const ticketInit = {
    id: null,
    title: '',
    description: '',
    price: 0,
    originalPrice: 0,
    currentStock: 100,
    maxStock: 100,
    onSiteQuota: 0,
    lowStockThreshold: 5,
    saleStartDate: null,
    saleEndDate: null,
    eventId: route.params.eventId,
  }

  const ticket = reactive({ ...ticketInit })
  const isLimitedTime = ref(false)

  const saleDates = computed({
    get () {
      if (ticket.saleStartDate && ticket.saleEndDate) {
        return [new Date(ticket.saleStartDate), new Date(ticket.saleEndDate)]
      } else if (ticket.saleStartDate) {
        return [new Date(ticket.saleStartDate)]
      }
      return []
    },
    set (dates) {
      if (!dates || dates.length === 0) {
        ticket.saleStartDate = null
        ticket.saleEndDate = null
        return
      }

      // Sort dates to ensure start is before end
      const sortedDates = [...dates].sort((a, b) => a - b)

      // Set start date (ISO string)
      ticket.saleStartDate = sortedDates[0].toISOString()

      // Set end date if available, otherwise clear it or set same as start?
      // Usually range picker implies 2 dates. If only 1 picked, wait for 2nd?
      // If length is 1, treat as start. If length > 1, treat last as end.
      if (sortedDates.length > 1) {
        // Set end date to end of day if it was just picked from calendar without time?
        // Actually v-date-input returns timestamps (usually midnight).
        // Let's keep the exact time from the picker.
        ticket.saleEndDate = sortedDates.at(-1).toISOString()
      } else {
        ticket.saleEndDate = null
      }
    },
  })

  watch(isLimitedTime, val => {
    if (!val) {
      ticket.saleStartDate = null
      ticket.saleEndDate = null
      ticket.originalPrice = null
    }
  })

  function openAddDialog () {
    isEditing.value = false
    isLimitedTime.value = false
    Object.assign(ticket, {
      ...ticketInit,
      eventId: route.params.eventId,
      currentStock: 100,
      maxStock: 100,
      onSiteQuota: event.value?.config?.defaultOnSiteQuota || 0,
      lowStockThreshold: event.value?.config?.defaultLowStockThreshold || 5,
      saleStartDate: null,
      saleEndDate: null,
    })
    ticketDialog.value = true
  }

  function openEditDialog (selectedTicket) {
    isEditing.value = true

    // check if ticket has dates
    const hasDates = !!(selectedTicket.saleStartDate || selectedTicket.saleEndDate)
    isLimitedTime.value = hasDates

    // Convert cents back to dollars for editing
    const ticketData = {
      ...selectedTicket,
      price: selectedTicket.price / 100, // Convert cents to dollars
      originalPrice: selectedTicket.originalPrice ? selectedTicket.originalPrice / 100 : null, // Convert cents to dollars if set
      onSiteQuota: selectedTicket.onSiteQuota || 0,
      lowStockThreshold: selectedTicket.lowStockThreshold || 5,
      saleStartDate: selectedTicket.saleStartDate,
      saleEndDate: selectedTicket.saleEndDate,
    }
    Object.assign(ticket, ticketData)
    ticketDialog.value = true
  }

  function closeDialog () {
    ticketDialog.value = false
    Object.assign(ticket, { ...ticketInit })
  }

  async function handleSubmitTicket () {
    await form.value.validate()
    if (!isFormValid.value) return

    try {
      isLoading.value = true

      // Convert dollars to cents for storage
      const ticketData = {
        ...ticket,
        price: Math.round(ticket.price * 100), // Convert dollars to cents
        originalPrice: ticket.originalPrice ? Math.round(ticket.originalPrice * 100) : null, // Convert dollars to cents
      }

      const result = await store.dispatch('ticket/saveTicket', ticketData)

      closeDialog()
    // No need to fetchTickets() since the store already updates the local state
    } catch {
    // Backend already sends error message via ApiResponse
    } finally {
      isLoading.value = false
    }
  }

  async function deleteTicket (ticketId) {
    try {
      await store.dispatch('ticket/removeTicket', {
        ticketId,
        eventId: route.params.eventId,
      })
    // No need to fetchTickets() since the store already updates the local state
    } catch {}
  }

  async function fetchTickets () {
    try {
      await store.dispatch('ticket/setTickets', route.params.eventId)
    } catch {
    // Backend already sends error message via ApiResponse
    }
  }

  onMounted(() => {
    store.dispatch('event/setEvent', { eventId: route.params.eventId })
    fetchTickets()
  })
</script>

<template>
  <v-container class="tickets-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Manage Tickets"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          variant="elevated"
          @click="openAddDialog"
        >
          Add Ticket
        </v-btn>
      </template>

    </PageTitle>

    <!-- Tickets Grid -->
    <v-row
      v-if="tickets.length > 0"
      justify="center"
    >
      <v-col
        v-for="ticket in tickets"
        :key="ticket.id"
        cols="12"
        lg="4"
        md="6"
      >
        <v-card
          class="ticket-card"
          elevation="4"
          :rounded="rounded"
        >
          <v-card-text class="pa-6">
            <div class="d-flex justify-space-between align-start mb-4">
              <div class="mb-4 flex-grow-1 min-width-0 mr-2">
                <h3 class="text-h5 font-weight-bold mb-1 line-clamp-2">
                  {{ ticket.title }}
                </h3>
                <div class="d-flex flex-wrap gap-2">
                  <v-chip
                    v-if="ticket.saleStartDate || ticket.saleEndDate"
                    class="font-weight-bold"
                    color="secondary"
                    size="x-small"
                    variant="flat"
                  >
                    Early Bird
                  </v-chip>
                  <v-chip
                    v-if="ticket.originalPrice && ticket.originalPrice > ticket.price"
                    class="font-weight-bold"
                    color="error"
                    size="x-small"
                    variant="flat"
                  >
                    SAVE {{ Math.round(((ticket.originalPrice - ticket.price) / ticket.originalPrice) * 100) }}%
                  </v-chip>
                </div>
              </div>

              <v-menu>
                <template #activator="{ props }">
                  <v-btn
                    v-bind="props"
                    class="flex-shrink-0"
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                  />
                </template>
                <v-list
                  density="compact"
                >
                  <v-list-item
                    prepend-icon="mdi-pencil"
                    title="Edit"
                    @click="openEditDialog(ticket)"
                  />
                  <v-divider />
                  <confirmation-dialog @confirm="deleteTicket(ticket.id)">
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        prepend-icon="mdi-delete"
                        title="Delete"
                        @click.stop="onClick"
                      />
                    </template>
                  </confirmation-dialog>
                </v-list>
              </v-menu>
            </div>

            <p class="text-body-2 mb-4 text-medium-emphasis">
              {{ ticket.description }}
            </p>

            <div class="ticket-details">
              <div class="d-flex justify-space-between align-center mb-3 flex-wrap gap-2">
                <div class="price-stock-container">
                  <div class="text-h4 font-weight-bold text-primary text-truncate-price">
                    {{ formatPrice(ticket.price, event?.currency) }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Stock: {{ ticket.currentStock || 0 }}/{{ ticket.maxStock || 0 }}
                  </div>
                </div>
                <v-chip
                  :color="ticket.currentStock > 0 ? 'success' : 'error'"
                  size="small"
                  variant="elevated"
                >
                  {{ ticket.currentStock > 0 ? 'Available' : 'Sold Out' }}
                </v-chip>
              </div>

              <!-- Stock Progress Bar -->
              <v-progress-linear
                class="mb-2"
                :color="ticket.currentStock > 0 ? 'success' : 'error'"
                height="8"
                :model-value="
                  ticket.maxStock > 0 ? (ticket.currentStock / ticket.maxStock) * 100 : 0
                "
                rounded
              />
              <div class="text-caption text-medium-emphasis text-center">
                {{
                  ticket.maxStock > 0
                    ? Math.round((ticket.currentStock / ticket.maxStock) * 100)
                    : 0
                }}% remaining
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Empty State -->
    <v-row v-else>
      <v-col cols="12">
        <v-card
          class="empty-state-card"
          elevation="2"
          :rounded="rounded"
        >
          <AppNoData
            icon="mdi-ticket-outline"
            message="Create tickets for your event to start accepting registrations. You can offer free or paid tickets."
            title="No Tickets Found"
          >
            <template #actions>
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                :rounded="rounded"
                :size="size"
                variant="elevated"
                @click="openAddDialog"
              >
                Create Your First Ticket
              </v-btn>
            </template>
          </AppNoData>
        </v-card>
      </v-col>
    </v-row>

    <!-- Ticket Dialog -->
    <v-dialog
      v-model="ticketDialog"
      max-width="600"
      persistent
    >
      <v-card
        class="form-card"
        elevation="4"
        :rounded="rounded"
      >
        <v-card-text class="pa-6">
          <div class="text-center mb-6">
            <h2 class="text-h4 font-weight-bold mb-2">
              {{ isEditing ? 'Edit Ticket' : 'Add New Ticket' }}
            </h2>
            <p class="text-body-1 text-medium-emphasis">
              {{
                isEditing
                  ? 'Update ticket details and pricing'
                  : 'Create a new ticket for your event'
              }}
            </p>
          </div>

          <v-form
            ref="form"
            v-model="isFormValid"
            fast-fail
          >
            <v-text-field
              v-model="ticket.title"
              class="mb-4"
              :density="density"
              hide-details="auto"
              label="Ticket Title"
              prepend-inner-icon="mdi-ticket"
              required
              :rounded="rounded"
              :rules="[(v) => !!v || 'Title is required!']"
              :variant="variant"
            />

            <v-textarea
              v-model="ticket.description"
              class="mb-4"
              :density="density"
              hide-details="auto"
              label="Description (optional)"
              prepend-inner-icon="mdi-text-box"
              :rounded="rounded"
              rows="3"
              :variant="variant"
            />

            <div class="d-flex gap-6 mb-4">
              <v-number-input
                v-model="ticket.price"
                :density="density"
                hide-details="auto"
                label="Price"
                min="0"
                inset
                :prefix="getCurrencySymbol({ code: event?.currency || 'USD', type: 'symbol' })"
                control-variant="default"
                :rounded="rounded"
                class="flex-1"
                :rules="[(v) => v >= 0 || 'Price must be non-negative']"                
                :variant="variant"
              />

              <v-number-input
                v-if="isLimitedTime"
                v-model="ticket.originalPrice"
                :density="density"
                hide-details="auto"
                label="Original Price"
                min="0"
                placeholder="Optional"
                inset
                :prefix="getCurrencySymbol({ code: event?.currency || 'USD', type: 'symbol' })"                
                :rounded="rounded"
                class="flex-1"                
                :variant="variant"
              />
            </div>

            <div class="d-flex gap-4 mb-6">
              <v-number-input
                v-model.number="ticket.currentStock"
                class="flex-1"
                :density="density"
                hide-details="auto"
                label="Current Stock"
                inset
                min="0"
                control-variant="default"
                prepend-inner-icon="mdi-package-variant"
                :rounded="rounded"
                :rules="[(v) => v >= 0 || 'Current stock must be non-negative']"
                :variant="variant"
              />
              <v-number-input
                v-model.number="ticket.maxStock"
                class="flex-1"
                :density="density"
                hide-details="auto"
                label="Max Stock"
                min="0"
                prepend-inner-icon="mdi-package-variant-closed"
                inset
                required
                control-variant="default"
                :rounded="rounded"
                :rules="[
                  (v) => !!v || 'Max stock is required!',
                  (v) => v >= 0 || 'Max stock must be non-negative',
                  (v) => v >= ticket.currentStock || 'Max stock must be >= current stock',
                ]"
                :variant="variant"
              />
            </div>

            <!-- Early Bird / Limited Time Toggle -->
            <div class="mb-4">
              <v-switch
                v-model="isLimitedTime"
                class="mb-2"
                :color="isLimitedTime ? 'primary' : 'grey'"
                hide-details
                inset
                :label="isLimitedTime ? 'Limited Time Sale (Early Bird)' : 'Standard Availability'"
              >
                <template #label>
                  <div class="d-flex align-center">
                    <span class="font-weight-medium mr-2">Limited Time Sale</span>
                    <v-chip v-if="isLimitedTime" color="secondary" size="x-small" variant="flat">Early Bird</v-chip>
                  </div>
                </template>
              </v-switch>

              <p v-if="!isLimitedTime" class="text-caption text-medium-emphasis ml-2 mb-2">
                Ticket is available for purchase indefinitely.
              </p>

              <div v-if="isLimitedTime" class="mt-4">
                <v-date-input
                  v-model="saleDates"
                  color="primary"
                  :density="density"
                  hide-details="auto"
                  label="Sale Period"
                  multiple="range"
                  prepend-icon=""
                  prepend-inner-icon="mdi-calendar-range"
                  :rounded="rounded"
                  show-adjacent-months
                  :variant="variant"
                />
                <div class="d-flex justify-space-between text-caption text-medium-emphasis px-1 mt-1">
                  <span>Start: {{ ticket.saleStartDate ? new Date(ticket.saleStartDate).toLocaleString() : 'Not set' }}</span>
                  <span>End: {{ ticket.saleEndDate ? new Date(ticket.saleEndDate).toLocaleString() : 'Not set' }}</span>
                </div>
              </div>
            </div>

            <v-row v-if="event?.config?.enableOnSiteQuota" class="mb-4">
              <v-col cols="12" sm="6">
                <v-number-input
                  v-model.number="ticket.onSiteQuota"
                  :density="density"
                  hide-details="auto"
                  label="On-site Quota (Ticket Count)"
                  inset
                  min="0"
                  control-variant="default"
                  prepend-inner-icon="mdi-store-clock"
                  :rounded="rounded"
                  :rules="[(v) => v >= 0 || 'Quota must be non-negative', (v) => v <= ticket.currentStock || 'Quota cannot exceed current stock']"
                  :variant="variant"
                />
              </v-col>
              <v-col cols="12" sm="6">
                <v-number-input
                  v-model.number="ticket.lowStockThreshold"
                  :density="density"
                  hide-details="auto"
                  label="Low Stock Alert (Ticket Count)"
                  inset
                  min="0"
                  control-variant="default"
                  prepend-inner-icon="mdi-alert-circle-outline"
                  :rounded="rounded"
                  :rules="[(v) => v >= 0 || 'Threshold must be non-negative']"
                  :variant="variant"
                />
              </v-col>
            </v-row>

            <v-alert
              v-if="ticket.price > 0"
              class="mb-4"
              :density="density"
              :rounded="rounded"
              type="info"
              variant="tonal"
            >
              <template #prepend>
                <v-icon>mdi-credit-card</v-icon>
              </template>
              This ticket will be processed through Stripe for payments.
            </v-alert>
            <v-alert
              v-else
              class="mb-4"
              :density="density"
              :rounded="rounded"
              type="success"
              variant="tonal"
            >
              <template #prepend>
                <v-icon>mdi-check-circle</v-icon>
              </template>
              This is a free ticket - no payment required.
            </v-alert>

            <div class="d-flex align-center mt-6">
              <v-spacer />
              <v-btn
                class="mr-3"
                color="grey"
                :disabled="isLoading"
                :rounded="rounded"
                :size="size"
                variant="outlined"
                @click="closeDialog"
              >
                Cancel
              </v-btn>
              <v-btn
                color="primary"
                :disabled="!isFormValid"
                :loading="isLoading"
                :rounded="rounded"
                :size="size"
                variant="elevated"
                @click="handleSubmitTicket"
              >
                {{ isEditing ? 'Update Ticket' : 'Create Ticket' }}
              </v-btn>
            </div>
          </v-form>
        </v-card-text>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.tickets-container {
  min-height: calc(100vh - 64px);
  padding: 24px;
}

.ticket-card {
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.ticket-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
}

.ticket-details {
  background: rgb(var(--v-theme-surfaceVariant));
  border-radius: 12px;
  padding: 16px;
}

.empty-state-card {
  border-radius: 16px;
  max-width: 500px;
  margin: 0 auto;
}

.dialog-card {
  border-radius: 16px;
  overflow: hidden;
}

.flex-1 {
  flex: 1;
}

.flex-2 {
  flex: 2;
}

.gap-2 {
  gap: 8px;
}

.price-stock-container {
  min-width: 0;
  flex: 1;
}

.text-truncate-price {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Responsive Design */
@media (max-width: 768px) {
  .tickets-container {
    padding: 16px;
  }

  .d-flex.gap-3 {
    flex-direction: column;
    gap: 12px !important;
  }

  .d-flex.gap-4 {
    flex-direction: column;
    gap: 16px !important;
  }
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.min-width-0 {
  min-width: 0;
}
</style>
