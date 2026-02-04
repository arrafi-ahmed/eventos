<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { EventConfig } from '@/models/EventConfig'
  import { getCurrencySymbol } from '@/utils'

  definePage({
    name: 'event-config',
    meta: {
      layout: 'default',
      title: 'Event Configuration',
      titleKey: 'organizer.config.title',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, variant, density } = useUiProps()
  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  // Computed UI Pattern
  const ui = computed(() => ({
    titleKey: 'organizer.config.title',
    title: t('pages.organizer.config.title'),
    loading: t('pages.organizer.config.loading'),
    sections: {
      tickets: t('pages.organizer.config.sections.tickets'),
      schedule: t('pages.organizer.config.sections.schedule'),
      commerce: t('pages.organizer.config.sections.commerce'),
      marketing: t('pages.organizer.config.sections.marketing'),
      payments: t('pages.organizer.config.sections.payments')
    },
    fields: {
      max_tickets: t('pages.organizer.config.fields.max_tickets'),
      unique_qr: t('pages.organizer.config.fields.unique_qr'),
      unique_qr_hint: t('pages.organizer.config.fields.unique_qr_hint'),
      onsite_quota: t('pages.organizer.config.fields.onsite_quota'),
      onsite_quota_hint: t('pages.organizer.config.fields.onsite_quota_hint'),
      default_quota: t('pages.organizer.config.fields.default_quota'),
      low_stock: t('pages.organizer.config.fields.low_stock'),
      quota_defaults_hint: t('pages.organizer.config.fields.quota_defaults_hint'),
      all_day: t('pages.organizer.config.fields.all_day'),
      all_day_hint: t('pages.organizer.config.fields.all_day_hint'),
      single_day: t('pages.organizer.config.fields.single_day'),
      single_day_hint: t('pages.organizer.config.fields.single_day_hint'),
      show_end_time: t('pages.organizer.config.fields.show_end_time'),
      show_end_time_hint: t('pages.organizer.config.fields.show_end_time_hint'),
      date_format: t('pages.organizer.config.fields.date_format'),
      date_format_hint: t('pages.organizer.config.fields.date_format_hint'),
      enable_shop: t('pages.organizer.config.fields.enable_shop'),
      enable_shop_hint: t('pages.organizer.config.fields.enable_shop_hint'),
      disable_delivery: t('pages.organizer.config.fields.disable_delivery'),
      disable_delivery_hint: t('pages.organizer.config.fields.disable_delivery_hint'),
      shipping_fee: t('pages.organizer.config.fields.shipping_fee'),
      abandoned_cart: t('pages.organizer.config.fields.abandoned_cart'),
      abandoned_cart_hint: t('pages.organizer.config.fields.abandoned_cart_hint'),
      payment_methods_desc: t('pages.organizer.config.fields.payment_methods_desc'),
      payment_warning: t('pages.organizer.config.fields.payment_warning'),
      stripe: t('pages.organizer.config.fields.stripe'),
      om: t('pages.organizer.config.fields.om')
    },
    save: t('common.save')
  }))

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const prefetchedEvent = computed(() => store.getters['event/getEventById'](route.params.eventId))
  const event = computed(() =>
    prefetchedEvent.value?.id ? prefetchedEvent.value : store.state.event.event,
  )

  const config = reactive({ ...new EventConfig() })

  const dateFormatOptions = [
    { title: 'MM/DD/YYYY HH:mm (12/25/2024 14:30)', value: 'MM/DD/YYYY HH:mm' },
    { title: 'MM/DD/YYYY (12/25/2024)', value: 'MM/DD/YYYY' },
    { title: 'DD/MM/YYYY (25/12/2024)', value: 'DD/MM/YYYY' },
    { title: 'YYYY-MM-DD (2024-12-25)', value: 'YYYY-MM-DD' },
    { title: 'MMM DD, YYYY (Dec 25, 2024)', value: 'MMM DD, YYYY' },
    { title: 'MMMM DD, YYYY (December 25, 2024)', value: 'MMMM DD, YYYY' },
    { title: 'DD MMM YYYY (25 Dec 2024)', value: 'DD MMM YYYY' },
  ]

  const form = ref(null)
  const isFormValid = ref(true)
  const isLoading = ref(true)
  const isSaving = ref(false)

  async function handleSubmitConfig () {
    await form.value.validate()
    if (!isFormValid.value) return

    isSaving.value = true

    try {
      // Save config including all fields
      await store.dispatch('event/saveConfig', { config: config, eventId: event.value.id })

      // Show success message or redirect
      router.push({
        name: 'event-edit',
        params: { eventId: route.params.eventId },
      })
    } catch (error) {
      console.error('Error saving configuration:', error)
    } finally {
      isSaving.value = false
    }
  }

  async function fetchData () {
    if (!event.value?.id) {
      try {
        await store.dispatch('event/setEvent', {
          eventId: route.params.eventId,
        })
      } catch (error) {
        console.error('Error fetching event data:', error)
        throw error
      }
    }
  }

  onMounted(async () => {
    try {
      await fetchData()

      if (event.value?.id) {
        Object.assign(config, new EventConfig({ ...event.value.config }))
      } else {
        console.error('Event not found:', route.params.eventId)
        router.push({ name: 'dashboard-organizer' })
        return
      }
    } catch (error) {
      console.error('Error loading event:', error)
      router.push({ name: 'dashboard-organizer' })
      return
    } finally {
      isLoading.value = false
    }
  })
</script>

<template>
  <v-container class="event-config-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      :title="ui.title"
      :title-key="ui.titleKey"
    />

    <v-row v-if="isLoading" justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card
          class="form-card"
          elevation="4"
          :rounded="rounded"
        >
          <v-card-text class="pa-6 text-center">
            <v-progress-circular
              color="primary"
              indeterminate
              size="64"
            />
            <p class="mt-4 text-body-1">
              {{ ui.loading }}
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-form
          ref="form"
          v-model="isFormValid"
          fast-fail
          @submit.prevent="handleSubmitConfig"
        >
          <!-- Section: Tickets & Registration -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-ticket-account</v-icon>
              <span class="text-h6 font-weight-bold">{{ ui.sections.tickets }}</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-number-input
                v-model.number="config.maxTicketsPerRegistration"
                control-variant="default"
                :hide-input="false"
                inset
                hide-details="auto"
                :label="ui.fields.max_tickets"
                class="mb-6"
                prepend-inner-icon="mdi-numeric"
                :reverse="false"
                :rounded="rounded"
                :rules="[(v) => v > 0 || t('rules.must_be_gt_0')]"
                :variant="variant"
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.saveAllAttendeesDetails"
                class="mb-6"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.unique_qr_hint"
                inset
                :label="ui.fields.unique_qr"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.enableOnSiteQuota"
                class="mb-4"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.onsite_quota_hint"
                inset
                :label="ui.fields.onsite_quota"
                persistent-hint
              />
              <v-expand-transition>
                <div v-if="config.enableOnSiteQuota">
                  <v-row class="mt-2">
                    <v-col cols="12" sm="6">
                      <v-number-input
                        v-model.number="config.defaultOnSiteQuota"
                        :density="density"
                        hide-details="auto"
                        :label="ui.fields.default_quota"
                        inset
                        min="0"
                        control-variant="default"
                        prepend-inner-icon="mdi-store-clock"
                        :rounded="rounded"
                        :rules="[(v) => v >= 0 || t('rules.must_be_ge_0')]"
                        :variant="variant"
                      />
                    </v-col>
                    <v-col cols="12" sm="6">
                      <v-number-input
                        v-model.number="config.defaultLowStockThreshold"
                        :density="density"
                        hide-details="auto"
                        :label="ui.fields.low_stock"
                        inset
                        min="0"
                        control-variant="default"
                        prepend-inner-icon="mdi-alert-circle-outline"
                        :rounded="rounded"
                        :rules="[(v) => v >= 0 || t('rules.must_be_ge_0')]"
                        :variant="variant"
                      />
                    </v-col>
                  </v-row>
                  <p class="text-caption text-medium-emphasis mt-2">
                    {{ ui.fields.quota_defaults_hint }}
                  </p>
                </div>
              </v-expand-transition>
            </v-card-text>
          </v-card>

          <!-- Section: Schedule & Timing -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-calendar-clock</v-icon>
              <span class="text-h6 font-weight-bold">{{ ui.sections.schedule }}</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-switch
                v-model="config.isAllDay"
                class="mb-6"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.all_day_hint"
                inset
                :label="ui.fields.all_day"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.isSingleDayEvent"
                class="mb-6"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.single_day_hint"
                inset
                :label="ui.fields.single_day"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.showEndTime"
                class="mb-6"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.show_end_time_hint"
                inset
                :label="ui.fields.show_end_time"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-select
                v-model="config.dateFormat"
                :hint="ui.fields.date_format_hint"
                hide-details="auto"
                :items="dateFormatOptions"
                :label="ui.fields.date_format"
                persistent-hint
                prepend-inner-icon="mdi-calendar"
                :rounded="rounded"
                :variant="variant"
              />
            </v-card-text>
          </v-card>

          <!-- Section: Commerce & Logistics -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-store</v-icon>
              <span class="text-h6 font-weight-bold">{{ ui.sections.commerce }}</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-switch
                v-model="config.enableMerchandiseShop"
                class="mb-6"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.enable_shop_hint"
                inset
                :label="ui.fields.enable_shop"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.disableDelivery"
                class="mb-6"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.disable_delivery_hint"
                inset
                :label="ui.fields.disable_delivery"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-number-input
                v-model.number="config.shippingFee"
                control-variant="default"
                :hide-input="false"
                inset
                :label="ui.fields.shipping_fee"
                :min="0"
                hide-details="auto"
                :prefix="getCurrencySymbol({ code: event?.currency || 'XOF', type: 'symbol' })"
                :reverse="false"
                :rounded="rounded"
                :rules="[(v) => v >= 0 || t('rules.must_be_ge_0')]"
                :step="0.01"
                :variant="variant"
              />
            </v-card-text>
          </v-card>

          <!-- Section: Automated Marketing -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-bullhorn</v-icon>
              <span class="text-h6 font-weight-bold">{{ ui.sections.marketing }}</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-switch
                v-model="config.enableAbandonedCartEmails"
                color="primary"
                hide-details="auto"
                :hint="ui.fields.abandoned_cart_hint"
                inset
                :label="ui.fields.abandoned_cart"
                persistent-hint
              />
            </v-card-text>
          </v-card>

          <!-- Section: Payment Gateways -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-credit-card-settings</v-icon>
              <span class="text-h6 font-weight-bold">{{ ui.sections.payments }}</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
               <p class="text-body-2 text-medium-emphasis mb-4">
                {{ ui.fields.payment_methods_desc }}
              </p>

              <v-checkbox
                v-model="config.paymentMethods"
                class="mb-2"
                color="primary"
                hide-details
                label="Stripe (Credit/Debit Cards, Google Pay, Apple Pay)"
                :label="ui.fields.stripe"
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
                :label="ui.fields.om"
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
                {{ ui.fields.payment_warning }}
              </v-alert>
            </v-card-text>
          </v-card>

          <!-- Footer Actions -->
          <div class="d-flex align-center mt-8 pb-12">
            <v-spacer />
            <v-btn
              color="primary"
              :disabled="isSaving"
              elevation="4"
              :loading="isSaving"
              :rounded="rounded"
              :size="xs ? 'default' : 'large'"
              type="submit"
            >
              {{ ui.save }}
            </v-btn>
          </div>
        </v-form>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.event-config-container {
  max-width: 1200px;
}

.form-card {
  border-radius: 12px;
}
</style>
