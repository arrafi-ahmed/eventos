<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { checkinItems, clientBaseUrl, deepCopy, formatDate, formatDateTime, formatPrice, padStr, sendToWhatsapp } from '@/utils'

  definePage({
    name: 'event-attendees',
    meta: {
      layout: 'default',
      title: 'Event Attendees',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const currentUser = computed(() => store.state.auth.user)
  const route = useRoute()
  const router = useRouter()
  const { xs } = useDisplay()
  const { rounded, size, density, variant } = useUiProps()

  const event = computed(() => store.state.event.event)
  const tickets = computed(() => store.state.ticket.tickets || [])
  const attendees = computed(() => store.state.registration.attendees)

  const itemsPerPage = ref(10)
  const paginationPage = ref(1)
  const totalCount = ref(0)
  const loading = ref(false)
  const headers = ref([
    {
      title: 'ID',
      align: 'start',
      key: 'registrationId',
    },
    {
      title: 'Name',
      align: 'start',
      key: 'name',
    },
  ])

  if (!xs.value) {
    headers.value.push({
      title: 'Email',
      align: 'start',
      key: 'email',
    }, {
      title: 'Registration Time',
      align: 'start',
      key: 'registrationCreatedAt',
    })
  }
  headers.value.push({
    title: 'Check-in Status',
    align: 'start',
    key: 'checkinStatus',
  }, {
    title: '',
    align: 'start',
    key: 'action',
  })
  const searchKeyword = ref(null)
  const currentSort = ref('registration')

  async function loadItems ({ page = 1, itemsPerPage = 10 } = {}) {
    loading.value = true
    paginationPage.value = page
    try {
      if (event.value.id !== route.params.eventId) {
        await store.dispatch('event/setEvent', { eventId: route.params.eventId })
      }
      const result = await store.dispatch('registration/setAttendees', {
        page,
        itemsPerPage,
        fetchTotalCount: true,
        event: { id: event.value.id, config: event.value.config },
        searchKeyword: searchKeyword.value,
        sortBy: currentSort.value,
      })
      totalCount.value = result.totalItems
    } finally {
      loading.value = false
    }
  }

  function handlePageChange (page) {
    loadItems({ page, itemsPerPage: itemsPerPage.value })
  }

  // Sort options for the select dropdown
  const sortOptions = [
    { title: 'Registration Date', value: 'registration', icon: 'mdi-calendar-clock' },
    { title: 'Check-in Status', value: 'checkin', icon: 'mdi-qrcode-scan' },
  ]

  // Get ticket price for individual tickets
  function getTicketPrice (ticketId) {
    const ticket = tickets.value.find(t => t.id === ticketId)
    return ticket ? ticket.price : null
  }

  const editingAttendeeInit = {
    registrationId: null,
    eventId: null,
    additionalFields: {},
    registrationStatus: false,
    registrationCreatedAt: null,
    registrationUpdatedAt: null,
    attendeeId: null,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    ticketId: null,
    ticketTitle: '',
    qrUuid: '',
    isPrimary: false,
    attendeeCreatedAt: null,
    attendeeUpdatedAt: null,
    checkinId: null,
    checkinTime: null,
  }

  const isExtraExists = computed(() => false) // Extras not implemented in flattened structure yet

  // Computed property to map checkinId to checkinItems value
  const currentCheckinStatus = computed({
    get: () => (editingAttendee.checkinId ? checkinItems[1].value : checkinItems[0].value),
    set: value => {
      // Update the checkinId based on selection
      editingAttendee.checkinId = value === checkinItems[1].value ? 'pending_save' : null
    },
  })

  const editingAttendee = reactive({ ...editingAttendeeInit })
  const attendeeDetailsDialog = ref(false)
  const activeTab = ref('info')

  function openAttendeeDetailsDialog (attendeeId) {
    const attendee = attendees.value.find(item => item.attendeeId == attendeeId)
    if (!attendee) return

    Object.assign(editingAttendee, deepCopy(attendee)) // deep clone

    attendeeDetailsDialog.value = !attendeeDetailsDialog.value
  }

  async function updateCheckinStatus ({ attendeeId, registrationId }) {
    const attendee = attendees.value.find(item => item.attendeeId == attendeeId)

    // Check if status actually changed
    const wasCheckedIn = !!attendee.checkinId
    const willBeCheckedIn = !!editingAttendee.checkinId
    if (wasCheckedIn === willBeCheckedIn) return

    // If setting status to pending (no checkinId), delete the checkin record
    if (!editingAttendee.checkinId) {
      await store
        .dispatch('checkin/delete', {
          attendeeId,
          eventId: route.params.eventId,
        })
        .finally(() => {
          attendeeDetailsDialog.value = !attendeeDetailsDialog.value
          Object.assign(editingAttendee, editingAttendeeInit)
        // Refresh the attendee list to show updated status
        })
      return
    }

    // If setting status to checked in (has checkinId), create/update the checkin record
    const newCheckin = { attendeeId, registrationId }

    await store
      .dispatch('checkin/save', {
        ...newCheckin,
        eventId: route.params.eventId,
      })
      .finally(() => {
        attendeeDetailsDialog.value = !attendeeDetailsDialog.value
        Object.assign(editingAttendee, editingAttendeeInit)
      // Refresh the attendee list to show updated status
      })
  }

  function handleDownload () {
    store.dispatch('registration/downloadAttendees', {
      eventId: route.params.eventId,
    })
  }

  function sendTicket (attendeeId) {
    store.dispatch('registration/sendTicketByAttendeeId', {
      attendeeId,
      eventId: route.params.eventId,
    })
  }

  function removeRegistration (registrationId) {
    // Count how many attendees belong to this registration before deletion
    const attendeesToRemove = attendees.value.filter(item => item.registrationId === registrationId)
    const countToRemove = attendeesToRemove.length

    store
      .dispatch('registration/removeRegistration', {
        registrationId,
        eventId: route.params.eventId,
      })
      .then(() => {
        // Update total count without refetching (preserves itemsPerPage)
        totalCount.value = Math.max(0, totalCount.value - countToRemove)
      })
      .catch(error => {
        console.error('Error deleting registration:', error)
      })
  }

  function deleteAttendee (attendee) {
    // Count attendees in this registration before deletion (in case entire registration is deleted)
    const attendeesInRegistration = attendees.value.filter(
      item => item.registrationId === attendee.registrationId,
    )
    const countInRegistration = attendeesInRegistration.length

    store
      .dispatch('registration/deleteAttendee', {
        attendeeId: attendee.attendeeId,
        registrationId: attendee.registrationId,
        eventId: route.params.eventId,
      })
      .then(response => {
        // The store mutation will handle the UI update automatically
        // Update total count without refetching (preserves itemsPerPage)
        if (response?.data?.payload?.deletedRegistration) {
          // Entire registration was deleted - remove all attendees in that registration
          totalCount.value = Math.max(0, totalCount.value - countInRegistration)
        } else {
          // Just one attendee was deleted
          totalCount.value = Math.max(0, totalCount.value - 1)
        }
      })
      .catch(error => {
        console.error('Error deleting attendee:', error)
      })
  }

  function viewQr ({ registrationId, attendeeId, qrUuid }) {
    router.push({
      name: 'qr-viewer',
      params: { registrationId, attendeeId, qrUuid },
    })
  }

  function handleSortChange (sortValue) {
    currentSort.value = sortValue
    store.dispatch('registration/setAttendees', {
      event: { id: event.value.id, config: event.value.config },
      searchKeyword: searchKeyword.value,
      sortBy: sortValue,
    })
  }

  function handleSendToWhatsapp (attendee) {
    const phone = attendee.phone?.slice(1) || ''
    const message = `QR code download link: ${clientBaseUrl}/qr/${attendee.attendeeId}/${attendee.qrUuid}`
    sendToWhatsapp(phone, message)
  }

  // Helper functions to get attendee data from new structure
  function getAttendeeName (attendee) {
    return `${attendee.firstName || ''} ${attendee.lastName || ''}`.trim() || 'N/A'
  }

  function getTicketTitle (attendee) {
    if (attendee.ticketTitle) return attendee.ticketTitle
    const ticket = tickets.value.find(t => t.id === attendee.ticketId)
    return ticket ? ticket.title || ticket.name : '-'
  }

  function handleSearch () {
    loadItems({ page: 1 })
  }

  onMounted(async () => {
    loadItems()
    if (tickets.value.length === 0) {
      await store.dispatch('ticket/setTickets', route.params.eventId)
    }
  })
</script>

<template>
  <v-container>
    <!-- Header Section -->
    <PageTitle
      :compact="true"
      :subtitle="`${event?.name}${totalCount ? ' • ' + totalCount + ' Total' : ''}`"
      title="Attendee List"
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

    <!-- Search and Sort Section -->
    <div class="d-flex align-center justify-end my-2 my-md-4">
      <v-text-field
        v-model="searchKeyword"
        append-inner-icon="mdi-magnify"
        clearable
        :density="density"
        hide-details
        label="Search by name/email/phone"
        :rounded="rounded"
        single-line
        :variant="variant"
        @click:append-inner="handleSearch"
        @keydown.enter="handleSearch"
      />
      <!-- Sort Menu -->
      <v-menu>
        <template #activator="{ props }">
          <v-btn
            class="ml-2"
            icon="mdi-sort"
            :rounded="rounded"
            v-bind="props"
          />
        </template>
        <v-list :density="density">
          <v-list-item
            v-for="option in sortOptions"
            :key="option.value"
            :active="currentSort === option.value"
            @click="handleSortChange(option.value)"
          >
            <template #prepend>
              <v-icon
                :color="currentSort === option.value ? 'primary' : 'default'"
                size="small"
              >
                {{ option.icon }}
              </v-icon>
            </template>
            <v-list-item-title>{{ option.title }}</v-list-item-title>
          </v-list-item>
        </v-list>
      </v-menu>
    </div>

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

          <v-list v-if="attendees && attendees.length > 0" class="pa-0">
            <template v-for="(item, index) in attendees" :key="item.attendeeId">
              <v-list-item
                class="py-4 px-4 attendee-list-item"
                :ripple="true"
                @click="openAttendeeDetailsDialog(item.attendeeId)"
              >
                <template #prepend>
                  <v-avatar
                    class="mr-4 elevation-1"
                    :color="item.checkinId ? 'success' : 'primary'"
                    size="48"
                  >
                    <span class="text-white font-weight-bold">
                      {{ (item.firstName?.[0] || '') + (item.lastName?.[0] || '') }}
                    </span>
                  </v-avatar>
                </template>

                <v-list-item-title class="d-flex align-center flex-wrap gap-2 mb-1">
                  <span class="text-h6 font-weight-bold mr-2">{{ getAttendeeName(item) }}</span>
                  <v-chip
                    v-if="item.isPrimary"
                    class="font-weight-bold"
                    color="primary"
                    prepend-icon="mdi-star"
                    size="x-small"
                    variant="tonal"
                  >
                    Primary Buyer
                  </v-chip>
                  <v-chip
                    v-if="item.checkinId"
                    class="font-weight-bold"
                    color="success"
                    prepend-icon="mdi-check-circle"
                    size="x-small"
                    variant="flat"
                  >
                    Checked-in
                  </v-chip>
                </v-list-item-title>

                <v-list-item-subtitle class="d-flex flex-column">
                  <span class="text-body-2 text-medium-emphasis d-flex align-center mb-1">
                    <v-icon class="mr-1" size="small">mdi-email-outline</v-icon>
                    {{ item.email }}
                  </span>
                  <div class="d-flex align-center flex-wrap gap-x-4 gap-y-1">
                    <span class="text-caption text-grey d-flex align-center">
                      <v-icon class="mr-1" size="14">mdi-identifier</v-icon>
                      ID: {{ padStr(item.registrationId, 5) || '-' }}
                    </span>
                    <span class="text-caption text-grey d-flex align-center">
                      <v-icon class="mr-1" size="14">mdi-calendar-clock</v-icon>
                      {{ formatDateTime({input: item.registrationCreatedAt, timezone: store.state.auth.user?.timezone}) }}
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
                          prepend-icon="mdi-card-account-details-outline"
                          title="View Details"
                          @click="openAttendeeDetailsDialog(item.attendeeId)"
                        />
                        <v-list-item
                          prepend-icon="mdi-email-fast"
                          title="Email Ticket"
                          @click="sendTicket(item.attendeeId)"
                        />
                        <v-list-item
                          prepend-icon="mdi-whatsapp"
                          title="WhatsApp Ticket"
                          @click="handleSendToWhatsapp(item)"
                        />
                        <v-list-item
                          prepend-icon="mdi-qrcode"
                          title="QR Code Viewer"
                          @click="viewQr(item)"
                        />
                        <v-divider class="my-1" />
                        <confirmation-dialog @confirm="deleteAttendee(item)">
                          <template #activator="{ onClick }">
                            <v-list-item
                              class="text-error"
                              prepend-icon="mdi-account-remove"
                              title="Delete Attendee"
                              @click.stop="onClick"
                            />
                          </template>
                        </confirmation-dialog>
                        <confirmation-dialog @confirm="removeRegistration(item.registrationId)">
                          <template #activator="{ onClick }">
                            <v-list-item
                              class="text-error"
                              prepend-icon="mdi-delete-forever"
                              title="Delete Entire Registration"
                              @click.stop="onClick"
                            />
                          </template>
                        </confirmation-dialog>
                      </v-list>
                    </v-menu>
                  </div>
                </template>
              </v-list-item>
              <v-divider v-if="index < attendees.length - 1" :key="'divider-'+index" inset />
            </template>
          </v-list>

          <div v-else-if="!loading" class="py-10">
            <AppNoData
              icon="mdi-account-off-outline"
              message="No attendees found for this event yet. Once people register, they will appear here."
              title="No Attendees Found"
            />
          </div>

          <!-- Pagination Footer -->
          <v-divider />
          <div class="pa-4 d-flex justify-center">
            <v-pagination
              v-model="paginationPage"
              active-color="primary"
              density="comfortable"
              :length="Math.ceil(totalCount / itemsPerPage)"
              :total-visible="xs ? 3 : 7"
              variant="text"
              @update:model-value="handlePageChange"
            />
          </div>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- Attendee Details Dialog -->
  <v-dialog
    v-model="attendeeDetailsDialog"
    scrollable
    width="550"
  >
    <v-card class="border" :rounded="rounded">
      <v-card-title class="pa-4 d-flex align-center bg-surface">
        <v-icon class="mr-2" color="primary" icon="mdi-account-details" />
        <span class="text-h5 font-weight-bold">Attendee Profile</span>
        <v-spacer />
        <v-btn
          density="compact"
          icon="mdi-close"
          variant="text"
          @click="attendeeDetailsDialog = false"
        />
      </v-card-title>

      <v-card-text class="pa-0">
        <div class="pa-4">
          <!-- Attendee Header Info -->
          <div class="d-flex align-center mb-6">
            <v-avatar class="mr-4 elevation-2" color="primary" size="80">
              <span class="text-h4 text-white">
                {{ (editingAttendee.firstName?.[0] || '') + (editingAttendee.lastName?.[0] || '') }}
              </span>
            </v-avatar>
            <div>
              <div class="text-h5 font-weight-bold">{{ getAttendeeName(editingAttendee) }}</div>
              <div class="text-body-1 text-medium-emphasis">{{ editingAttendee.email || '-' }}</div>
              <div v-if="editingAttendee.phone" class="text-body-2 text-grey">
                <v-icon class="mr-1" size="small">mdi-phone</v-icon>
                {{ editingAttendee.phone }}
              </div>
              <div class="text-caption text-grey mt-1">
                ID: {{ padStr(editingAttendee.registrationId, 5) || '-' }} • Registered: {{ formatDateTime({input: editingAttendee.registrationCreatedAt, timezone: store.state.auth.user?.timezone}) }}
              </div>
            </div>
          </div>

          <v-divider class="mb-6" />

          <!-- Tickets Section -->
          <div class="section-label text-overline font-weight-bold text-primary mb-3">Ticket Information</div>
          <!-- POS/Counter Sales: Multiple tickets via items array -->
          <template v-if="editingAttendee.items?.length > 0">
            <v-card
              v-for="(ticket, tidx) in editingAttendee.items"
              :key="tidx"
              class="pa-4 rounded-lg mb-3"
              color="primary"
              variant="tonal"
            >
              <div class="d-flex justify-space-between align-center">
                <div class="d-flex align-center">
                  <v-icon class="mr-3" icon="mdi-ticket-confirmation" />
                  <div>
                    <div class="text-subtitle-1 font-weight-bold">{{ ticket.title || '-' }}</div>
                    <div class="text-caption">Qty: {{ ticket.quantity }} • {{ formatPrice(ticket.price) }} each</div>
                  </div>
                </div>
                <div class="text-h6 font-weight-bold text-primary">
                  {{ formatPrice(ticket.price * ticket.quantity) }}
                </div>
              </div>
            </v-card>
          </template>
          <!-- Online Registration: Single ticket via ticketId/ticketTitle -->
          <template v-else-if="editingAttendee.ticketId">
            <v-card class="pa-4 rounded-lg mb-3" color="primary" variant="tonal">
              <div class="d-flex align-center">
                <v-icon class="mr-3" icon="mdi-ticket-confirmation" />
                <div>
                  <div class="text-subtitle-1 font-weight-bold">{{ editingAttendee.ticketTitle || 'Unknown Ticket' }}</div>
                  <div class="text-caption">Ticket ID: {{ editingAttendee.ticketId }}</div>
                </div>
              </div>
            </v-card>
          </template>
          <!-- No ticket data -->
          <div v-else class="text-body-2 text-grey pa-4 text-center border rounded-lg mb-6">
            No ticket data available
          </div>

          <v-divider class="my-6" />

          <!-- Check-in Status Section -->
          <div class="section-label text-overline font-weight-bold text-primary mb-3">Check-in Status</div>
          <v-card class="border rounded-lg pa-4 elevation-1">
            <div class="d-flex align-center mb-4">
              <v-icon class="mr-3" :color="editingAttendee.checkinId ? 'success' : 'warning'" size="32">
                {{ editingAttendee.checkinId ? 'mdi-check-circle' : 'mdi-clock-outline' }}
              </v-icon>
              <div class="text-h6 font-weight-bold">
                {{ editingAttendee.checkinId ? 'Checked-in' : 'Pending' }}
              </div>
            </div>

            <div class="mb-4">
              <div class="text-caption text-grey mb-1 ml-11">Update Status</div>
              <v-select
                v-model="currentCheckinStatus"
                density="compact"
                class="ml-11"
                hide-details
                item-title="title"
                item-value="value"
                :items="checkinItems"
                :rounded="rounded"
                style="max-width: 200px;"
                :variant="variant"
              />
            </div>

            <div v-if="editingAttendee.checkinTime" class="ml-11">
              <div class="text-caption text-grey mb-1">Check-in Timestamp</div>
              <v-chip class="text-subtitle-1 font-weight-bold py-1 px-4 h-auto" color="success" variant="tonal">
                {{ formatDateTime({
                  input: editingAttendee.checkinTime,
                  timezone: store.state.auth.user?.timezone
                }) }}
              </v-chip>
            </div>
          </v-card>
        </div>
      </v-card-text>

      <v-divider />

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn
          class="px-4"
          color="grey-darken-1"
          :rounded="rounded"
          variant="text"
          @click="attendeeDetailsDialog = false"
        >
          Cancel
        </v-btn>
        <v-btn
          class="px-6 ml-2"
          color="primary"
          :rounded="rounded"
          variant="flat"
          @click="updateCheckinStatus({
            attendeeId: editingAttendee.attendeeId,
            registrationId: editingAttendee.registrationId
          })"
        >
          Update Record
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.attendee-list-item {
  transition: all 0.2s ease;
  border-left: 4px solid transparent;
}

.attendee-list-item:hover {
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
</style>
