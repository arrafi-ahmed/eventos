<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { QrcodeStream } from 'vue-qrcode-reader'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatDateTime, formatPrice } from '@/utils'

  definePage({
    name: 'staff-checkin',
    meta: {
      layout: 'default',
      title: 'Staff Check-in',
      requiresAuth: true,
      requiresStaff: true,
    },
  })

  const { rounded, density, variant } = useUiProps()
  const store = useStore()
  const router = useRouter()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])

  const events = ref([])
  const selectedEventId = ref(null)
  const attendees = ref([])
  const tickets = ref([])
  const statistics = ref({
    totalAttendees: 0,
    totalCheckedInAttendees: 0,
  })

  const loading = ref(false)
  const searchKeyword = ref('')
  const activeTab = ref('scanner') // 'scanner', 'search', 'history'
  const torch = ref(false)
  const checkinDialog = ref(false)
  const selectedAttendee = ref(null)
  const processingCheckin = ref(false)
  const latestResult = ref(null) // { success: boolean, message: string, attendee: object }
  const recentHistory = ref([])
  const hasSearched = ref(false)
  const detailsDialog = ref(false)
  const isPaused = ref(false)
  const isScanning = ref(false)
  const lastScannedAttendee = ref(null)

  const remainingAttendees = computed(() => {
    return statistics.value.totalAttendees - statistics.value.totalCheckedInAttendees
  })

  const checkinProgress = computed(() => {
    if (statistics.value.totalAttendees === 0) return 0
    return (statistics.value.totalCheckedInAttendees / statistics.value.totalAttendees) * 100
  })

  async function handleScan (detectedCodes) {
    if (detectedCodes.length === 0 || loading.value || isPaused.value) return

    const qrCodeData = detectedCodes[0].rawValue
    latestResult.value = null // Clear previous result
    isPaused.value = true // Pause scanner while processing
    isScanning.value = true

    try {
      loading.value = true
      const result = await store.dispatch('checkin/scanByRegistrationId', {
        qrCodeData,
        eventId: selectedEventId.value,
        suppressToast: true,
      })

      latestResult.value = {
        success: true,
        message: `Successfully checked in`,
        attendee: result,
      }

      // Play success sound
      playScanSound(true)

      // Auto-clear success after 3 seconds
      setTimeout(() => {
        if (latestResult.value && latestResult.value.success) {
          latestResult.value = null
        }
      }, 3000)

      // Add to local history
      addToHistory(result)
      lastScannedAttendee.value = result

      fetchStats()
    // No auto-trigger search on scan, keep the keyword
    } catch (error) {
      // Play error sound
      playScanSound(false)

      const errorMsg = error.response?.data?.msg || 'Invalid QR Code'
      const isDuplicate = errorMsg.toLowerCase().includes('already')
        || errorMsg.toLowerCase().includes('duplicate')
        || errorMsg.toLowerCase().includes('checked')

      latestResult.value = {
        success: false,
        message: errorMsg,
        isDuplicate,
      }

      // Auto-clear error after 3 seconds to allow re-scan (matching organizer behavior)
      setTimeout(() => {
        if (latestResult.value && !latestResult.value.success) {
          latestResult.value = null
        }
      }, 3000)
    } finally {
      loading.value = false
      isPaused.value = false // Resume scanner
      isScanning.value = false
    }
  }

  function playScanSound (isSuccess) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)()
      const oscillator = audioCtx.createOscillator()
      const gainNode = audioCtx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioCtx.destination)

      if (isSuccess) {
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime) // A5
        gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime)
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.1)
      } else {
        oscillator.type = 'sawtooth'
        oscillator.frequency.setValueAtTime(220, audioCtx.currentTime) // A3 (low buzz)
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime)
        oscillator.start()
        oscillator.stop(audioCtx.currentTime + 0.4)
      }
    } catch (error) {
      // Silently fail if audio context is blocked
      console.warn('Scan sound blocked or failed:', error)
    }
  }

  function onError (err) {
    console.error('Scanner error:', err)
    latestResult.value = {
      success: false,
      message: 'Scanner error: ' + (err.message || 'Unknown error'),
    }
  }

  function onInit (promise) {
    promise.catch(error => {
      console.error('Scanner init error:', error)
      latestResult.value = {
        success: false,
        message: 'Camera initialization failed',
      }
    })
  }

  function addToHistory (attendee) {
    const historyItem = {
      ...attendee,
      checkinTime: new Date(),
    }
    recentHistory.value = [historyItem, ...recentHistory.value].slice(0, 10)
  }

  async function handleManualCheckin (attendee) {
    selectedAttendee.value = attendee
    checkinDialog.value = true
  }

  async function confirmCheckin () {
    if (!selectedAttendee.value) return

    processingCheckin.value = true
    try {
      const result = await store.dispatch('checkin/save', {
        attendeeId: selectedAttendee.value.attendeeId || selectedAttendee.value.id,
        registrationId: selectedAttendee.value.registrationId,
        eventId: selectedEventId.value,
      })

      // Add to history
      addToHistory({
        ...selectedAttendee.value,
        ...result,
      })

      checkinDialog.value = false
      fetchStats()
      fetchAttendees() // Refresh search results after checkin
      playScanSound(true)
    } catch (error) {
      playScanSound(false)
      store.commit('addSnackbar', {
        text: error.response?.data?.message || 'Check-in failed',
        color: 'error',
      })
    } finally {
      processingCheckin.value = false
    }
  }

  async function fetchStats () {
    if (!selectedEventId.value) return
    const stats = await store.dispatch('checkin/setStatistics', { eventId: selectedEventId.value })
    statistics.value = stats

    // also fetch tickets for title lookup
    try {
      const result = await store.dispatch('ticket/setTickets', selectedEventId.value)
      tickets.value = result.data.payload
    } catch (error) {
      console.error('Failed to fetch tickets', error)
    }
  }

  async function fetchAttendees () {
    if (!selectedEventId.value || searchKeyword.value.length < 2) {
      attendees.value = []
      return
    }

    loading.value = true
    try {
      const eventObj = events.value.find(e => e.id === selectedEventId.value)
      const result = await store.dispatch('registration/setAttendees', {
        event: { id: eventObj.id, config: eventObj.config },
        searchKeyword: searchKeyword.value,
        itemsPerPage: 50,
      })
      attendees.value = result.items
      hasSearched.value = true
    } catch (error) {
      console.error('Search error:', error)
      store.commit('addSnackbar', { text: 'Search failed', color: 'error' })
    } finally {
      loading.value = false
    }
  }

  function openDetails (attendee) {
    selectedAttendee.value = attendee
    detailsDialog.value = true
  }

  watch(selectedEventId, () => {
    if (selectedEventId.value) {
      fetchStats()
      if (searchKeyword.value.length >= 2) fetchAttendees()
    }
  })

  watch(searchKeyword, () => {
    hasSearched.value = false
  })

  async function fetchHistory () {
    if (!selectedEventId.value) return

    loading.value = true
    try {
      const eventObj = events.value.find(e => e.id === selectedEventId.value)

      if (!eventObj) return

      const result = await store.dispatch('registration/setAttendees', {
        event: { id: eventObj.id, config: eventObj.config },
        itemsPerPage: 20,
        sortBy: 'checkin',
      })

      // Filter to show only checked-in attendees
      recentHistory.value = result.items.filter(item => item.checkinId)
    } catch (error) {
      console.error('History fetch error:', error)
    } finally {
      loading.value = false
    }
  }

  function getTicketTitle (ticketId) {
    if (!ticketId || tickets.value.length === 0) return null
    const t = tickets.value.find(x => x.id === ticketId)
    return t ? t.title : null
  }

  function formatDate (dateString) {
    return formatDateTime({
      input: dateString,
      timezone: currentUser.value?.timezone,
    })
  }

  watch(activeTab, val => {
    if (val === 'scanner') {
    // latestResult.value = null // Optional: clear when switching tabs?
    } else if (val === 'history') {
      fetchHistory()
    }
  })

  function loadEvents () {
    loading.value = true
    store
      .dispatch('event/setAssignedEvents', { role: 60 })
      .then(data => {
        events.value = data
        if (events.value.length === 1) {
          selectedEventId.value = events.value[0].id
        }
      })
      .finally(() => {
        loading.value = false
      })
  }

  onMounted(() => {
    loadEvents()
  })
