<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import Phone from '@/components/Phone.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { Attendee } from '@/models/index.js'
  import { countries } from '@/utils/country-list'

  definePage({
    name: 'attendee-form-slug',
    meta: {
      layout: 'default',
      title: 'Attendee Information',
      titleKey: 'pages.tickets.attendee_form',
    },
  })

  const { t } = useI18n()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, size, variant, density } = useUiProps()

  const currentStep = ref(0)
  const isLoading = ref(false)
  const isDataReady = ref(false)
  const attendeeForm = ref(null)
  const isFormValid = ref(true)

  const phoneInputItem = computed(() => ({
    text: 'Phone Number',
    required: true,
    options: countries,
  }))

  const event = computed(() => store.state.event.event)
  const tickets = computed(() => store.state.ticket.tickets || [])
  const eventConfig = computed(() => event.value?.config || {})

  // Default to true (multi-attendee) unless explicitly set to false
  const saveAllAttendeesDetails = computed(() => eventConfig.value?.saveAllAttendeesDetails !== false)
  const selectedTickets = computed(() => JSON.parse(localStorage.getItem('selectedTickets')) || [])
  const attendees = ref([])
  const totalAttendees = computed(() => {
    if (!saveAllAttendeesDetails.value) return 1
    return selectedTickets.value.reduce((sum, ticket) => {
      const quantity = ticket.quantity || 1
      return sum + quantity
    }, 0)
  })

  // Quick lookup for title by id (display-only)
  const ticketsById = computed(() => {
    const map = new Map()
    for (const t of (selectedTickets.value || [])) map.set(t.ticketId, t)
    return map
  })
  const ticketTitleById = id => ticketsById.value.get(id)?.title ?? ''

  // Count how many times a ticketId is already used by previous attendees
  function usedCountBeforeIndex (ticketId, attendees, index) {
    let count = 0
    for (let i = 0; i < index; i++) {
      if (attendees[i]?.ticketId === ticketId) count++
    }
    return count
  }

  // Available options for the current attendee (respecting quantities)
  function getAvailableTicketsForAttendee (attendees, selectedTickets, currentIndex) {
    const options = []
    const currentAttendee = attendees[currentIndex]

    for (const sel of selectedTickets || []) {
      const used = usedCountBeforeIndex(sel.ticketId, attendees, currentIndex)
      const remaining = (sel.quantity || 1) - used

      // Always include the ticket if it's already assigned to this attendee
      const isCurrentAttendeeTicket = currentAttendee && currentAttendee.ticketId === sel.ticketId

      if (remaining > 0 || isCurrentAttendeeTicket) {
        options.push({
          value: sel.ticketId,
          title: sel.title,
        })
      }
    }
    return options.map(o => ({ value: o.value, title: o.title }))
  }

  function handleSelectTicket (ticketId) {
    const attendee = attendees.value[currentStep.value]
    if (!attendee) return
    attendee.ticketId = ticketId
    attendee.title = ticketTitleById(ticketId)
  }

  // Auto-select first available ticket for current attendee if none selected
  function autoSelectFirstAvailableForCurrentStep () {
    const idx = currentStep.value
    const currentAttendee = attendees.value?.[idx]
    if (!currentAttendee) return

    if (!currentAttendee.ticketId) {
      const options = getAvailableTicketsForAttendee(
        attendees.value,
        selectedTickets.value,
        idx,
      )
      if (options.length > 0) {
        handleSelectTicket(options[0].value)
      }
    }
  }

  async function nextStep () {
    if (attendeeForm.value) {
      await attendeeForm.value.validate()
      if (!isFormValid.value) {
        return
      }
    }

    if (currentStep.value < totalAttendees.value - 1) {
      currentStep.value++
      attendees.value[currentStep.value] = new Attendee({ ...attendees.value[currentStep.value] })
      autoSelectFirstAvailableForCurrentStep()
    } else {
      proceedToCheckout()
    }
  }

  function prevStep () {
    if (currentStep.value > 0) {
      currentStep.value--
    }
  }

  async function proceedToCheckout () {
    try {
      isLoading.value = true

      // Prepare attendee data for checkout
      const formattedAttendees = attendees.value.map(attendee => ({
        firstName: attendee.firstName,
        lastName: attendee.lastName,
        email: attendee.email,
        phone: attendee.phone,
        ticketId: attendee.ticketId,
        isPrimary: attendee.isPrimary,
      }))

      if (selectedTickets.value.length === 0) {
        store.commit('addSnackbar', { text: 'No ticket data found. Please return to tickets page.', color: 'error' })
        return
      }

      // Redirect to checkout page
      localStorage.setItem('attendeesData', JSON.stringify(formattedAttendees))
      router.push({
        name: 'checkout-slug',
        params: { slug: route.params.slug },
      })
    } catch {
      store.commit('addSnackbar', { text: 'Failed to proceed to checkout. Please try again.', color: 'error' })
    } finally {
      isLoading.value = false
    }
  }

  function goBack () {
    localStorage.removeItem('selectedTickets.value')

    router.push({
      name: 'tickets-slug',
      params: { slug: route.params.slug },
    })
  }

  // Initialize data and forms when component mounts
  async function fetchData () {
    // Get route params - only slug-based routing
    if (!route.params.slug) {
      return router.push({ name: 'homepage' })
    }

    if (selectedTickets.value.length === 0) {
      store.commit('addSnackbar', { text: 'No ticket data found. Please return to tickets page.', color: 'error' })
      return router.push({
        name: 'tickets-slug',
        params: { slug: route.params.slug },
      })
    }
    attendees.value = [...JSON.parse(localStorage.getItem('attendeesData'))].map(i => ({
      ...i,
      title: null,
    }))

    // Fetch event config by slug to determine saveAllAttendeesDetails
    try {
      await store.dispatch('event/setEventBySlug', { slug: route.params.slug })
    // await $axios.get(`/event/getEventBySlug`, { params: { slug: route.params.slug } })
    } catch {
      // Keep default behavior (multi-attendee) if config fails to load
      eventConfig.value = eventConfig.value || {}
    }
    isDataReady.value = true
    autoSelectFirstAvailableForCurrentStep()
  }

  import { usePaymentResilience } from '@/composables/usePaymentResilience'

  const { checkAndCleanupSession } = usePaymentResilience()

  // Initialize when component mounts
  onMounted(async () => {
    await fetchData()
    // Perform background check for existing paid sessions and cleanup
    checkAndCleanupSession(route.params.slug)
  })

  // Also react when the user navigates between attendees
  watch(currentStep, () => {
    autoSelectFirstAvailableForCurrentStep()
  })
