<script setup>
  import { reactive, ref, watch } from 'vue'

  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
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
      titleKey: 'organizer.add_event.title',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, variant, density } = useUiProps()
  const { t } = useI18n()
  const router = useRouter()
  const store = useStore()

  // Computed UI Pattern
  const ui = computed(() => ({
    titleKey: 'organizer.add_event.title',
    title: t('pages.organizer.add_event.title'),
    fields: {
      name: t('pages.organizer.add_event.fields.name'),
      description: t('pages.organizer.add_event.fields.description'),
      location: t('pages.organizer.add_event.fields.location'),
      currency: t('pages.organizer.add_event.fields.currency'), // Added below shortly
      slug: t('pages.organizer.add_event.fields.slug'),
      slug_hint: t('pages.organizer.add_event.fields.slug_hint'),
      date: t('pages.organizer.add_event.fields.date'),
      start_time: t('pages.organizer.add_event.fields.start_time'),
      end_time: t('pages.organizer.add_event.fields.end_time'),
      tax_type: t('pages.organizer.add_event.fields.tax_type'),
      tax_amount: t('pages.organizer.add_event.fields.tax_amount'),
      banner: t('pages.organizer.add_event.fields.banner'),
      tax_types: {
        percent: t('pages.organizer.add_event.fields.tax_types.percent'),
        fixed: t('pages.organizer.add_event.fields.tax_types.fixed')
      }
    },
    buttons: {
      config: t('pages.organizer.add_event.buttons.config'),
      create: t('pages.organizer.add_event.buttons.create')
    },
    config_dialog: {
      title: t('pages.organizer.config.title'),
      tickets: t('pages.organizer.config.sections.tickets'),
      max_tickets: t('pages.organizer.config.fields.max_tickets'),
      collect_details: t('pages.organizer.config.fields.unique_qr'), // Re-using unique_qr
      collect_details_hint: t('pages.organizer.config.fields.unique_qr_hint'),
      onsite_quota: t('pages.organizer.config.fields.onsite_quota'),
      onsite_quota_hint: t('pages.organizer.config.fields.onsite_quota_hint'),
      default_quota: t('pages.organizer.config.fields.default_quota'),
      low_stock: t('pages.organizer.config.fields.low_stock'),
      quota_defaults_hint: t('pages.organizer.config.fields.quota_defaults_hint'),
      schedule: t('pages.organizer.config.sections.schedule'),
      all_day: t('pages.organizer.config.fields.all_day'),
      all_day_hint: t('pages.organizer.config.fields.all_day_hint'),
      single_day: t('pages.organizer.config.fields.single_day'),
      single_day_hint: t('pages.organizer.config.fields.single_day_hint'),
      show_end_time: t('pages.organizer.config.fields.show_end_time'),
      show_end_time_hint: t('pages.organizer.config.fields.show_end_time_hint'),
      date_format: t('pages.organizer.config.fields.date_format'),
      date_format_hint: t('pages.organizer.config.fields.date_format_hint'),
      commerce: t('pages.organizer.config.sections.commerce'),
      enable_shop: t('pages.organizer.config.fields.enable_shop'),
      enable_shop_hint: t('pages.organizer.config.fields.enable_shop_hint'),
      disable_delivery: t('pages.organizer.config.fields.disable_delivery'),
      disable_delivery_hint: t('pages.organizer.config.fields.disable_delivery_hint'),
      shipping_fee: t('pages.organizer.config.fields.shipping_fee'),
      marketing: t('pages.organizer.config.sections.marketing'),
      abandoned_cart: t('pages.organizer.config.fields.abandoned_cart'),
      abandoned_cart_hint: t('pages.organizer.config.fields.abandoned_cart_hint'),
      payments: t('pages.organizer.config.sections.payments'),
      payment_methods_desc: t('pages.organizer.config.fields.payment_methods_desc'),
      payment_warning: t('pages.organizer.config.fields.payment_warning'),
      stripe: t('pages.organizer.config.fields.stripe'),
      om: t('pages.organizer.config.fields.om')
    },
    common: {
      save: t('common.save'),
      cancel: t('common.cancel')
    }
  }))

  const newEventInit = reactive({
    ...new Event({
      currency: store.state.systemSettings?.settings?.localization?.defaultCurrency || 'USD',
    }),
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

  import { onMounted } from 'vue'

  onMounted(async () => {
    // Ensure system settings are loaded (loaded in App.vue usually, but just in case)
    if (!store.state.systemSettings?.settings?.localization?.defaultCurrency) {
      await store.dispatch('systemSettings/fetchSettings')
    }
    // Update initial currency if it changed/loaded
    if (store.state.systemSettings?.settings?.localization?.defaultCurrency) {
      const defaultCurrency = store.state.systemSettings.settings.localization.defaultCurrency
      newEventInit.currency = defaultCurrency
      newEvent.currency = defaultCurrency
    }
  })
</script>

<template>
  <v-container class="event-add-container">
    <!-- Header Section -->
    <PageTitle
      :title="ui.title"
      :title-key="ui.titleKey"
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
                :rules="[(v) => !!v || t('rules.required')]"
                :variant="variant"
              >
                <template #label>
                  <span>{{ ui.fields.name }}</span>
                  <span class="text-error">*</span>
                </template>
              </v-text-field>

              <v-textarea
                v-model="newEvent.description"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                :label="ui.fields.description"
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
                :label="ui.fields.location"
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
                :hint="ui.fields.slug_hint"
                :label="ui.fields.slug"
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
                  (v) => !!v || t('rules.required'),
                ]"
                show-adjacent-months
                :variant="variant"
              >
                <template #label>
                  <span>{{ ui.fields.date }}</span>
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
                  (v) => !!v || t('rules.required'),
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2) ||
                    t('rules.select_both_dates'),
                  (v) =>
                    (v && Array.isArray(v) && v.length >= 2 && v[0] <= v[v.length - 1]) ||
                    t('rules.start_before_end'),
                ]"
                show-adjacent-months
                :variant="variant"
              >
                <template #label>
                  <span>{{ ui.fields.date }}</span>
                  <span class="text-error">*</span>
                </template>
              </v-date-input>

              <!-- Time Pickers (only show when not all day) -->
              <v-row v-if="!newEvent.config.isAllDay" class="mb-2">
                <v-col cols="12" md="6">
                  <TimePicker
                    v-model="newEvent.startTime"
                    :density="density"
                    :label="ui.fields.start_time"
                    :rounded="rounded"
                    show-icon
                    :variant="variant"
                  />
                </v-col>
                <v-col cols="12" md="6">
                  <TimePicker
                    v-model="newEvent.endTime"
                    :density="density"
                    :label="ui.fields.end_time"
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
                      { value: 'percent', text: ui.fields.tax_types.percent },
                      { value: 'fixed', text: ui.fields.tax_types.fixed },
                    ]"
                    :label="ui.fields.tax_type"
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
                    :label="ui.fields.tax_amount"
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
                :title="ui.fields.banner"
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
                  {{ ui.buttons.config }}
                </v-btn>
                <v-spacer />
                <v-btn
                  class="ml-1"
                  color="primary"
                  :rounded="rounded"
                  :size="xs ? 'default' : 'large'"
                  type="submit"
                >
                  {{ ui.buttons.create }}
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
          {{ ui.config_dialog.title }}
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
                <span class="text-subtitle-1 font-weight-bold">{{ ui.config_dialog.tickets }}</span>
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
                    :label="ui.config_dialog.max_tickets"
                    prepend-inner-icon="mdi-numeric"
                    :reverse="false"
                    :rounded="rounded"
                    :rules="[(v) => v > 0 || t('rules.must_be_gt_0')]"
                    :variant="variant"
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.saveAllAttendeesDetails"
                    color="primary"
                    hide-details="auto"
                    :hint="ui.config_dialog.collect_details_hint"
                    inset
                    :label="ui.config_dialog.collect_details"
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
                    :hint="ui.config_dialog.onsite_quota_hint"
                    inset
                    :label="ui.config_dialog.onsite_quota"
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
                          :label="ui.config_dialog.default_quota"
                          inset
                          min="0"
                          control-variant="default"
                          prepend-inner-icon="mdi-store-clock"
                          :rounded="rounded"
                          :rules="[(v) => v >= 0 || t('rules.must_be_ge_0')]"
                          :variant="variant"
                        />
                        <v-number-input
                          v-model.number="config.defaultLowStockThreshold"
                          :density="density"
                          hide-details="auto"
                          class="flex-1"
                          :label="ui.config_dialog.low_stock"
                          inset
                          min="0"
                          control-variant="default"
                          prepend-inner-icon="mdi-alert-circle-outline"
                          :rounded="rounded"
                          :rules="[(v) => v >= 0 || t('rules.must_be_ge_0')]"
                          :variant="variant"
                        />
                      </div>
                      <p class="text-caption text-medium-emphasis mt-2">
                        {{ ui.config_dialog.quota_defaults_hint }}
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
                <span class="text-subtitle-1 font-weight-bold">{{ ui.config_dialog.schedule }}</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <v-switch
                    v-model="config.isAllDay"
                    color="primary"
                    hide-details="auto"
                    :hint="ui.config_dialog.all_day_hint"
                    inset
                    :label="ui.config_dialog.all_day"
                    persistent-hint
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.isSingleDayEvent"
                    color="primary"
                    hide-details="auto"
                    :hint="ui.config_dialog.single_day_hint"
                    inset
                    :label="ui.config_dialog.single_day"
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
                    :hint="ui.config_dialog.show_end_time_hint"
                    inset
                    :label="ui.config_dialog.show_end_time"
                    persistent-hint
                  />
                  <v-divider class="mb-6" />
                  <v-select
                    v-model="config.dateFormat"
                    :hint="ui.config_dialog.date_format_hint"
                    hide-details="auto"
                    :items="dateFormatOptions"
                    :label="ui.config_dialog.date_format"
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
                <span class="text-subtitle-1 font-weight-bold">{{ ui.config_dialog.commerce }}</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <v-switch
                    v-model="config.enableMerchandiseShop"
                    color="primary"
                    hide-details="auto"
                    :hint="ui.config_dialog.enable_shop_hint"
                    inset
                    :label="ui.config_dialog.enable_shop"
                    persistent-hint
                  />
                </div>
                <v-divider />
                <div class="pa-4">
                  <v-switch
                    v-model="config.disableDelivery"
                    color="primary"
                    hide-details="auto"
                    :hint="ui.config_dialog.disable_delivery_hint"
                    inset
                    :label="ui.config_dialog.disable_delivery"
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
                    :label="ui.config_dialog.shipping_fee"
                    :min="0"
                    hide-details="auto"
                    :prefix="getCurrencySymbol({ code: newEvent.currency || store.state.systemSettings?.settings?.localization?.defaultCurrency || 'USD', type: 'symbol' })"
                    :reverse="false"
                    :rounded="rounded"
                    :rules="[(v) => v >= 0 || t('rules.must_be_ge_0')]"
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
                <span class="text-subtitle-1 font-weight-bold">{{ ui.config_dialog.marketing }}</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <v-switch
                    v-model="config.enableAbandonedCartEmails"
                    color="primary"
                    hide-details="auto"
                    :hint="ui.config_dialog.abandoned_cart_hint"
                    inset
                    :label="ui.config_dialog.abandoned_cart"
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
                <span class="text-subtitle-1 font-weight-bold">{{ ui.config_dialog.payments }}</span>
              </v-card-title>
              <v-divider />
              <v-card-text class="pa-0">
                <div class="pa-4">
                  <p class="text-body-2 text-medium-emphasis mb-4">
                    {{ ui.config_dialog.payment_methods_desc }}
                  </p>

                  <v-checkbox
                    v-model="config.paymentMethods"
                    class="mb-2"
                    color="primary"
                    hide-details
                    label="Stripe (Credit/Debit Cards, Google Pay, Apple Pay)"
                    :label="ui.config_dialog.stripe"
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
                    :label="ui.config_dialog.om"
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
                    {{ ui.config_dialog.payment_warning }}
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
            {{ ui.common.cancel }}
          </v-btn>
          <v-btn
            color="primary"
            :rounded="rounded"
            size="large"
            variant="flat"
            @click="saveConfig"
          >
            {{ ui.common.save }}
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
