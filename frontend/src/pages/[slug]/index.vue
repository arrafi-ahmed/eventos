<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import Phone from '@/components/Phone.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { apiCall, formatEventDateDisplay, getApiPublicImageUrl, getClientPublicImageUrl } from '@/utils'
  import { countries } from '@/utils/country-list'

  definePage({
    name: 'event-landing-slug',
    meta: {
      layout: 'default',
      title: 'Event Registration',
    },
  })

  const { xs } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const store = useStore()
  const router = useRouter()
  const route = useRoute()
  const regForm = ref(null)

  // Event and Organization data - using computed properties for reactive state
  const isLoading = ref(true)
  const event = computed(() => store.state.event.event)

  // Get event ID or slug from route
  const eventSlug = computed(() => route.params.slug || null)

  // Banner URL for responsive image rendering
  const heroBannerUrl = computed(() =>
    event.value?.banner
      ? getApiPublicImageUrl(event.value.banner, 'event-banner')
      : getClientPublicImageUrl('default-event.webp'),
  )

  // Hero subtitle: "{{datetime}} — at {{location}}."
  const eventDateSubtitle = computed(() => {
    const loc = event.value?.location || 'TBA'
    const formattedDate = formatEventDateDisplay({ event: event.value, eventConfig: event.value?.config })
    return `${formattedDate} @ ${loc}.`
  })
  //TODO: reset to null
  const attendeeInit = ref({
    firstName: 'John',
    lastName: 'Doe',
    email: 'raf.utb@gmail.com',
    phone: '+221771234567',
    isPrimary: true,
  })
  const registrationInit = ref({
    organization: 'Org',
    sector: 'Sector',
    expectation: 'Expectation',
    sector: null,
    expectation: null,
  })

  const attendee = reactive({ ...attendeeInit.value })

  const registration = reactive({ additionalFields: { ...registrationInit.value } })

  const isProcessingPayment = ref(false)
  const formPrefilled = ref(false)

  // Phone input configuration
  const phoneInputItem = computed(() => ({
    text: 'Phone Number',
    required: true,
    options: countries,
  }))

  async function submitRegistration () {
    if (regForm.value) {
      const { valid } = await regForm.value.validate()
      if (!valid) {
        store.commit('addSnackbar', { text: 'Please fill in all required fields correctly.', color: 'error' })
        return
      }
    }

    isProcessingPayment.value = true

    try {
      // Capture user timezone - store in dedicated fields
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      const timezoneOffset = new Date().getTimezoneOffset()

      registration.userTimezone = userTimezone
      registration.timezoneOffset = timezoneOffset

      // Ensure we have event and organization data, use defaults if not available
      registration.eventId = event.value?.id || 1

      // Track visitor (save to database)
      if (event.value?.id && attendee.email) {
        try {
          await apiCall.postSilent('/event-visitor/save', {
            eventId: event.value.id,
            firstName: attendee.firstName,
            lastName: attendee.lastName,
            email: attendee.email,
            phone: attendee.phone,
          })
        } catch (error) {
          // Don't block form submission if tracking fails
          console.warn('Failed to track visitor:', error)
        }
      }

      localStorage.setItem('registrationData', JSON.stringify(registration))
      localStorage.setItem('attendeesData', JSON.stringify([attendee]))

      // Redirect to tickets page using Vue Router
      // Only slug-based routing
      if (event.value?.slug) {
        router.push({
          name: 'tickets-slug',
          params: {
            slug: event.value.slug || eventSlug.value,
          },
        })
      } else {
        // No slug available, redirect to homepage
        store.commit('addSnackbar', { text: 'Event information not available. Please try again.', color: 'error' })
      }
    } catch {
      store.commit('addSnackbar', { text: 'Registration failed. Please try again.', color: 'error' })
    } finally {
      isProcessingPayment.value = false
    }
  }

  // Fetch event and organization data
  async function fetchEventData () {
    try {
      isLoading.value = true

      // Try to fetch by slug first if available
      if (eventSlug.value) {
        try {
          await store.dispatch('event/setEventBySlug', { slug: eventSlug.value })
          // Check if event was found
          if (!event.value || !event.value.id) {
            router.push({
              name: 'not-found',
              params: { status: 404, message: 'Event not found!' },
            })
            return
          }
        } catch {
          router.push({
            name: 'not-found',
            params: { status: 404, message: 'Event not found!' },
          })
          return
        }
      }
    } catch {} finally {
      isLoading.value = false
    }
  }

  // Handle phone update from Phone component
  function handlePhoneUpdate ({ formattedPhone }) {
    attendee.phone = formattedPhone
  }

  // Prefill form if attendeesData exists in localStorage
  function prefillFormFromLocalStorage () {
    try {
      const savedAttendeesData = localStorage.getItem('attendeesData')
      const savedRegistrationData = localStorage.getItem('registrationData')
      let hasPrefilled = false

      if (savedAttendeesData) {
        const attendees = JSON.parse(savedAttendeesData)
        if (attendees && attendees.length > 0) {
          // Prefill attendee form with first attendee data
          const firstAttendee = attendees[0]
          Object.assign(attendee, {
            firstName: firstAttendee.firstName || null,
            lastName: firstAttendee.lastName || null,
            email: firstAttendee.email || null,
            phone: firstAttendee.phone || null,
            isPrimary: firstAttendee.isPrimary || true,
          })
          hasPrefilled = true
        }
      }

      if (savedRegistrationData) {
        const registrationData = JSON.parse(savedRegistrationData)

        if (registrationData) {
          // Prefill registration form
          Object.assign(registration, {
            organization: registrationData.organization || null,
            sector: registrationData.sector || null,
            expectation: registrationData.expectation || null,
            additionalFields: {
              ...registrationInit.value,
              ...registrationData.additionalFields,
            },
          })
          hasPrefilled = true
        }
      }
    } catch (error) {
      console.warn('Failed to prefill form from localStorage:', error)
    }
  }

  import { usePaymentResilience } from '@/composables/usePaymentResilience'

  const { checkAndCleanupSession } = usePaymentResilience()

  onMounted(() => {
    prefillFormFromLocalStorage()
    fetchEventData()
    // Perform background check for existing paid sessions and cleanup
    checkAndCleanupSession(eventSlug.value)
  })
