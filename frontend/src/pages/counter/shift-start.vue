<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { getCurrencySymbol } from '@/utils'

  definePage({
    name: 'counter-shift-start',
    meta: {
      layout: 'default',
      title: 'Start Shift',
      titleKey: 'pages.counter.shift_start.title',
      requiresAuth: true,
      requiresCashier: true,
    },
  })

  const { rounded, density, variant } = useUiProps()
  const { t } = useI18n()
  const store = useStore()
  const router = useRouter()
  const route = useRoute()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const organizationId = computed(() => currentUser.value?.organizationId)

  const events = ref([])
  const ticketCounters = ref([])
  const loading = ref(false)
  const submitting = ref(false)

  const form = ref(null)
  const isFormValid = ref(true)

  const shiftData = ref({
    eventId: null,
    ticketCounterId: null,
    openingCash: 0,
  })

  const selectedEvent = computed(() => events.value.find(e => e.id === shiftData.value.eventId))
  const currencyCode = computed(() => {
    return (selectedEvent.value?.currency || store.state.systemSettings?.settings?.localization?.defaultCurrency || 'XOF').toUpperCase()
  })

  async function handleStartShift () {
    await form.value.validate()
    if (!isFormValid.value) return

    submitting.value = true
    store
      .dispatch('counter/startSession', {
        eventId: shiftData.value.eventId,
        ticketCounterId: shiftData.value.ticketCounterId,
        openingCash: shiftData.value.openingCash * 100, // Convert to cents
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(() => {
        router.push({ name: 'counter-pos' })
      })
      .finally(() => {
        submitting.value = false
      })
  }

  function loadData () {
    loading.value = true

    // Load events assigned to this cashier
    const eventsPromise = store.dispatch('event/setAssignedEvents', { role: 50 })

    // Load ticket counters for the organization
    const countersPromise = store.dispatch('ticketCounter/setTicketCounters', {
      organizationId: organizationId.value,
    })

    Promise.all([eventsPromise, countersPromise])
      .then(([fetchedEvents, fetchedCounters]) => {
        events.value = fetchedEvents || []
        ticketCounters.value = fetchedCounters.filter(c => c.isActive) || []

        // 1. Select event from query param if provided
        if (route.query.eventId) {
          shiftData.value.eventId = parseInt(route.query.eventId)
        }
        // 2. Otherwise select first event if only one available
        else if (events.value.length === 1) {
          shiftData.value.eventId = events.value[0].id
        }

        // 3. Auto-select ticket counter if only one available
        if (ticketCounters.value.length === 1) {
          shiftData.value.ticketCounterId = ticketCounters.value[0].id
        }
      })
      .catch(error => {
        console.error('Error loading shift data:', error)
      // Optional: Add snackbar or user notification here if needed
      })
      .finally(() => {
        loading.value = false
      })
  }

  onMounted(() => {
    // Check if there's already an active session
    store.dispatch('counter/setActiveSession').then(session => {
      if (session) {
        router.push({ name: 'counter-pos' })
      } else {
        loadData()
      }
    })
  })
</script>

<template>
  <v-container>
    <PageTitle
      :subtitle="t('pages.counter.shift_start.subtitle')"
      :title="t('pages.counter.shift_start.title')"
      :title-key="'pages.counter.shift_start.title'"
    />

    <v-row justify="center">
      <v-col cols="12" lg="5" md="6">
        <v-card class="mt-4" elevation="2" :loading="loading" :rounded="rounded">
          <v-card-text class="pa-6">
            <v-form ref="form" v-model="isFormValid" @submit.prevent="handleStartShift">
              <v-select
                v-model="shiftData.eventId"
                :density="density"
                item-title="name"
                item-value="id"
                :items="events"
                :label="t('pages.counter.shift_start.event_label')"
                :loading="loading"
                prepend-inner-icon="mdi-calendar"
                required
                :rounded="rounded"
                :rules="[v => !!v || t('pages.counter.shift_start.event_req')]"
                :variant="variant"
              />

              <v-select
                v-model="shiftData.ticketCounterId"
                :density="density"
                item-title="name"
                item-value="id"
                :items="ticketCounters"
                :label="t('pages.counter.shift_start.counter_label')"
                :loading="loading"
                prepend-inner-icon="mdi-store"
                required
                :rounded="rounded"
                :rules="[v => !!v || t('pages.counter.shift_start.counter_req')]"
                :variant="variant"
              />

              <v-text-field
                v-model.number="shiftData.openingCash"
                :density="density"
                :label="t('pages.counter.shift_start.opening_label')"
                :prefix="currencyCode"
                prepend-inner-icon="mdi-cash-multiple"
                required
                :rounded="rounded"
                :rules="[
                  v => v !== null && v !== undefined || t('pages.counter.shift_start.opening_req'),
                  v => v >= 0 || t('pages.counter.shift_start.opening_neg')
                ]"
                type="number"
                :variant="variant"
              />

              <v-btn
                block
                class="mt-6"
                color="primary"
                :disabled="loading"
                :loading="submitting"
                :rounded="rounded"
                size="large"
                type="submit"
                variant="flat"
              >
                {{ t('pages.counter.shift_start.start_btn') }}
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
