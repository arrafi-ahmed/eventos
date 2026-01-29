<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'

  definePage({
    name: 'admin-dashboard',
    meta: {
      layout: 'default',
      title: 'Dashboard',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const store = useStore()
  const { rounded, variant, density } = useUiProps()

  // State
  const reportType = ref('event')
  const dateRange = ref([])
  const selectedEvents = ref([])
  const selectedCounter = ref(null)
  const selectedCashier = ref(null)
  const selectedPaymentMethod = ref(null)
  const exportFormat = ref('excel')
  const isLoading = ref(true) // Start with true for initial load
  const isTableLoading = ref(false)
  const isExporting = ref(false)
  const filterDialog = ref(false)

  // Temporary filter state (used in dialog)
  const tempSelectedEvents = ref([])
  const tempSelectedCounter = ref(null)
  const tempSelectedCashier = ref(null)
  const tempSelectedPaymentMethod = ref(null)
  const tempSelectedDatePreset = ref('month')
  const tempDateRange = ref([])

  // Search states for autocomplete
  const eventSearch = ref('')
  const counterSearch = ref('')
  const cashierSearch = ref('')
  const isLoadingEvents = ref(false)
  const isLoadingCounters = ref(false)
  const isLoadingCashiers = ref(false)

  // Data
  const events = ref([])
  const counters = ref([])
  const cashiers = ref([])
  const paymentMethods = [
    { title: 'Cash', value: 'cash' },
    { title: 'Card', value: 'card' },
    { title: 'Free', value: 'free' },
  ]
  const overallSummary = ref({
    orders: 0,
    tickets: 0,
    attendees: 0,
    checkedIn: 0,
    events: 0,
    organizers: 0,
    revenue: 0,
  })
  const summary = ref({
    orders: 0,
    tickets: 0,
    attendees: 0,
    checkedIn: 0,
    events: 0,
    organizers: 0,
    revenue: 0,
  })
  const checkinData = ref([])
  const capacityData = ref([])
  const salesByChannelData = ref([])
  const tableData = ref([])

  // Date presets
  const datePresets = [
    { title: 'Today', value: 'today' },
    { title: 'Last 7 Days', value: 'week' },
    { title: 'Last 30 Days', value: 'month' },
    { title: 'This Month', value: 'thisMonth' },
    { title: 'Last Month', value: 'lastMonth' },
    { title: 'Custom Range', value: 'custom' },
  ]

  const selectedDatePreset = ref('month')

  // Computed property for dynamic date range display
  const selectedDatePresetDisplay = computed(() => {
    const preset = datePresets.find(p => p.value === selectedDatePreset.value)
    return preset ? preset.title : 'Custom Range'
  })

  // Table headers based on report type
  const tableHeaders = computed(() => {
    switch (reportType.value) {
      case 'event': {
        return [
          { title: 'Event Name', key: 'eventName', sortable: true },
          { title: 'Date', key: 'eventDate', sortable: true },
          { title: 'Orders', key: 'totalOrders', sortable: true },
          { title: 'Revenue', key: 'totalRevenue', sortable: true },
        ]
      }
      case 'counter': {
        return [
          { title: 'Counter Name', key: 'counterName', sortable: true },
          { title: 'Location', key: 'location', sortable: true },
          { title: 'Orders', key: 'totalOrders', sortable: true },
          { title: 'Revenue', key: 'totalRevenue', sortable: true },
        ]
      }
      case 'cashier': {
        return [
          { title: 'Cashier', key: 'cashierName', sortable: true },
          { title: 'Counter', key: 'counterName', sortable: true },
          { title: 'Orders', key: 'totalOrders', sortable: true },
          { title: 'Revenue', key: 'totalRevenue', sortable: true },
        ]
      }
      case 'payment': {
        return [
          { title: 'Payment Method', key: 'paymentMethod', sortable: true },
          { title: 'Currency', key: 'currency', sortable: true },
          { title: 'Transactions', key: 'totalOrders', sortable: true },
          { title: 'Amount', key: 'totalRevenue', sortable: true },
          { title: 'Percentage', key: 'percentage', sortable: true },
        ]
      }
      default: {
        return []
      }
    }
  })

  // Simple number formatter for Y-axis

  // Fetch events with search
  async function fetchEvents (search = '') {
    try {
      isLoadingEvents.value = true
      const params = search ? { search } : {}
      const response = await $axios.get('/event/getAllEvents', { params })
      events.value = response.data?.payload?.items || []
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      isLoadingEvents.value = false
    }
  }

  // Fetch counters with search
  async function fetchCounters (search = '') {
    try {
      isLoadingCounters.value = true
      const params = search ? { search } : {}
      const response = await $axios.get('/ticket-counter', { params })
      counters.value = response.data?.payload || []
    } catch (error) {
      console.error('Error fetching counters:', error)
    } finally {
      isLoadingCounters.value = false
    }
  }

  // Fetch cashiers with search
  async function fetchCashiers (search = '') {
    try {
      isLoadingCashiers.value = true
      const params = search ? { search } : {}
      const response = await $axios.get('/user/cashiers', { params })
      cashiers.value = response.data?.payload || []
    } catch (error) {
      console.error('Error fetching cashiers:', error)
    } finally {
      isLoadingCashiers.value = false
    }
  }

  // Apply date preset
  function applyDatePreset (preset) {
    const today = new Date()
    const start = new Date()

    switch (preset) {
      case 'today': {
        dateRange.value = [today, today]
        break
      }
      case 'week': {
        start.setDate(start.getDate() - 7)
        dateRange.value = [start, today]
        break
      }
      case 'month': {
        start.setDate(start.getDate() - 30)
        dateRange.value = [start, today]
        break
      }
      case 'thisMonth': {
        start.setDate(1)
        dateRange.value = [start, today]
        break
      }
      case 'lastMonth': {
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
        dateRange.value = [lastMonthStart, lastMonthEnd]
        break
      }
    }
  }

  // Fetch report data
  async function fetchReportData (isInitial = false, isTableOnly = false) {
    try {
      if (isInitial) {
        isLoading.value = true
      } else {
        isTableLoading.value = true
      }

      const params = {
        reportType: reportType.value,
        eventIds: selectedEvents.value,
      }

      if (isTableOnly) {
        params.tableOnly = true
      }

      if (dateRange.value && dateRange.value.length > 0) {
        params.startDate = dateRange.value[0]?.toISOString().split('T')[0]
        params.endDate = (dateRange.value[1] || dateRange.value[0])?.toISOString().split('T')[0]
      }

      const response = await $axios.get('/admin/reports/summary', { params })

      // Only update cards/charts if not tableOnly
      if (!isTableOnly) {
        // Update summary cards
        const summaryData = response.data?.payload?.summary || {
          orders: 0,
          tickets: 0,
          attendees: 0,
          checkedIn: 0,
          events: 0,
          organizers: 0,
          revenues: [],
        }

        // Pick the primary revenue (one with amount > 0, or first one) for the card display and scaling
        const revenues = summaryData.revenues || []
        const primaryRevenue = revenues.find(r => r.amount > 0) || revenues[0] || { amount: 0, currency: 'USD' }

        summary.value = {
          ...summaryData,
          revenue: primaryRevenue.amount,
          currency: primaryRevenue.currency,
          revenueBreakdown: revenues,
        }

        // Update capacity data with parsing to avoid NaN%
        capacityData.value = (response.data?.payload?.capacity || []).map(item => ({
          ...item,
          sold: Number.parseInt(item.sold) || 0,
          totalCapacity: Number.parseInt(item.totalCapacity) || 0,
          remaining: Number.parseInt(item.remaining) || 0,
        }))

        salesByChannelData.value = (response.data?.payload?.channels || []).map((item, index) => {
          return {
            key: item.name || `channel-${index}`,
            title: item.name || 'Unknown',
            value: Number.parseInt(item.revenue) || 0,
            color: item.name === 'Counter' ? '#1867C0' : '#5CBBF6',
          }
        })

        // Update checkin data for pie chart
        const checkedInCount = Number.parseInt(summary.value.checkedIn) || 0
        const totalTickets = Number.parseInt(summary.value.tickets) || 0
        const absentCount = Math.max(0, totalTickets - checkedInCount)

        checkinData.value = [
          { key: 'checked-in', title: 'Checked In', value: checkedInCount, color: '#2E7D32' },
          { key: 'absent', title: 'Absent', value: absentCount, color: '#ED2939' },
        ]
      }

      // Update table data
      tableData.value = response.data?.payload?.tableData || []
    } catch (error) {
      console.error('Error fetching report data:', error)
      store.commit('addSnackbar', {
        text: error.response?.data?.message || 'Error loading report data',
        color: 'error',
      })
    } finally {
      isLoading.value = false
      isTableLoading.value = false
    }
  }

  // Export report
  async function exportReport (format) {
    try {
      isExporting.value = true

      const params = new URLSearchParams()
      params.append('format', format)
      params.append('reportType', reportType.value)

      if (selectedEvents.value.length > 0) {
        params.append('eventIds', selectedEvents.value.join(','))
      }

      if (dateRange.value && dateRange.value.length > 0) {
        params.append('startDate', dateRange.value[0]?.toISOString().split('T')[0])
        params.append('endDate', (dateRange.value[1] || dateRange.value[0])?.toISOString().split('T')[0])
      }

      const response = await $axios.get(`/admin/reports/export?${params.toString()}`, {
        responseType: 'blob',
      })

      // Create download link
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const extension = format === 'excel' ? 'xlsx' : format
      link.download = `report-${reportType.value}-${Date.now()}.${extension}`
      document.body.append(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      store.commit('addSnackbar', {
        text: 'Report exported successfully!',
        color: 'success',
      })
    } catch (error) {
      console.error('Error exporting report:', error)
      store.commit('addSnackbar', {
        text: error.response?.data?.message || 'Error exporting report',
        color: 'error',
      })
    } finally {
      isExporting.value = false
    }
  }

  // Format currency
  function formatCurrency (value, currency = 'USD') {
    if (!currency) currency = 'USD'
    const isZeroDecimal = ['IDR', 'JPY', 'KRW', 'VND'].includes(currency.toUpperCase())
    const amount = isZeroDecimal ? value : (value / 100)

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: isZeroDecimal ? 0 : 2,
      maximumFractionDigits: isZeroDecimal ? 0 : 2,
    }).format(amount)
  }

  // Reset all filters
  function resetFilters () {
    selectedEvents.value = []
    selectedCounter.value = null
    selectedCashier.value = null
    selectedPaymentMethod.value = null
    selectedDatePreset.value = 'month'
    applyDatePreset('month')

    // Also reset temp values
    tempSelectedEvents.value = []
    tempSelectedCounter.value = null
    tempSelectedCashier.value = null
    tempSelectedPaymentMethod.value = null
    tempSelectedDatePreset.value = 'month'
    tempDateRange.value = []

    // Close dialog and fetch data
    filterDialog.value = false
    fetchReportData(true)
  }

  // Apply filters from dialog
  function applyFilters () {
    // Empty arrays/null values mean "All" - so we keep them as is
    selectedEvents.value = tempSelectedEvents.value.length > 0 ? [...tempSelectedEvents.value] : []
    selectedCounter.value = tempSelectedCounter.value
    selectedCashier.value = tempSelectedCashier.value
    selectedPaymentMethod.value = tempSelectedPaymentMethod.value
    selectedDatePreset.value = tempSelectedDatePreset.value
    dateRange.value = [...tempDateRange.value]

    filterDialog.value = false
    fetchReportData(true)
  }

  // Open filter dialog and sync temp values
  function openFilterDialog () {
    tempSelectedEvents.value = [...selectedEvents.value]
    tempSelectedCounter.value = selectedCounter.value
    tempSelectedCashier.value = selectedCashier.value
    tempSelectedPaymentMethod.value = selectedPaymentMethod.value
    tempSelectedDatePreset.value = selectedDatePreset.value
    tempDateRange.value = [...dateRange.value]
    filterDialog.value = true
  }

  // Watch for search changes
  watch(eventSearch, value => {
    if (value) fetchEvents(value)
  })

  watch(counterSearch, value => {
    if (value) fetchCounters(value)
  })

  watch(cashierSearch, value => {
    if (value) fetchCashiers(value)
  })

  watch(tempSelectedDatePreset, preset => {
    if (preset !== 'custom') {
      const today = new Date()
      const start = new Date()

      switch (preset) {
        case 'today': {
          tempDateRange.value = [today, today]
          break
        }
        case 'week': {
          start.setDate(start.getDate() - 7)
          tempDateRange.value = [start, today]
          break
        }
        case 'month': {
          start.setDate(start.getDate() - 30)
          tempDateRange.value = [start, today]
          break
        }
        case 'thisMonth': {
          start.setDate(1)
          tempDateRange.value = [start, today]
          break
        }
        case 'lastMonth': {
          const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0)
          const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
          tempDateRange.value = [lastMonthStart, lastMonthEnd]
          break
        }
      }
    }
  })

  onMounted(async () => {
    applyDatePreset('month')
    fetchEvents()
    fetchCounters()
    fetchCashiers()
    
    // Fetch overall summary once for the top cards
    try {
      const response = await $axios.get('/admin/reports/summary', { params: { isOverall: true } })
      const data = response.data?.payload?.summary || {}
      const revenues = data.revenues || []
      const primaryRevenue = revenues.find(r => r.amount > 0) || revenues[0] || { amount: 0, currency: 'USD' }
      
      overallSummary.value = {
        ...data,
        revenue: primaryRevenue.amount,
        currency: primaryRevenue.currency,
      }
    } catch (error) {
      console.error('Error fetching overall summary:', error)
    }

    fetchReportData(true)
  })
</script>

<template>
  <v-container class="reports-container">
    <v-row justify="center">
      <v-col
        cols="12"
        lg="10"
        xl="10"
      >
        <PageTitle
          :show-back-button="false"
          subtitle="Analytics & insights"
          title="Dashboard"
        >
          <template #actions>
            <v-btn
              color="primary"
              :density="density"
              prepend-icon="mdi-filter-variant"
              :rounded="rounded"
              :size="size"
              variant="tonal"
              @click="openFilterDialog"
            >
              Filters
            </v-btn>
            <v-menu location="bottom end">
              <template #activator="{ props }">
                <v-btn
                  class="ml-2"
                  color="primary"
                  :density="density"
                  :disabled="isExporting"
                  :loading="isExporting"
                  prepend-icon="mdi-download"
                  :rounded="rounded"
                  :size="size"
                  variant="flat"
                  v-bind="props"
                >
                  Download
                </v-btn>
              </template>
              <v-list density="compact">
                <v-list-item
                  prepend-icon="mdi-file-excel"
                  title="Excel"
                  @click="exportReport('excel')"
                />
                <v-list-item
                  prepend-icon="mdi-file-pdf-box"
                  title="PDF"
                  @click="exportReport('pdf')"
                />
              </v-list>
            </v-menu>
          </template>
        </PageTitle>

        <!-- Filter Dialog -->
        <v-dialog
          v-model="filterDialog"
          max-width="700"
          :rounded="rounded"
        >
          <v-card :rounded="rounded">
            <v-card-title class="pa-6 pb-2 d-flex align-center">
              <v-icon class="me-2">mdi-filter-variant</v-icon>
              Report Filters
              <v-spacer />
              <v-btn
                icon="mdi-close"
                size="small"
                variant="text"
                @click="filterDialog = false"
              />
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-row>
                <v-col cols="12" md="6">
                  <v-autocomplete
                    v-model="tempSelectedEvents"
                    v-model:search="eventSearch"
                    chips
                    clearable
                    :closable-chips="true"
                    :density="'comfortable'"
                    hide-details="auto"
                    item-title="name"
                    item-value="id"
                    :items="events"
                    label="Events"
                    :loading="isLoadingEvents"
                    multiple
                    prepend-inner-icon="mdi-calendar"
                    :rounded="rounded"
                    :variant="variant"
                  >
                    <template #chip="{ item, props }">
                      <v-chip
                        v-bind="props"
                        closable
                        @click:close="tempSelectedEvents = tempSelectedEvents.filter(id => id !== item.value)"
                      >
                        {{ item.title }}
                      </v-chip>
                    </template>
                  </v-autocomplete>
                </v-col>
                <v-col cols="12" md="6">
                  <v-autocomplete
                    v-model="tempSelectedCounter"
                    v-model:search="counterSearch"
                    clearable
                    :closable-chips="true"
                    :density="'comfortable'"
                    hide-details="auto"
                    item-title="name"
                    item-value="id"
                    :items="counters"
                    label="Ticket Counter"
                    :loading="isLoadingCounters"
                    prepend-inner-icon="mdi-store"
                    :rounded="rounded"
                    :variant="variant"
                  />
                </v-col>
              </v-row>
              <v-row class="mt-2">
                <v-col cols="12" md="6">
                  <v-autocomplete
                    v-model="tempSelectedCashier"
                    v-model:search="cashierSearch"
                    clearable
                    :closable-chips="true"
                    :density="'comfortable'"
                    hide-details="auto"
                    item-title="full_name"
                    item-value="id"
                    :items="cashiers"
                    label="Cashier"
                    :loading="isLoadingCashiers"
                    prepend-inner-icon="mdi-account-cash"
                    :rounded="rounded"
                    :variant="variant"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <v-select
                    v-model="tempSelectedPaymentMethod"
                    clearable
                    :density="'comfortable'"
                    hide-details="auto"
                    :items="paymentMethods"
                    label="Payment Method"
                    prepend-inner-icon="mdi-credit-card"
                    :rounded="rounded"
                    :variant="variant"
                  />
                </v-col>
              </v-row>
              <v-row class="mt-2">
                <v-col cols="12" :md="tempSelectedDatePreset === 'custom' ? 6 : 6">
                  <v-select
                    v-model="tempSelectedDatePreset"
                    :density="'comfortable'"
                    hide-details="auto"
                    :items="datePresets"
                    label="Date Range"
                    prepend-inner-icon="mdi-calendar-range"
                    :rounded="rounded"
                    :variant="variant"
                  />
                </v-col>
                <v-col v-if="tempSelectedDatePreset === 'custom'" cols="12" md="6">
                  <v-date-input
                    v-model="tempDateRange"
                    color="primary"
                    :density="'comfortable'"
                    hide-details="auto"
                    label="Custom Date Range"
                    multiple="range"
                    prepend-icon=""
                    prepend-inner-icon="mdi-calendar-range"
                    :rounded="rounded"
                    show-adjacent-months
                    :variant="variant"
                  />
                </v-col>
              </v-row>
            </v-card-text>
            <v-divider />
            <v-card-actions class="pa-6 pt-4">
              <v-btn
                prepend-icon="mdi-refresh"
                :rounded="rounded"
                variant="text"
                @click="resetFilters"
              >
                Reset
              </v-btn>
              <v-spacer />
              <v-btn
                color="primary"
                :rounded="rounded"
                variant="flat"
                @click="applyFilters"
              >
                Apply Filters
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

        <!-- Loading State -->
        <v-row v-if="isLoading" justify="center">
          <v-col class="text-center py-12" cols="12">
            <v-progress-circular
              color="primary"
              indeterminate
              size="64"
            />
            <p class="mt-4 text-body-1">Loading report data...</p>
          </v-col>
        </v-row>

        <template v-else>
          <!-- Summary Cards - Top Row: 4 Stat Cards -->
          <v-row class="mb-4">
            <!-- Total Events -->
            <v-col cols="12" md="3" sm="6">
              <v-card class="stat-card" elevation="2" :rounded="rounded">
                <v-card-text class="pa-6">
                  <div class="d-flex align-center mb-2">
                    <v-icon color="secondary" size="32">mdi-calendar-check</v-icon>
                    <v-spacer />
                    <v-chip color="secondary" size="small" variant="flat">
                      Events
                    </v-chip>
                  </div>
                  <div class="text-h4 font-weight-bold text-secondary">
                    {{ (overallSummary.events || 0).toLocaleString() }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Total Events
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Total Tickets Sold -->
            <v-col cols="12" md="3" sm="6">
              <v-card class="stat-card" elevation="2" :rounded="rounded">
                <v-card-text class="pa-6">
                  <div class="d-flex align-center mb-2">
                    <v-icon color="primary" size="32">mdi-ticket</v-icon>
                    <v-spacer />
                    <v-chip color="primary" size="small" variant="flat">
                      Tickets
                    </v-chip>
                  </div>
                  <div class="text-h4 font-weight-bold text-primary">
                    {{ (overallSummary.tickets || 0).toLocaleString() }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Total Tickets Sold
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Total Organizers -->
            <v-col cols="12" md="3" sm="6">
              <v-card class="stat-card" elevation="2" :rounded="rounded">
                <v-card-text class="pa-6">
                  <div class="d-flex align-center mb-2">
                    <v-icon color="info" size="32">mdi-account-group</v-icon>
                    <v-spacer />
                    <v-chip color="info" size="small" variant="flat">
                      Organizers
                    </v-chip>
                  </div>
                  <div class="text-h4 font-weight-bold text-info">
                    {{ (overallSummary.organizers || 0).toLocaleString() }}
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Total Organizers
                  </div>
                </v-card-text>
              </v-card>
            </v-col>

            <!-- Attendance Rate -->
            <v-col cols="12" md="3" sm="6">
              <v-card class="stat-card" elevation="2" :rounded="rounded">
                <v-card-text class="pa-6">
                  <div class="d-flex align-center mb-2">
                    <v-icon color="warning" size="32">mdi-trending-up</v-icon>
                    <v-spacer />
                    <v-chip color="warning" size="small" variant="flat">
                      Attendance
                    </v-chip>
                  </div>
                  <div class="text-h4 font-weight-bold text-warning">
                    {{ Math.round((overallSummary.checkedIn / (overallSummary.tickets || 1)) * 100) }}%
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Overall Attendance
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Analytics Charts (Conditional on event selection) -->
          <template v-if="selectedEvents.length > 0">
            <v-row class="mb-4">
              <v-col cols="12" md="6">
                <v-card class="chart-card" elevation="2" :rounded="rounded">
                  <v-card-title class="pa-6 pb-2">
                    <v-icon class="me-2" color="primary">mdi-account-check</v-icon>
                    Check-in Status
                  </v-card-title>
                  <v-card-text class="pa-6 pt-2">
                    <div class="d-flex justify-center py-4">
                      <v-pie
                        v-if="checkinData.length > 0"
                        animation
                        height="250"
                        item-key="key"
                        :items="checkinData"
                        legend
                        reveal
                        tooltip
                        width="280"
                      />
                    </div>
                    <div v-if="checkinData.length === 0" class="text-center py-8 text-medium-emphasis">
                      No check-in data available
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>

              <v-col cols="12" md="6">
                <v-card class="chart-card" elevation="2" :rounded="rounded">
                  <v-card-title class="pa-6 pb-2">
                    <v-icon class="me-2" color="primary">mdi-chart-donut</v-icon>
                    Sales Channels
                  </v-card-title>
                  <v-card-text class="pa-6 pt-2">
                    <div class="d-flex justify-center py-4">
                      <v-pie
                        v-if="salesByChannelData.length > 0"
                        animation
                        height="250"
                        item-key="key"
                        :items="salesByChannelData"
                        :legend="{
                          visible: true,
                          textFormat: (item) => `${item.title}: ${formatCurrency(item.value, summary.currency)}`
                        }"
                        reveal
                        :tooltip="{
                          subtitleFormat: (item) => formatCurrency(item.value, summary.currency)
                        }"
                        width="280"
                      />
                    </div>
                    <div v-if="salesByChannelData.length === 0" class="text-center py-8 text-medium-emphasis">
                      No channel data available
                    </div>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>

            <!-- Ticket Capacity Table -->
            <v-row class="mb-6">
              <v-col cols="12">
                <v-card elevation="2" :rounded="rounded">
                  <v-card-title class="pa-6 pb-2">
                    <v-icon class="me-2" color="primary">mdi-ticket-percent</v-icon>
                    Ticket Capacity Details
                  </v-card-title>
                  <v-card-text class="pa-6 pt-0">
                    <v-table density="comfortable">
                      <thead>
                        <tr>
                          <th class="text-left">Ticket Type</th>
                          <th class="text-center">Sold</th>
                          <th class="text-center">Remaining</th>
                          <th class="text-center">Total Capacity</th>
                          <th class="text-right">Utilization</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr v-for="item in capacityData" :key="item.ticketName">
                          <td>{{ item.ticketName }}</td>
                          <td class="text-center">{{ item.sold }}</td>
                          <td class="text-center">{{ item.remaining }}</td>
                          <td class="text-center">{{ item.totalCapacity }}</td>
                          <td class="text-right">
                            <v-progress-linear
                              color="primary"
                              height="8"
                              :model-value="(item.sold / (item.totalCapacity || 1)) * 100"
                              rounded
                            />
                            <span class="text-caption">{{ Math.round((item.sold / (item.totalCapacity || 1)) * 100) }}%</span>
                          </td>
                        </tr>
                      </tbody>
                    </v-table>
                  </v-card-text>
                </v-card>
              </v-col>
            </v-row>
          </template>

          <v-row v-else class="mb-6">
            <v-col class="text-center" cols="12">
              <div class="text-body-1 text-medium-emphasis py-4">
                Please select a specific event from the filters to view detailed charts and capacity trends.
              </div>
            </v-col>
          </v-row>

          <!-- Main Report Table (Always Shown) -->
          <v-row class="mb-6">
            <v-col cols="12">
              <v-card elevation="2" :rounded="rounded">
                <v-card-title class="pa-6 pb-2 d-flex align-center">
                  <v-icon class="me-2" color="primary">mdi-table</v-icon>
                  {{ reportType.charAt(0).toUpperCase() + reportType.slice(1) }} Breakdown
                  <v-spacer />
                  <v-select
                    v-model="reportType"
                    density="compact"
                    hide-details
                    :items="[
                      { title: 'By Event', value: 'event' },
                      { title: 'By Counter', value: 'counter' },
                      { title: 'By Cashier', value: 'cashier' },
                      { title: 'By Payment Method', value: 'payment' }
                    ]"
                    label="Report Type"
                    style="max-width: 200px"
                    variant="outlined"
                    @update:model-value="fetchReportData(false, true)"
                  />
                </v-card-title>
                <v-card-text class="pa-0">
                  <v-data-table
                    class="elevation-0"
                    :headers="tableHeaders"
                    hover
                    :items="tableData"
                    :loading="isTableLoading"
                    :sort-by="reportType === 'day' ? [{ key: 'saleDate', order: 'desc' }] : []"
                  >
                    <template #[`item.totalRevenue`]="{ item }">
                      {{ formatCurrency(item.totalRevenue || item.revenue, item.currency) }}
                    </template>
                    <template #[`item.eventDate`]="{ item }">
                      {{ item.eventDate ? new Date(item.eventDate).toLocaleDateString() : 'N/A' }}
                    </template>
                    <template #[`item.saleDate`]="{ item }">
                      {{ item.saleDate ? new Date(item.saleDate).toLocaleDateString() : 'N/A' }}
                    </template>
                  </v-data-table>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </template>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.reports-container {
  max-width: 1400px;
  padding: 24px;
}

.stat-card,
.chart-card {
  height: 100%;
  transition: transform 0.2s;
}

.stat-card:hover,
.chart-card:hover {
  transform: translateY(-2px);
}

.sparkline-container {
  position: relative;
  padding-left: 50px;
}

 .y-axis-labels {
  position: absolute;
  left: 0;
  top: 20px; /* Exactly matching sparkline top padding */
  bottom: 50px; /* Padding (20px) + X-axis label space (30px) */
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 10px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  text-align: right;
  width: 45px;
  padding-right: 5px;
  border-right: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  z-index: 1;
}

.y-label {
  line-height: 1;
  transform: translateY(-50%);
}

.y-label:first-child {
  transform: translateY(0);
}

.y-label:last-child {
  transform: translateY(-100%);
}

@media (max-width: 768px) {
  .reports-container {
    padding: 16px;
  }
}
</style>