</script>

<template>
  <section class="section section-fade">
    <v-container>
      <PageTitle
        :back-route="{ name: 'tickets-slug', params: { slug: route.params.slug } }"
        :compact="true"
        :show-back-button="true"
        :subtitle="event?.name"
        :title="t('pages.tickets.attendee_form')"
        :title-key="'pages.tickets.attendee_form'"
      />

      <!-- Main Content -->
      <v-row justify="center">
        <v-col
          cols="12"
          md="8"
        >
          <v-card
            v-if="saveAllAttendeesDetails"
            class="mb-6"
            elevation="2"
          >
            <v-card-text class="pa-4">
              <div class="d-flex align-center justify-space-between">
                <span class="text-body-1">
                  Attendee {{ currentStep + 1 }} of {{ totalAttendees }}
                </span>
                <v-progress-linear
                  color="primary"
                  height="8"
                  :model-value="((currentStep + 1) / totalAttendees) * 100"
                  rounded
                />
              </div>
            </v-card-text>
          </v-card>

          <!-- Attendee Form -->
          <v-card v-if="attendees.length > 0" elevation="4">
            <v-card-title class="bg-primary text-white py-2">
              <h3 class="text-h6 font-weight-bold">
                {{ `Attendee ${currentStep + 1}:` }}
              </h3>
            </v-card-title>

            <v-card-text class="pa-6">
              <v-form
                ref="attendeeForm"
                v-model="isFormValid"
                @submit.prevent="nextStep"
              >
                <v-row v-if="saveAllAttendeesDetails">
                  <v-col cols="12">
                    <v-select
                      v-model="attendees[currentStep].ticketId"
                      :density="density"
                      hide-details="auto"
                      item-title="title"
                      item-value="value"
                      :items="
                        getAvailableTicketsForAttendee(attendees, selectedTickets, currentStep)
                      "
                      required
                      :rounded="rounded"
                      :rules="[(v) => !!v || 'Ticket type is required']"
                      :variant="variant"
                      @update:model-value="handleSelectTicket"
                    >
                      <template #label>
                        Ticket Type <span class="text-error ml-1">*</span>
                      </template>
                    </v-select>
                  </v-col>
                </v-row>

                <v-row>
                  <v-col
                    cols="12"
                    sm="6"
                  >
                    <v-text-field
                      v-model="attendees[currentStep].firstName"
                      :density="density"
                      hide-details="auto"
                      required
                      :rounded="rounded"
                      :rules="[
                        (v) => !!v || 'First name is required',
                        (v) => (v && v.length <= 50) || 'Must not exceed 50 characters',
                      ]"
                      :variant="variant"
                    >
                      <template #label>
                        First Name <span class="text-error ml-1">*</span>
                      </template>
                    </v-text-field>
                  </v-col>
                  <v-col
                    cols="12"
                    sm="6"
                  >
                    <v-text-field
                      v-model="attendees[currentStep].lastName"
                      :density="density"
                      hide-details="auto"
                      required
                      :rounded="rounded"
                      :rules="[
                        (v) => !!v || 'Last name is required',
                        (v) => (v && v.length <= 50) || 'Must not exceed 50 characters',
                      ]"
                      :variant="variant"
                    >
                      <template #label>
                        Last Name <span class="text-error ml-1">*</span>
                      </template>
                    </v-text-field>
                  </v-col>
                </v-row>

                <v-row>
                  <v-col
                    cols="12"
                    sm="6"
                  >
                    <v-text-field
                      v-model="attendees[currentStep].email"
                      :density="density"
                      hide-details="auto"
                      required
                      :rounded="rounded"
                      :rules="[
                        (v) => !!v || 'Email is required',
                        (v) => /.+@.+\..+/.test(v) || 'Email must be valid',
                      ]"
                      type="email"
                      :variant="variant"
                    >
                      <template #label>
                        Email <span class="text-error ml-1">*</span>
                      </template>
                    </v-text-field>
                  </v-col>
                  <v-col
                    cols="12"
                    sm="6"
                  >
                    <Phone
                      v-model="attendees[currentStep].phone"
                      :input-item="phoneInputItem"
                    />
                  </v-col>
                </v-row>

                <!-- Removed organization, sector, expectation fields - only essential fields needed -->
              </v-form>
            </v-card-text>

            <v-card-actions class="pa-6 pt-0">
              <v-spacer />
              <v-btn
                v-if="currentStep > 0"
                class="mr-4"
                :rounded="rounded"
                :size="size"
                :variant="variant"
                @click="prevStep"
              >
                Previous
              </v-btn>
              <v-btn
                color="primary"
                :disabled="isLoading"
                :loading="isLoading"
                :rounded="rounded"
                :size="size"
                :variant="variant"
                @click="nextStep"
              >
                {{ currentStep < totalAttendees - 1 ? 'Next Attendee' : 'Complete Registration' }}
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
/* Layout styles are now centralized in @/styles/components.css */
</style>
