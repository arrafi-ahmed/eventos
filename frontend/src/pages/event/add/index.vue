<script setup>
  import { reactive, ref, watch } from 'vue'

  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import TimePicker from '@/components/TimePicker.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { Event } from '@/models/Event'
  import { EventConfig } from '@/models/EventConfig'
  import { generateSlug, mergeDateTime, getCurrencySymbol } from '@/utils'
  import CurrencySelector from '@/components/CurrencySelector.vue'

  definePage({
    name: 'event-add',
    meta: {
      layout: 'default',
      title: 'Add Event',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, variant, density } = useUiProps()
  const router = useRouter()
  const store = useStore()

  const newEventInit = reactive({
    ...new Event({}),
    dateRange: [new Date(), new Date()],
    startTime: '09:00',
    endTime: '17:00',
  })
  const newEvent = reactive({ ...newEventInit })

  const configDialog = ref(false)
  const config = reactive({ ...new EventConfig() })
  const form = ref(null)
  const isFormValid = ref(true)

  const dateFormatOptions = [
    { title: 'MM/DD/YYYY HH:mm (12/25/2024 14:30)', value: 'MM/DD/YYYY HH:mm' },
    { title: 'MM/DD/YYYY (12/25/2024)', value: 'MM/DD/YYYY' },
    { title: 'DD/MM/YYYY (25/12/2024)', value: 'DD/MM/YYYY' },
    { title: 'YYYY-MM-DD (2024-12-25)', value: 'YYYY-MM-DD' },
    { title: 'MMM DD, YYYY (Dec 25, 2024)', value: 'MMM DD, YYYY' },
    { title: 'MMMM DD, YYYY (December 25, 2024)', value: 'MMMM DD, YYYY' },
    { title: 'DD MMM YYYY (25 Dec 2024)', value: 'DD MMM YYYY' },
  ]

  function handleEventBanner (file) {
    newEvent.banner = file
  }

  // Watch for title changes and auto-generate slug if slug field is empty
  watch(
    () => newEvent.name,
    newTitle => {
      if (newTitle && !newEvent.slug) {
        newEvent.slug = generateSlug(newTitle)
      }
    },
  )

  // Watch for config changes to update the event config
  watch(
    () => config,
    newConfig => {
      newEvent.config = { ...newConfig }
    },
    { deep: true },
  )

  function openConfigDialog () {
    // Sync current config with dialog
    Object.assign(config, newEvent.config)
    configDialog.value = true
  }

  function saveConfig () {
    // Update event config with dialog values
    newEvent.config = { ...config }
    configDialog.value = false
  }

  async function handleAddEvent () {
    await form.value.validate()
    if (!isFormValid.value) return

    // Auto-generate slug if empty
    if (!newEvent.slug || newEvent.slug.trim() === '') {
      newEvent.slug = generateSlug(newEvent.name)
    }

    if (newEvent.config.isAllDay) {
      // For all-day events, use just the date part
      newEvent.startDatetime = mergeDateTime({ dateStr: newEvent.dateRange[0], timeStr: '00:01', isOutputUTC: true })
      newEvent.endDatetime = newEvent.config.isSingleDayEvent
        ? mergeDateTime({ dateStr: newEvent.dateRange[0], timeStr: '23:59', isOutputUTC: true })
        : mergeDateTime({ dateStr: newEvent.dateRange.at(-1), timeStr: '23:59', isOutputUTC: true })
    } else {
      // For timed events, combine date and time
      newEvent.startDatetime = mergeDateTime({
        dateStr: newEvent.dateRange[0],
        timeStr: newEvent.startTime,
        isOutputUTC: true,
      })
      newEvent.endDatetime = newEvent.config.isSingleDayEvent
        ? mergeDateTime({
          dateStr: newEvent.dateRange.at(0),
          timeStr: newEvent.endTime,
          isOutputUTC: true,
        })
        : mergeDateTime({
          dateStr: newEvent.dateRange.at(-1),
          timeStr: newEvent.endTime,
          isOutputUTC: true,
        })
    }

    const formData = new FormData()
    formData.append('name', newEvent.name)
    formData.append('description', newEvent.description)
    formData.append('location', newEvent.location)
    formData.append('startDatetime', newEvent.startDatetime)
    formData.append('endDatetime', newEvent.endDatetime || '')
    formData.append('config', JSON.stringify(newEvent.config))
    formData.append('slug', newEvent.slug)
    formData.append('currency', newEvent.currency)
    formData.append('taxType', newEvent.taxType)
    formData.append('taxAmount', newEvent.taxAmount)

    if (newEvent.banner) formData.append('files', newEvent.banner)

    store.dispatch('event/save', formData).then(result => {
      Object.assign(newEvent, {
        ...newEventInit,
      })
      router.push({
        name: 'dashboard-organizer',
      })
    })
  }
</script>

<template>
  <v-container class="event-add-container">
    <!-- Header Section -->
    <PageTitle
      title="Add Event"
    />

    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card
          class="form-card"
          elevation="4"
        >
          <v-card-text class="pa-6">
            <v-form
              ref="form"
              v-model="isFormValid"
              fast-fail
              @submit.prevent="handleAddEvent"
            >
              <v-text-field
                v-model="newEvent.name"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                prepend-inner-icon="mdi-format-title"
                required
                :rounded="rounded"
                :rules="[(v) => !!v || 'Name is required!']"
                :variant="variant"
              >
                <template #label>
                  <span>Event Name</span>
                  <span class="text-error">*</span>
                </template>
              </v-text-field>

              <v-textarea
                v-model="newEvent.description"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                label="Description (optional)"
                prepend-inner-icon="mdi-text-box"
                :rounded="rounded"
                rows="3"
                :variant="variant"
              />

              <v-text-field
                v-model="newEvent.location"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                label="Location (optional)"
                prepend-inner-icon="mdi-map-marker"
                :rounded="rounded"
                :variant="variant"
              />

              <CurrencySelector
                v-model="newEvent.currency"
                label="Currency"
                :required="true"
              />

              <v-text-field
                v-model="newEvent.slug"
                append-inner-icon="mdi-refresh"
                class="mb-4"
                clearable
                :density="density"
                :disabled="!newEvent.name"
                hide-details="auto"
                hint="Custom URL for your event (e.g., 'peaceism-conference-2024'). Leave empty to auto-generate from event name."
                label="URL Slug (optional)"
                persistent-hint
                prepend-inner-icon="mdi-link"
                :rounded="rounded"
                :variant="variant"
                @click:append-inner="newEvent.slug = generateSlug(newEvent.name)"
              />

              <v-date-input
                v-if="newEvent.config.isSingleDayEvent"
                v-model="newEvent.dateRange[0]"
                class="mb-4"
                color="primary"
                hide-details="auto"
                prepend-icon=""
                prepend-inner-icon="mdi-calendar"
                :rounded="rounded"
                :rules="[
                  (v) => !!v || 'Date is required!',
                ]"
                show-adjacent-months
                :variant="variant"
              >
                <template #label>
                  <span>Event Date</span>
                  <span class="text-error">*</span>
                </template>
              </v-date-input>

              <v-date-input
                v-else
                v-model="newEvent.dateRange"
                class="mb-4"
                color="primary"
                hide-details="auto"
                multiple="range"
                prepend-icon=""
                prepend-inner-icon="mdi-calendar"
                :rounded="rounded"
                :rules="[
                  (v) => !!v || 'Date range is required!',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2) ||
                    'Please select both start and end dates',
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2 && v[0] <= v[v.length - 1]) ||
                    'Start date must be before end date',
                ]"
                show-adjacent-months
                :variant="variant"
              >
                <template #label>
                  <span>Event Date</span>
                  <span class="text-error">*</span>
                </template>
              </v-date-input>

              <!-- Time Pickers (only show when not all day) -->
              <v-row v-if="!newEvent.config.isAllDay" class="mb-2">
                <v-col cols="12" md="6">
                  <TimePicker
                    v-model="newEvent.startTime"
                    :density="density"
                    label="Start Time"
                    :rounded="rounded"
                    show-icon
                    :variant="variant"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <TimePicker
                    v-model="newEvent.endTime"
                    :density="density"
                    label="End Time"
                    :rounded="rounded"
                    show-icon
                    :variant="variant"
                  />
                </v-col>
              </v-row>
              <v-row class="mt-n4 mb-2">
                <v-col
                  cols="12"
                  md="6"
                >
                  <v-select
                    v-model="newEvent.taxType"
                    :density="density"
                    hide-details="auto"
                    item-title="text"
                    item-value="value"
                    :items="[
                      { value: 'percent', text: 'Percentage %' },
                      { value: 'fixed', text: 'Fixed amount' },
                    ]"
                    label="Tax Type"
                    prepend-inner-icon="mdi-percent"
                    :rounded="rounded"
                    :variant="variant"
                  />
                </v-col>
                <v-col
                  cols="12"
                  md="6"
                >
                  <v-text-field
                    v-model.number="newEvent.taxAmount"
                    :density="density"
                    hide-details="auto"
                    label="Tax Amount"
                    :prefix="getCurrencySymbol({ code: newEvent.currency || 'XOF', type: 'symbol' })"
                    :rounded="rounded"
                    type="number"
                    :variant="variant"
                  />
                </v-col>
              </v-row>
              <v-file-upload
                accept="image/*"
                class="mt-2 mt-md-4"
                clearable
                density="compact"
                :rounded="rounded"
                show-size
                title="Upload Banner"
                :variant="variant"
                @update:model-value="handleEventBanner"
              />

              <div class="d-flex align-center mt-3 mt-md-4">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-cog"
                  :rounded="rounded"
                  :size="xs ? 'default' : 'large'"
                  variant="outlined"
                  @click="openConfigDialog"
                >
                  Configuration
                </v-btn>
                <v-spacer />
                <v-btn
                  class="ml-1"
                  color="primary"
                  :rounded="rounded"
                  :size="xs ? 'default' : 'large'"
                  type="submit"
                >
                  Create
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Configuration Dialog -->
    <v-dialog
      v-model="configDialog"
      max-width="600"
      persistent
    >
      <v-card class="config-dialog-card" :rounded="rounded" :variant="variant">
        <v-card-title class="text-h5 pa-6 pb-0">
          Event Configuration
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form @submit.prevent="saveConfig">
            <!-- Section: Tickets & Registration -->
            <v-card
              border
              class="mb-6 overflow-hidden"
              elevation="2"
              :rounded="rounded"
              variant="flat"
            >
              <v-card-title class="pa-4 bg-surface-light d-flex align-center">
                <v-icon class="me-3" color="primary" size="24">mdi-ticket-account</v-icon>
                <span class="text-subtitle-1 font-weight-bold">Tickets & Registration</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <v-number-input
                    v-model.number="config.maxTicketsPerRegistration"
                    control-variant="default"
                    :hide-input="false"
                    inset
                    hide-details="auto"
                    label="Max Ticket Purchase Per Registration"
                    prepend-inner-icon="mdi-numeric"
                    :reverse="false"
                    :rounded="rounded"
                    :rules="[(v) => v > 0 || 'Must be greater than 0']"
                    :variant="variant"
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.saveAllAttendeesDetails"
                    color="primary"
                    hide-details="auto"
                    hint="When enabled, you collect details for every seat. When disabled, only the lead attendee information is saved (Bulk Registration)."
                    inset
                    label="Collect Individual Attendee Details"
                    persistent-hint
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.enableOnSiteQuota"
                    class="mb-4"
                    color="primary"
                    hide-details="auto"
                    hint="When enabled, you can reserve a portion of ticket stock for on-site (box office) sales. Online sales will stop once the quota is reached."
                    inset
                    label="Enable On-site Quota Management"
                    persistent-hint
                  />
                  <v-expand-transition>
                    <div v-if="config.enableOnSiteQuota">
                      <div class="d-flex gap-4 mt-4">
                        <v-number-input
                          v-model.number="config.defaultOnSiteQuota"
                          :density="density"
                          hide-details="auto"
                          class="flex-1"
                          label="Default On-site Quota (per ticket)"
                          inset
                          min="0"
                          control-variant="default"
                          prepend-inner-icon="mdi-store-clock"
                          :rounded="rounded"
                          :rules="[(v) => v >= 0 || 'Must be 0 or greater']"
                          :variant="variant"
                        />
                        <v-number-input
                          v-model.number="config.defaultLowStockThreshold"
                          :density="density"
                          hide-details="auto"
                          class="flex-1"
                          label="Default Low Stock Threshold"
                          inset
                          min="0"
                          control-variant="default"
                          prepend-inner-icon="mdi-alert-circle-outline"
                          :rounded="rounded"
                          :rules="[(v) => v >= 0 || 'Must be 0 or greater']"
                          :variant="variant"
                        />
                      </div>
                      <p class="text-caption text-medium-emphasis mt-2">
                        These values will be applied as defaults to new tickets. You can still override them per ticket.
                      </p>
                    </div>
                  </v-expand-transition>
                </div>
              </v-card-text>
            </v-card>

            <!-- Section: Schedule & Timing -->
            <v-card
              border
              class="mb-6 overflow-hidden"
              elevation="2"
              :rounded="rounded"
              variant="flat"
            >
              <v-card-title class="pa-4 bg-surface-light d-flex align-center">
                <v-icon class="me-3" color="primary" size="24">mdi-calendar-clock</v-icon>
                <span class="text-subtitle-1 font-weight-bold">Schedule & Timing</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <v-switch
                    v-model="config.isAllDay"
                    color="primary"
                    hide-details="auto"
                    hint="Enable if this event lasts the entire day (no specific start or end time)."
                    inset
                    label="All Day Event"
                    persistent-hint
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.isSingleDayEvent"
                    color="primary"
                    hide-details="auto"
                    hint="Turn off if this event continues for multiple days."
                    inset
                    label="Single Day Event"
                    persistent-hint
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.showEndTime"
                    class="mb-6"
                    color="primary"
                    hide-details="auto"
                    hint="When enabled, the event end time will be displayed on customer-facing pages."
                    inset
                    label="Show End Time"
                    persistent-hint
                  />
                  <v-divider class="mb-6" />
                  <v-select
                    v-model="config.dateFormat"
                    hint="Choose how dates will be displayed on customer-facing pages"
                    hide-details="auto"
                    :items="dateFormatOptions"
                    label="Date Format"
                    persistent-hint
                    prepend-inner-icon="mdi-calendar"
                    :rounded="rounded"
                    :variant="variant"
                  />
                </div>
              </v-card-text>
            </v-card>

            <!-- Section: Commerce & Logistics -->
            <v-card
              border
              class="mb-6 overflow-hidden"
              elevation="2"
              :rounded="rounded"
              variant="flat"
            >
              <v-card-title class="pa-4 bg-surface-light d-flex align-center">
                <v-icon class="me-3" color="primary" size="24">mdi-store</v-icon>
                <span class="text-subtitle-1 font-weight-bold">Commerce & Logistics</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <v-switch
                    v-model="config.enableMerchandiseShop"
                    color="primary"
                    hide-details="auto"
                    hint="Displays a merchandise section on the event page so attendees can buy goods with their tickets."
                    inset
                    label="Enable Merchandise Shop"
                    persistent-hint
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.disableDelivery"
                    color="primary"
                    hide-details="auto"
                    hint="When enabled, only pickup option will be available during checkout and delivery will be disabled."
                    inset
                    label="Disable Delivery"
                    persistent-hint
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-number-input
                    v-model.number="config.shippingFee"
                    control-variant="default"
                    :hide-input="false"
                    inset
                    label="Shipping Fee"
                    :min="0"
                    hide-details="auto"
                    :prefix="getCurrencySymbol({ code: newEvent.currency || 'USD', type: 'symbol' })"
                    :reverse="false"
                    :rounded="rounded"
                    :rules="[(v) => v >= 0 || 'Must be 0 or greater']"
                    :step="0.01"
                    :variant="variant"
                  />
                </div>
              </v-card-text>
            </v-card>



            <!-- Section: Automated Marketing -->
            <v-card
              border
              class="mb-6 overflow-hidden"
              elevation="2"
              :rounded="rounded"
              variant="flat"
            >
              <v-card-title class="pa-4 bg-surface-light d-flex align-center">
                <v-icon class="me-3" color="primary" size="24">mdi-bullhorn</v-icon>
                <span class="text-subtitle-1 font-weight-bold">Automated Marketing</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <v-switch
                    v-model="config.enableAbandonedCartEmails"
                    color="primary"
                    hide-details="auto"
                    hint="When enabled, automated reminder emails will be sent to users who abandon their cart (expired temp registrations). Emails are sent via cron job every 6-12 hours."
                    inset
                    label="Enable Abandoned Cart Email Reminders"
                    persistent-hint
                  />
                </div>
              </v-card-text>
            </v-card>

            <!-- Section: Payment Gateways -->
            <v-card
              border
              class="mb-6 overflow-hidden"
              elevation="2"
              :rounded="rounded"
              variant="flat"
            >
              <v-card-title class="pa-4 bg-surface-light d-flex align-center">
                <v-icon class="me-3" color="primary" size="24">mdi-credit-card-settings</v-icon>
                <span class="text-subtitle-1 font-weight-bold">Payment Methods</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <p class="text-body-2 text-medium-emphasis mb-4">
                    Select the payment gateways you want to enable for this event.
                  </p>

                  <v-checkbox
                    v-model="config.paymentMethods"
                    class="mb-2"
                    color="primary"
                    hide-details
                    label="Stripe (Credit/Debit Cards, Google Pay, Apple Pay)"
                    value="stripe"
                  >
                    <template #append>
                      <v-img class="ml-2" height="20" src="https://stripe.com/favicon.ico" width="20" />
                    </template>
                  </v-checkbox>

                  <v-checkbox
                    v-model="config.paymentMethods"
                    color="primary"
                    hide-details
                    label="Orange Money (Mobile Money)"
                    value="om"
                  >
                    <template #append>
                      <v-avatar class="ml-2 font-weight-black" color="orange" size="20" style="font-size: 8px">OM</v-avatar>
                    </template>
                  </v-checkbox>

                  <v-alert
                    v-if="config.paymentMethods.length === 0"
                    class="mt-4"
                    density="compact"
                    type="warning"
                    variant="tonal"
                  >
                    You must select at least one payment method for paid tickets.
                  </v-alert>
                </div>
              </v-card-text>
            </v-card>
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            color="secondary"
            :rounded="rounded"
            size="large"
            variant="outlined"
            @click="configDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :rounded="rounded"
            size="large"
            variant="flat"
            @click="saveConfig"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.event-add-container {
  min-height: calc(100vh - 64px);
  padding: 24px;
}

.form-card {
  border-radius: 16px;
  overflow: hidden;
}

.flex-1 {
  flex: 1;
}

/* Configuration Dialog - Increased opacity for better readability */
.config-dialog-card {
  background: rgb(var(--v-theme-surface)) !important;
  opacity: 1 !important;
}

.config-dialog-card .v-card-title,
.config-dialog-card .v-card-text,
.config-dialog-card .v-card-actions {
  opacity: 1 !important;
}

/* Responsive Design */
@media (max-width: 768px) {
  .event-add-container {
    padding: 16px;
  }

  .d-flex.gap-4 {
    flex-direction: column;
    gap: 16px !important;
  }
}
</style>
