<script setup>
  import { onMounted, ref } from 'vue'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'

  definePage({
    name: 'export-data-admin',
    meta: {
      layout: 'default',
      title: 'Export Data',
      titleKey: 'pages.admin.export',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const store = useStore()
  const { t } = useI18n()
  const { rounded, variant, density } = useUiProps()

  const exportFormat = ref('csv')
  const eventId = ref(null)
  const dateRange = ref([])
  const isExporting = ref(false)
  const events = ref([])
  const expandedPanel = ref([0]) // Keep first panel expanded by default

  // Fetch events for dropdown
  async function fetchEvents () {
    try {
      const response = await $axios.get('/event')
      events.value = response.data?.payload?.events || []
    } catch (error) {
      console.error('Error fetching events:', error)
    }
  }

  // Export sales data
  async function exportSales () {
    if (isExporting.value) return

    try {
      isExporting.value = true

      const params = new URLSearchParams()
      params.append('format', exportFormat.value)
      if (eventId.value) params.append('eventId', eventId.value)
      if (dateRange.value && Array.isArray(dateRange.value) && dateRange.value.length > 0) {
        const start = dateRange.value[0]
        const end = dateRange.value.length > 1 ? dateRange.value[1] : dateRange.value[0]
        if (start) {
          params.append('startDate', start.toISOString().split('T')[0])
        }
        if (end) {
          params.append('endDate', end.toISOString().split('T')[0])
        }
      }

      const response = await $axios.get(`/admin/sales-export?${params.toString()}`, {
        responseType: 'blob',
      })

      // Create download link
      const blob = new Blob([response.data], {
        type: exportFormat.value === 'json' ? 'application/json' : 'text/csv',
      })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `sales-data-${Date.now()}.${exportFormat.value}`
      document.body.append(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      store.commit('addSnackbar', {
        text: 'Sales export downloaded successfully!',
        color: 'success',
      })
    } catch (error) {
      console.error('Error exporting sales:', error)
      store.commit('addSnackbar', {
        text: error.response?.data?.message || 'Error exporting sales data',
        color: 'error',
      })
    } finally {
      isExporting.value = false
    }
  }

  // Set default date range (last 30 days)
  function setDefaultDateRange () {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - 30)
    dateRange.value = [start, end]
  }

  // Set last month
  function setLastMonth () {
    const end = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - 1)
    dateRange.value = [start, end]
  }

  // Set last year
  function setLastYear () {
    const end = new Date()
    const start = new Date()
    start.setFullYear(start.getFullYear() - 1)
    dateRange.value = [start, end]
  }

  // Clear dates
  function clearDates () {
    dateRange.value = []
  }

  onMounted(() => {
    fetchEvents()
    setDefaultDateRange()
  })
</script>

<template>
  <v-container class="sales-export-container">
    <PageTitle
      :show-back-button="true"
      :subtitle="t('menu.export_data')"
      :title="t('pages.admin.export')"
      :title-key="'pages.admin.export'"
    />

    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-expansion-panels
          v-model="expandedPanel"
          :rounded="rounded"
        >
          <v-expansion-panel :rounded="rounded">
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-file-export</v-icon>
              <span class="text-h6">Sales Data Export</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-form @submit.prevent="exportSales">
                <!-- Format Selection -->
                <v-select
                  v-model="exportFormat"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :items="[
                    { title: 'CSV', value: 'csv' },
                    { title: 'JSON', value: 'json' }
                  ]"
                  label="Export Format"
                  prepend-inner-icon="mdi-file-export"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Event Filter (Optional) -->
                <v-select
                  v-model="eventId"
                  class="mb-4"
                  clearable
                  :density="density"
                  hide-details="auto"
                  item-title="name"
                  item-value="id"
                  :items="events"
                  label="Event (Optional - leave empty for all events)"
                  prepend-inner-icon="mdi-calendar"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Date Range -->
                <v-date-input
                  v-model="dateRange"
                  class="mb-4"
                  color="primary"
                  :density="density"
                  hide-details="auto"
                  label="Date Range (Optional)"
                  multiple="range"
                  prepend-icon=""
                  prepend-inner-icon="mdi-calendar-range"
                  :rounded="rounded"
                  show-adjacent-months
                  :variant="variant"
                />

                <!-- Quick Date Range Buttons -->
                <div class="d-flex gap-2 mb-4">
                  <v-btn
                    color="secondary"
                    density="comfortable"
                    prepend-icon="mdi-calendar-month"
                    :rounded="rounded"
                    variant="outlined"
                    @click="setLastMonth"
                  >
                    Last Month
                  </v-btn>
                  <v-btn
                    color="secondary"
                    density="comfortable"
                    prepend-icon="mdi-calendar-month-outline"
                    :rounded="rounded"
                    variant="outlined"
                    @click="setLastYear"
                  >
                    Last Year
                  </v-btn>
                  <v-btn
                    color="secondary"
                    density="comfortable"
                    prepend-icon="mdi-close-circle"
                    :rounded="rounded"
                    variant="outlined"
                    @click="clearDates"
                  >
                    Clear
                  </v-btn>
                </div>

                <v-divider class="my-4" />

                <!-- Info Alert -->
                <v-alert
                  class="mb-4"
                  color="info"
                  density="compact"
                  variant="tonal"
                >
                  <div class="text-body-2">
                    <strong>Export Information:</strong>
                    <ul class="mt-2 mb-0">
                      <li>Only <strong>paid</strong> orders are included</li>
                      <li>Each ticket and product is exported as a separate line item</li>
                      <li>Customer information is taken from the primary attendee</li>
                      <li>Tax amounts and rates are calculated automatically</li>
                    </ul>
                  </div>
                </v-alert>

                <div class="d-flex align-center mt-3 mt-md-4">
                  <v-spacer />
                  <v-btn
                    color="primary"
                    :disabled="isExporting"
                    :loading="isExporting"
                    prepend-icon="mdi-download"
                    :rounded="rounded"
                    :size="xs ? 'default' : 'large'"
                    type="submit"
                  >
                    Export Sales Data
                  </v-btn>
                </div>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.sales-export-container {
  min-height: calc(100vh - 64px);
}

.form-card {
  border-radius: 16px;
  overflow: hidden;
}

/* Responsive Design */
@media (max-width: 768px) {
  .sales-export-container {
  }

  .d-flex.gap-2 {
    flex-direction: column;
    gap: 8px !important;
  }
}
</style>