</script>

<template>
  <v-container>
    <PageTitle
      :show-back-button="false"
      subtitle="Scan QR codes or search attendees"
      title="Scanner"
    />

    <v-row>
      <!-- 1. Event Selection (Always Top) -->
      <v-col class="order-1" cols="12">
        <v-card elevation="2" :rounded="rounded">
          <v-card-text>
            <v-select
              v-model="selectedEventId"
              :density="density"
              item-title="name"
              item-value="id"
              hide-details
              :items="events"
              label="Select Event"
              :loading="loading"
              prepend-inner-icon="mdi-calendar"
              :rounded="rounded"
              :variant="variant"
            />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- 3. Sidebar: Stats & Scanned Details (Mobile: 3, Desktop: 1) -->
      <v-col class="order-3 order-md-1 d-flex flex-column" cols="12" md="4">
        <!-- Scanned Attendee Details (Top on mobile within sidebar, but sidebar is below scanner) -->
        <v-fade-transition>
          <v-card v-if="lastScannedAttendee" class="mb-4 order-1 border-success border-opacity-50 border-sm" elevation="3" :rounded="rounded">
            <v-card-text class="pa-3">
              <div class="text-subtitle-2 font-weight-bold mb-3 d-flex align-center text-success">
                <v-icon class="mr-2" size="small">mdi-account-check</v-icon>
                Recently Scanned
              </div>

              <div class="d-flex align-center mb-3">
                <v-avatar class="mr-3" color="success" size="40">
                  <span class="text-white text-subtitle-2">{{ lastScannedAttendee.firstName?.[0] }}{{ lastScannedAttendee.lastName?.[0] }}</span>
                </v-avatar>
                <div class="overflow-hidden">
                  <div class="text-body-2 font-weight-bold text-truncate">{{ lastScannedAttendee.firstName }} {{ lastScannedAttendee.lastName }}</div>
                  <div class="text-caption text-grey text-truncate">{{ lastScannedAttendee.email }}</div>
                </div>
              </div>

              <v-divider class="mb-2" />

              <div class="tickets-info">
                <div v-for="(item, idx) in lastScannedAttendee.items" :key="'scanned-item-'+idx" class="d-flex justify-space-between align-center mb-1">
                  <div class="text-caption font-weight-medium text-truncate mr-2">
                    {{ item.title || item.name || item.ticketTitle }}
                  </div>
                  <v-chip class="font-weight-bold" color="primary" size="x-small" variant="tonal">
                    x{{ item.quantity || 1 }}
                  </v-chip>
                </div>
              </div>

              <div class="text-right mt-2">
                <span v-if="lastScannedAttendee.checkinTime" class="text-caption text-grey">at {{ formatDateTime({ input: lastScannedAttendee.checkinTime, timezone: currentUser?.timezone, format: 'HH:mm:ss' }) }}</span>
              </div>
            </v-card-text>
          </v-card>
        </v-fade-transition>

        <!-- Attendance Stats -->
        <v-card v-if="selectedEventId" class="mb-4 order-2" elevation="2" :rounded="rounded">
          <v-card-text>
            <div class="text-subtitle-2 font-weight-bold mb-4 d-flex align-center">
              <v-icon class="mr-2" color="primary" size="small">mdi-chart-box-outline</v-icon>
              Attendance Stats
            </div>
            <div class="stats-container">
              <div class="d-flex justify-space-between mb-2">
                <span class="text-body-2">Total Expected</span>
                <span class="font-weight-bold">{{ statistics.totalAttendees }}</span>
              </div>
              <div class="d-flex justify-space-between mb-2 text-success">
                <span class="text-body-2">Checked-in</span>
                <span class="font-weight-bold">{{ statistics.totalCheckedInAttendees }}</span>
              </div>
              <div class="d-flex justify-space-between mb-4 text-warning">
                <span class="text-body-2">Remaining</span>
                <span class="font-weight-bold">{{ remainingAttendees }}</span>
              </div>

              <v-progress-linear
                color="success"
                height="10"
                :model-value="checkinProgress"
                rounded
              />
              <div class="text-center text-caption mt-1">
                {{ Math.round(checkinProgress) }}% Complete
              </div>
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Main Interaction Area (Tabs) (Mobile: 2, Desktop: 2) -->
      <v-col class="order-2 order-md-2" cols="12" md="8">
        <v-card class="interaction-card overflow-hidden" elevation="1" :rounded="rounded">
          <v-tabs v-model="activeTab" border-bottom fixed-tabs>
            <v-tab prepend-icon="mdi-qrcode-scan" value="scanner">Scanner</v-tab>
            <v-tab prepend-icon="mdi-account-search" value="search">Search</v-tab>
            <v-tab prepend-icon="mdi-history" value="history">History</v-tab>
          </v-tabs>

          <v-card-text class="pa-0">
            <v-window v-model="activeTab" :touch="false">
              <!-- Scanner Tab -->
              <v-window-item value="scanner">
                <div class="scanner-tab-content bg-grey-darken-4">
                  <div v-if="!selectedEventId" class="d-flex align-center justify-center fill-height flex-column text-grey pa-12">
                    <v-icon class="mb-4" size="64">mdi-calendar-alert</v-icon>
                    <div class="text-h6">Select an event to start scanning</div>
                  </div>
                  <div v-else class="scanner-wrapper pa-4 d-flex flex-column align-center">
                    <div class="scanner-viewport">
                      <qrcode-stream
                        v-if="activeTab === 'scanner'"
                        :paused="isPaused"
                        :torch="torch"
                        @detect="handleScan"
                        @error="onError"
                        @init="onInit"
                      />
                      <div class="scanner-line-animation" />
                      <div class="scanner-corner-guides" />

                      <!-- Absolute Result Overlay -->
                      <v-fade-transition>
                        <div v-if="latestResult" class="scanner-result-overlay d-flex align-center justify-center">
                          <div v-if="latestResult.success" class="result-box success-box text-center pa-6 rounded-xl elevation-12">
                            <v-icon class="mb-4 animate-bounce" color="success" size="80">mdi-check-circle</v-icon>
                            <div class="text-h5 font-weight-black text-success line-height-1 mb-1">CHECKED IN</div>
                            <template v-if="latestResult.attendee">
                              <div class="text-h6 font-weight-bold text-high-emphasis">{{ latestResult.attendee.firstName }} {{ latestResult.attendee.lastName }}</div>
                              <div class="text-caption font-weight-medium text-medium-emphasis">{{ latestResult.attendee.ticketTitle }}</div>
                            </template>
                          </div>

                          <!-- Duplicate / Already Checked-in State -->
                          <div v-else-if="latestResult.isDuplicate" class="result-box error-box text-center pa-6 rounded-xl elevation-12">
                            <v-icon class="mb-4 animate-shake" color="error" size="80">mdi-alert-circle</v-icon>
                            <div class="text-h5 font-weight-black text-error line-height-1 mb-1">ALREADY CHECKED-IN</div>
                            <div class="text-body-2 font-weight-bold text-medium-emphasis">{{ latestResult.message }}</div>
                          </div>

                          <!-- Invalid State -->
                          <div v-else class="result-box error-box text-center pa-6 rounded-xl elevation-12">
                            <v-icon class="mb-4 animate-shake" color="error" size="80">mdi-close-circle</v-icon>
                            <div class="text-h5 font-weight-black text-error line-height-1 mb-1">INVALID CODE</div>
                            <div class="text-body-2 font-weight-bold text-medium-emphasis">{{ latestResult.message }}</div>
                          </div>
                        </div>
                      </v-fade-transition>
                    </div>
                    <div class="d-flex justify-center mt-4">
                      <v-btn
                        class="mx-2"
                        :color="torch ? 'warning' : 'white'"
                        :icon="torch ? 'mdi-flashlight' : 'mdi-flashlight-off'"
                        variant="tonal"
                        @click="torch = !torch"
                      />
                    </div>
                  </div>
                </div>
              </v-window-item>

              <!-- Search Tab -->
              <v-window-item value="search">
                <div class="pa-4">
                  <v-text-field
                    v-model="searchKeyword"
                    clearable
                    :density="density"
                    :disabled="!selectedEventId"
                    append-inner-icon="mdi-magnify"
                    hide-details
                    label="Search Attendee"
                    :loading="loading"
                    class="mb-4"
                    placeholder="Name or email (Press Enter to search)"
                    prepend-inner-icon="mdi-account-search"
                    :rounded="rounded"
                    :variant="variant"
                    @click:append-inner="fetchAttendees"
                    @keyup.enter="fetchAttendees"
                  />

                  <v-list class="attendees-list" min-height="300">
                    <v-list-item
                      v-for="attendee in attendees"
                      :key="attendee.id"
                      border
                      class="mb-2 rounded-lg py-2"
                      @click="openDetails(attendee)"
                    >
                      <template #prepend>
                        <v-avatar class="mr-2" color="primary">
                          {{ attendee.firstName[0] }}{{ attendee.lastName[0] }}
                        </v-avatar>
                      </template>
                      <v-list-item-title class="font-weight-bold">
                        {{ attendee.firstName }} {{ attendee.lastName }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="d-flex flex-column">
                        <span>{{ attendee.email }}</span>
                        <span v-if="attendee.phone" class="text-caption">{{ attendee.phone }}</span>
                      </v-list-item-subtitle>
                      <!-- Removed visible ticket info as requested -->

                      <template #append>
                        <v-btn
                          v-if="!attendee.checkinId"
                          color="success"
                          prepend-icon="mdi-check-circle-outline"
                          :rounded="rounded"
                          variant="tonal"
                          @click.stop="handleManualCheckin(attendee)"
                        >
                          Check-in
                        </v-btn>
                        <v-chip v-else color="success" prepend-icon="mdi-check" variant="flat">
                          Checked-in
                        </v-chip>
                      </template>
                    </v-list-item>

                    <v-fade-transition hide-on-leave>
                      <div v-if="attendees.length === 0 && hasSearched && !loading" class="py-12 text-center">
                        <v-icon color="grey font-weight-light" size="48">mdi-account-search-outline</v-icon>
                        <div class="text-grey mt-2 font-weight-medium">No results for "{{ searchKeyword }}"</div>
                      </div>
                      <div v-else-if="!loading && attendees.length === 0" class="py-12 text-center">
                        <v-icon color="grey font-weight-light" size="48">mdi-magnify</v-icon>
                        <div class="text-grey mt-2 font-weight-medium">Enter name or email and press search</div>
                      </div>
                    </v-fade-transition>
                  </v-list>
                </div>
              </v-window-item>

              <!-- History Tab -->
              <v-window-item value="history">
                <div class="pa-4">
                  <v-list v-if="recentHistory.length > 0">
                    <v-list-item
                      v-for="(item, idx) in recentHistory"
                      :key="'hist-'+idx"
                      border
                      class="mb-2 rounded-lg"
                      prepend-icon="mdi-account-check"
                    >
                      <v-list-item-title class="font-weight-bold">
                        {{ item.firstName }} {{ item.lastName }}
                      </v-list-item-title>
                      <v-list-item-subtitle class="text-caption">
                        Checked in at {{ formatDate(item.checkinTime || item.createdAt) }} • {{ item.email }}
                      </v-list-item-subtitle>
                    </v-list-item>
                  </v-list>
                  <div v-else class="py-12 text-center text-grey">
                    <v-icon class="mb-4" size="64">mdi-history</v-icon>
                    <div class="text-h6">No recent check-ins</div>
                    <div class="text-caption">Successful scans will appear here</div>
                  </div>
                </div>
              </v-window-item>
            </v-window>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Attendee Details Dialog -->
    <v-dialog v-model="detailsDialog" max-width="500">
      <v-card v-if="selectedAttendee" :rounded="rounded">
        <v-card-title class="font-weight-bold d-flex align-center">
          Attendee Details
          <v-spacer />
          <v-btn icon="mdi-close" size="small" variant="text" @click="detailsDialog = false" />
        </v-card-title>
        <v-card-text class="py-4">
          <div class="d-flex align-center mb-6">
            <v-avatar class="mr-4" color="primary" size="64">
              <span class="text-h5 text-white">{{ selectedAttendee.firstName[0] }}{{ selectedAttendee.lastName[0] }}</span>
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold">{{ selectedAttendee.firstName }} {{ selectedAttendee.lastName }}</div>
              <div class="text-body-2 text-grey">Status: <span :class="selectedAttendee.checkinId ? 'text-success font-weight-bold' : 'text-warning font-weight-bold'">{{ selectedAttendee.checkinId ? 'Checked In' : 'Pending' }}</span></div>
            </div>
          </div>

          <v-row class="mb-4" dense>
            <v-col v-if="selectedAttendee.email" cols="12" sm="6">
              <div class="text-caption text-grey">Email</div>
              <div class="text-body-2 font-weight-medium">{{ selectedAttendee.email }}</div>
            </v-col>
            <v-col v-if="selectedAttendee.phone" cols="12" sm="6">
              <div class="text-caption text-grey">Phone</div>
              <div class="text-body-2 font-weight-medium">{{ selectedAttendee.phone }}</div>
            </v-col>
          </v-row>

          <v-divider class="mb-3" />

          <div class="text-overline font-weight-bold mb-1">Ticket Information</div>
          <v-card class="pa-3" color="primary" variant="tonal">
            <!-- If we have an items array (from orders), iterate over it -->
            <template v-if="selectedAttendee.items && selectedAttendee.items.length > 0">
              <div v-for="(item, index) in selectedAttendee.items" :key="index" class="d-flex align-center mb-2">
                <v-icon class="mr-3" color="primary">mdi-ticket-account</v-icon>
                <div>
                  <div class="text-subtitle-2 font-weight-bold">
                    {{ item.title || item.name || item.ticketTitle || item.ticket_title || getTicketTitle(item.ticketId) || 'Ticket' }}
                    <span v-if="item.quantity >= 1" class="text-caption ml-1">x{{ item.quantity }}</span>
                  </div>
                  <div class="text-caption">Price: {{ item.price > 0 ? formatPrice(item.price) : 'Free' }}</div>
                </div>
              </div>
            </template>
            <!-- Fallback for simple single ticket logic -->
            <div v-else class="d-flex align-center">
              <v-icon class="mr-3" color="primary">mdi-ticket-account</v-icon>
              <div>
                <div class="text-subtitle-2 font-weight-bold">{{ selectedAttendee.ticketTitle || selectedAttendee.ticket_title || 'Ticket' }}</div>
                <div class="text-caption">ID: {{ selectedAttendee.ticketId }}</div>
              </div>
            </div>
          </v-card>

        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            v-if="!selectedAttendee.checkinId"
            color="success"
            :loading="processingCheckin"
            min-width="150"
            :rounded="rounded"
            variant="flat"
            @click="handleManualCheckin(selectedAttendee)"
          >
            Check-in Attendee
          </v-btn>
          <v-btn
            v-else
            disabled
            min-width="150"
            :rounded="rounded"
            variant="tonal"
          >
            Already Checked-in
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Manual Check-in Confirmation Dialog -->
    <v-dialog v-model="checkinDialog" max-width="500">
      <v-card v-if="selectedAttendee" :rounded="rounded">
        <v-card-title class="font-weight-bold">Confirm Check-in</v-card-title>
        <v-card-text class="py-4">
          <div class="d-flex align-center mb-6">
            <v-avatar class="mr-4" color="primary" size="64">
              <span class="text-h5 text-white">{{ selectedAttendee.firstName[0] }}{{ selectedAttendee.lastName[0] }}</span>
            </v-avatar>
            <div>
              <div class="text-h6 font-weight-bold">{{ selectedAttendee.firstName }} {{ selectedAttendee.lastName }}</div>
              <div class="text-body-2 text-grey">{{ selectedAttendee.ticketTitle }}</div>
            </div>
          </div>

          <v-row dense>
            <v-col v-if="selectedAttendee.email" cols="12" sm="6">
              <div class="text-caption text-grey">Email</div>
              <div class="text-body-2 font-weight-medium">{{ selectedAttendee.email }}</div>
            </v-col>
            <v-col v-if="selectedAttendee.phone" cols="12" sm="6">
              <div class="text-caption text-grey">Phone</div>
              <div class="text-body-2 font-weight-medium">{{ selectedAttendee.phone }}</div>
            </v-col>
          </v-row>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-btn color="grey" :rounded="rounded" variant="text" @click="checkinDialog = false">Cancel</v-btn>
          <v-spacer />
          <v-btn
            color="success"
            :loading="processingCheckin"
            min-width="150"
            :rounded="rounded"
            variant="flat"
            @click="confirmCheckin"
          >
            Confirm Check-in
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.scanner-tab-content {
  min-height: 400px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scanner-viewport {
  position: relative;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 1;
  overflow: hidden;
  border-radius: 24px;
  box-shadow: 0 0 20px rgba(0,0,0,0.4);
  background: #000;
}

.scanner-line-animation {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: linear-gradient(to bottom, rgba(24, 103, 192, 0), #1867c0, rgba(24, 103, 192, 0));
  box-shadow: 0 0 10px #1867c0;
  z-index: 10;
  animation: scan-line 2.5s ease-in-out infinite;
}

.scanner-corner-guides {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 5;
  pointer-events: none;
  background:
    linear-gradient(to right, #fff 2px, transparent 2px) 0 0,
    linear-gradient(to bottom, #fff 2px, transparent 2px) 0 0,
    linear-gradient(to left, #fff 2px, transparent 2px) 100% 0,
    linear-gradient(to bottom, #fff 2px, transparent 2px) 100% 0,
    linear-gradient(to right, #fff 2px, transparent 2px) 0 100%,
    linear-gradient(to top, #fff 2px, transparent 2px) 0 100%,
    linear-gradient(to left, #fff 2px, transparent 2px) 100% 100%,
    linear-gradient(to top, #fff 2px, transparent 2px) 100% 100%;
  background-repeat: no-repeat;
  background-size: 30px 30px;
  margin: 40px;
  width: calc(100% - 80px);
  height: calc(100% - 80px);
  opacity: 0.6;
}

.attendees-list {
  max-height: calc(100vh - 400px);
  overflow-y: auto;
}

@keyframes scan-line {
  0% { transform: translateY(0); }
  50% { transform: translateY(320px); }
  100% { transform: translateY(0); }
}

.scanner-result-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 100;
  backdrop-filter: blur(4px);
}

.result-box {
  background: rgb(var(--v-theme-surface));
  color: rgb(var(--v-theme-on-surface));
  min-width: 280px;
  max-width: 90%;
  border-bottom: 8px solid transparent;
}

.success-box { border-color: rgb(var(--v-theme-success)); }
.warning-box { border-color: rgb(var(--v-theme-warning)); }
.error-box { border-color: rgb(var(--v-theme-error)); }

.animate-bounce {
  animation: bounce 0.8s ease infinite;
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-8px); }
  75% { transform: translateX(8px); }
}

.line-height-1 {
  line-height: 1;
}

.opacity-80 {
  opacity: 0.8;
}

@media (max-width: 959px) {
  .scanner-tab-content {
    min-height: 350px;
  }
}
</style>