</script>

<template>
  <section class="section section-fade">
    <!-- Hero Section with fully visible banner -->

    <v-container class="py-0">
      <div class="hero-wrap mb-4 mb-md-8">
        <div class="hero-media">
          <v-img
            alt="Event Banner"
            class="hero-img rounded"
            :cover="true"
            eager
            :src="heroBannerUrl"
          />
          <div class="hero-overlay-grad" />
          <div class="hero-text-overlay">
            <div class="hero-text-chip">
              <h1 class="hero-title text-left">
                {{ event?.name || 'Event Registration' }}
              </h1>
              <p class="hero-subtitle text-left">
                {{ eventDateSubtitle }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <PageTitle
        :back-route="{ name: 'homepage' }"
        :compact="true"
        :show-back-button="false"
        pos-title="center"
        subtitle="Enter your details to proceed to ticket selection"
        title="Complete Your Registration"
      />

      <div class="maxw-narrow py-8">
        <v-card
          class="registration-form"
          elevation="2"
          :rounded="rounded"
        >
          <v-card-text class="pa-6">
            <!-- Prefilled indicator -->
            <v-alert
              v-if="formPrefilled"
              class="mb-4"
              density="compact"
              type="success"
              variant="tonal"
            >
              <template #prepend>
                <v-icon>mdi-information</v-icon>
              </template>
              Form has been prefilled with your previous data
            </v-alert>

            <v-form
              ref="regForm"
              @submit.prevent="submitRegistration"
            >
              <v-row no-gutters>
                <v-col
                  cols="12"
                  md="6"
                >
                  <v-text-field
                    v-model="attendee.firstName"
                    class="mb-4"
                    :density="density"
                    hide-details="auto"
                    required
                    :rounded="rounded"
                    :rules="[v => !!v || 'First name is required']"
                    :variant="variant"
                  >
                    <template #label>
                      First Name <span class="text-error ml-1">*</span>
                    </template>
                  </v-text-field>
                </v-col>
                <v-col
                  cols="12"
                  md="6"
                >
                  <v-text-field
                    v-model="attendee.lastName"
                    class="mb-4 ml-0 ml-md-2"
                    :density="density"
                    hide-details="auto"
                    required
                    :rounded="rounded"
                    :rules="[v => !!v || 'Last name is required']"
                    :variant="variant"
                  >
                    <template #label>
                      Last Name <span class="text-error ml-1">*</span>
                    </template>
                  </v-text-field>
                </v-col>
              </v-row>

              <v-text-field
                v-model="attendee.email"
                class="mb-4"
                :density="density"
                hide-details="auto"
                required
                :rounded="rounded"
                :rules="[
                  v => !!v || 'Email is required',
                  v => /.+@.+\..+/.test(v) || 'Email must be valid'
                ]"
                type="email"
                :variant="variant"
              >
                <template #label>
                  Email <span class="text-error ml-1">*</span>
                </template>
              </v-text-field>

              <div class="mb-6">
                <Phone
                  v-model="attendee.phone"
                  :density="density"
                  :input-item="phoneInputItem"
                  :variant="variant"
                  @update-phone="handlePhoneUpdate"
                />
              </div>

              <v-alert
                v-if="isLoading"
                class="mb-4"
                type="info"
                variant="tonal"
              >
                Loading event information...
              </v-alert>

              <div class="form-actions">
                <v-btn
                  block
                  class="submit-btn"
                  color="primary"
                  :disabled="isLoading"
                  :loading="isProcessingPayment"
                  :rounded="rounded"
                  :size="size"
                  type="submit"
                >
                  {{ isProcessingPayment ? 'Processing...' : 'Continue' }}
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </div>
    </v-container>

  </section>
</template>

<style scoped>
/* Layout constraints */
.maxw-narrow {
  max-width: 600px;
  margin: 0 auto;
}

/* Hero adjustments */
.hero-section {
  background: rgb(var(--v-theme-surface));
}

.hero-wrap {
  max-width: 1100px;
  margin: 0 auto;
}

.hero-media {
  position: relative;
}

.hero-img {
  width: 100%;
  height: 320px;
  object-fit: contain;
  background: rgb(var(--v-theme-surfaceVariant));
}

.hero-overlay-grad {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.15) 40%, rgba(0, 0, 0, 0) 100%);
  pointer-events: none;
}

.hero-text-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 18px 12px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: flex-start;
}

.hero-title {
  margin: 0;
  font-weight: 700;
}

.hero-subtitle {
  margin: 6px 0 0 0;
  opacity: 0.9;
}

.hero-text-chip {
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  padding: 12px 16px;
  border-radius: 14px;
  max-width: 860px;
  margin: 0 auto;
}

.hero-text-chip .hero-title,
.hero-text-chip .hero-subtitle {
  color: white;
}
</style>
