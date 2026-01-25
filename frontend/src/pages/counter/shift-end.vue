<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatPrice, getCurrencySymbol } from '@/utils'

  definePage({
    name: 'counter-shift-end',
    meta: {
      layout: 'default',
      title: 'End Shift',
      requiresAuth: true,
      requiresCashier: true,
    },
  })

  const { rounded, density, variant } = useUiProps()
  const store = useStore()
  const router = useRouter()

  const activeSession = computed(() => store.state.counter.activeSession)
  const event = computed(() => store.state.event.event)

  const loading = ref(false)
  const submitting = ref(false)
  const stats = ref(null)

  const form = ref(null)
  const isFormValid = ref(true)

  const closingData = ref({
    closingCash: 0,
    notes: '',
  })

  const currencyCode = computed(() => {
    return (event.value?.currency || 'USD').toUpperCase()
  })

  const discrepancy = computed(() => {
    if (!stats.value) return 0
    return (closingData.value.closingCash * 100) - stats.value.expectedCash
  })

  async function handleEndShift () {
    await form.value.validate()
    if (!isFormValid.value) return

    submitting.value = true
    store
      .dispatch('counter/closeSession', {
        sessionId: activeSession.value.id,
        closingCash: closingData.value.closingCash * 100, // Convert to cents
        notes: closingData.value.notes,
      })
      .then(() => {
        router.push({ name: 'counter-shift-start' })
      })
      .finally(() => {
        submitting.value = false
      })
  }

  function loadStats () {
    if (!activeSession.value) return

    loading.value = true
    store
      .dispatch('counter/fetchSessionStats', activeSession.value.id)
      .then(data => {
        stats.value = data
        closingData.value.closingCash = data.expectedCash / 100
      })
      .finally(() => {
        loading.value = false
      })
  }

  onMounted(() => {
    store.dispatch('counter/setActiveSession').then(session => {
      if (session) {
        loadStats()
        // Ensure event data is loaded and matches the session
        if (!event.value || !event.value.id || event.value.id !== session.eventId) {
          store.dispatch('event/setEventByEventIdnOrganizationId', {
            eventId: session.eventId,
            organizationId: session.organizationId,
          })
        }
      } else {
        router.push({ name: 'counter-shift-start' })
      }
    })
  })
</script>

<template>
  <v-container>
    <PageTitle
      subtitle="Reconcile your cash balance and close the session"
      title="End Shift"
    />

    <v-row justify="center">
      <v-col cols="12" lg="6" md="8">
        <v-card class="mt-4" elevation="2" :loading="loading" :rounded="rounded">
          <v-card-text class="pa-6">
            <v-alert
              v-if="stats"
              class="mb-6"
              color="info"
              icon="mdi-information"
              variant="tonal"
            >
              <div class="d-flex justify-space-between mb-1">
                <span>Opening Cash:</span>
                <span class="font-weight-bold">{{ formatPrice(stats.openingCash, event?.currency) }}</span>
              </div>
              <div class="d-flex justify-space-between mb-1">
                <span>Cash Sales:</span>
                <span class="font-weight-bold">{{ formatPrice(stats.cashSales, event?.currency) }}</span>
              </div>
              <v-divider class="my-2" />
              <div class="d-flex justify-space-between">
                <span>Expected Cash Total:</span>
                <span class="font-weight-bold text-h6">{{ formatPrice(stats.expectedCash, event?.currency) }}</span>
              </div>
            </v-alert>

            <v-form ref="form" v-model="isFormValid" @submit.prevent="handleEndShift">
              <v-text-field
                v-model.number="closingData.closingCash"
                :density="density"
                label="Actual Closing Cash Balance"
                :prefix="currencyCode"
                prepend-inner-icon="mdi-cash-check"
                required
                :rounded="rounded"
                :rules="[
                  v => v !== null && v !== undefined || 'Closing cash is required',
                  v => v >= 0 || 'Closing cash cannot be negative'
                ]"
                type="number"
                :variant="variant"
              />

              <div v-if="stats" class="mb-6 px-4">
                <div class="d-flex justify-space-between align-center">
                  <span class="text-body-2">Discrepancy:</span>
                  <span
                    class="font-weight-bold"
                    :class="discrepancy === 0 ? 'text-success' : 'text-error'"
                  >
                    {{ formatPrice(discrepancy, event?.currency) }}
                  </span>
                </div>
              </div>

              <v-textarea
                v-model="closingData.notes"
                :density="density"
                label="Shift Notes (Optional)"
                placeholder="Any issues or remarks about the shift..."
                prepend-inner-icon="mdi-note-text-outline"
                :rounded="rounded"
                rows="3"
                :variant="variant"
              />

              <v-row class="mt-0">
                <v-col cols="6">
                  <v-btn
                    block
                    color="secondary"
                    :disabled="loading"
                    :rounded="rounded"
                    variant="outlined"
                    @click="router.push({ name: 'counter-pos' })"
                  >
                    Back to POS
                  </v-btn>
                </v-col>
                <v-col cols="6">
                  <v-btn
                    block
                    color="error"
                    :disabled="loading"
                    :loading="submitting"
                    :rounded="rounded"
                    type="submit"
                    variant="flat"
                  >
                    End Session
                  </v-btn>
                </v-col>
              </v-row>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.gap-4 {
  gap: 16px;
}
</style>
