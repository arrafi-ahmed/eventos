<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { EventConfig } from '@/models/EventConfig'
  import { getCurrencySymbol } from '@/utils'

  definePage({
    name: 'event-config',
    meta: {
      layout: 'default',
      title: 'Event Configuration',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, variant, density } = useUiProps()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

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
      title="Event Configuration"
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
              Loading configuration...
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
              <span class="text-h6 font-weight-bold">Tickets & Registration</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-number-input
                v-model.number="config.maxTicketsPerRegistration"
                control-variant="default"
                :hide-input="false"
                inset
                hide-details="auto"
                label="Max Ticket Purchase Per Registration"
                class="mb-6"
                prepend-inner-icon="mdi-numeric"
                :reverse="false"
                :rounded="rounded"
                :rules="[(v) => v > 0 || 'Must be greater than 0']"
                :variant="variant"
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.saveAllAttendeesDetails"
                class="mb-6"
                color="primary"
                hide-details="auto"
                hint="When enabled, each ticket issues a unique QR code. When disabled, one QR code is issued for the entire group (Bulk Registration)."
                inset
                label="Unique QR Code per Ticket"
                persistent-hint
              />
              <v-divider class="mb-6" />
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
            </v-card-text>
          </v-card>

          <!-- Section: Schedule & Timing -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-calendar-clock</v-icon>
              <span class="text-h6 font-weight-bold">Schedule & Timing</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-switch
                v-model="config.isAllDay"
                class="mb-6"
                color="primary"
                hide-details="auto"
                hint="Enable if this event lasts the entire day (no specific start or end time)."
                inset
                label="All Day Event"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.isSingleDayEvent"
                class="mb-6"
                color="primary"
                hide-details="auto"
                hint="Turn off if this event continues for multiple days."
                inset
                label="Single Day Event"
                persistent-hint
              />
              <v-divider class="mb-6" />
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
            </v-card-text>
          </v-card>

          <!-- Section: Commerce & Logistics -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-store</v-icon>
              <span class="text-h6 font-weight-bold">Commerce & Logistics</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-switch
                v-model="config.enableMerchandiseShop"
                class="mb-6"
                color="primary"
                hide-details="auto"
                hint="Displays a merchandise section on the event page so attendees can buy goods with their tickets."
                inset
                label="Enable Merchandise Shop"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-switch
                v-model="config.disableDelivery"
                class="mb-6"
                color="primary"
                hide-details="auto"
                hint="When enabled, only pickup option will be available during checkout and delivery will be disabled."
                inset
                label="Disable Delivery"
                persistent-hint
              />
              <v-divider class="mb-6" />
              <v-number-input
                v-model.number="config.shippingFee"
                control-variant="default"
                :hide-input="false"
                inset
                label="Shipping Fee"
                :min="0"
                hide-details="auto"
                :prefix="getCurrencySymbol({ code: event?.currency || 'XOF', type: 'symbol' })"
                :reverse="false"
                :rounded="rounded"
                :rules="[(v) => v >= 0 || 'Must be 0 or greater']"
                :step="0.01"
                :variant="variant"
              />
            </v-card-text>
          </v-card>

          <!-- Section: Automated Marketing -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-bullhorn</v-icon>
              <span class="text-h6 font-weight-bold">Automated Marketing</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
              <v-switch
                v-model="config.enableAbandonedCartEmails"
                color="primary"
                hide-details="auto"
                hint="When enabled, automated reminder emails will be sent to users who abandon their cart (expired temp registrations). Emails are sent via cron job every 6-12 hours."
                inset
                label="Enable Abandoned Cart Email Reminders"
                persistent-hint
              />
            </v-card-text>
          </v-card>

          <!-- Section: Payment Gateways -->
          <v-card class="mb-6 overflow-hidden" elevation="2" :rounded="rounded">
            <v-card-title class="pa-4 bg-surface d-flex align-center">
              <v-icon class="me-3" color="primary" size="28">mdi-credit-card-settings</v-icon>
              <span class="text-h6 font-weight-bold">Payment Methods</span>
            </v-card-title>
            <v-divider />
            <v-card-text class="pa-6">
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
              Save
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
