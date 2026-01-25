<script setup>
  import { onMounted, ref } from 'vue'

  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'

  definePage({
    name: 'pricing',
    meta: {
      layout: 'default',
      title: 'Donation Page',
    },
  })

  const { xs } = useDisplay()
  const router = useRouter()
  const store = useStore()

  // Registration data from localStorage
  const registrationData = ref({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    organization: '',
    sector: '',
    expectation: '',
    eventId: '',
    organizationId: '',
    eventName: '',
  })

  // Event data
  const eventData = ref(null)
  const isLoading = ref(true)

  async function fetchEventData () {
    try {
      isLoading.value = true

      // Try to get event data from localStorage as fallback
      const storedData = localStorage.getItem('registrationData')
      if (storedData) {
        const data = JSON.parse(storedData)
        eventData.value = {
          id: data.eventId,
          name: data.eventName,
          organizationId: data.organizationId,
        }

        // If we have event data, try to fetch registration from database
        if (data.email && data.eventId) {
          try {
            const dbRegistration = await store.dispatch('registration/getRegistrationByEmail', {
              email: data.email,
              eventId: data.eventId,
            })

            if (dbRegistration) {
              // Use database registration data instead of localStorage
              const regData = dbRegistration.registration_data || {}
              registrationData.value = {
                ...registrationData.value,
                firstName: regData.name?.split(' ')[0] || data.firstName,
                lastName: regData.name?.split(' ').slice(1).join(' ') || data.lastName,
                email: regData.email || data.email,
                phone: regData.phone || data.phone,
                organization: regData.organization || data.organization,
                sector: regData.sector || data.sector,
                expectation: regData.expectation || data.expectation,
              }
            }
          } catch {}
        }
      }
    } catch {
      store.commit('addSnackbar', { text: 'Failed to load event information.', color: 'error' })
    } finally {
      isLoading.value = false
    }
  }

  function proceedToTickets () {
    if (!registrationData.value.slug) {
      store.commit('addSnackbar', { text: 'Event information not found. Please register first.', color: 'error' })
      router.push({
        name: 'homepage',
      })
      return
    }

    // Redirect to tickets page using slug-based routing
    router.push({
      name: 'tickets-slug',
      params: {
        slug: registrationData.value.slug,
      },
    })
  }

  function goBack () {
    router.push({
      name: 'event-landing-slug',
      params: {
        slug: registrationData.value.slug,
      },
    })
  }

  onMounted(async () => {
    // Try to get registration data from localStorage as fallback
    const storedData = localStorage.getItem('registrationData')
    const sponsorshipData = localStorage.getItem('sponsorshipData')

    if (storedData) {
      const parsedData = JSON.parse(storedData)
      registrationData.value = { ...registrationData.value, ...parsedData }

      // If we have event data, try to fetch registration from database
      if (parsedData.email && parsedData.eventId) {
        try {
          const dbRegistration = await store.dispatch('registration/getRegistrationByEmail', {
            email: parsedData.email,
            eventId: parsedData.eventId,
          })

          if (dbRegistration) {
            // Use database registration data instead of localStorage
            const regData = dbRegistration.registration_data || {}
            registrationData.value = {
              ...registrationData.value,
              firstName: regData.name?.split(' ')[0] || parsedData.firstName,
              lastName: regData.name?.split(' ').slice(1).join(' ') || parsedData.lastName,
              email: regData.email || parsedData.email,
              phone: regData.phone || parsedData.phone,
              organization: regData.organization || parsedData.organization,
              sector: regData.sector || parsedData.sector,
              expectation: regData.expectation || parsedData.expectation,
            }
          }
        } catch {}
      }
    } else if (sponsorshipData) {
      // Handle direct sponsorship without registration
      const sponsorship = JSON.parse(sponsorshipData)
      registrationData.value = {
        ...registrationData.value,
        eventId: sponsorship.eventId,
        organizationId: sponsorship.organizationId,
        eventName: sponsorship.eventName,
        // For direct sponsorship, we'll need to collect sponsor info in the form
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        organization: '',
      }
    } else {
      // If no data, redirect back to landing page
      store.commit('addSnackbar', {
        text: 'No registration or sponsorship data found. Please register first.',
        color: 'error',
      })
      router.push({ name: 'landing' })
    }

    // Fetch event data
    await fetchEventData()
  })
</script>

<template>
  <!-- Hero Section -->
  <section class="hero-section">
    <div class="hero-bg">
      <div class="hero-overlay" />
      <v-container class="fill-height d-flex flex-column justify-center align-center text-center">
        <div class="hero-content-vertical-center">
          <transition name="fade-slide">
            <div>
              <h1 class="display-2 font-weight-bold mb-4 text-white text-shadow">
                Registration Complete
              </h1>
              <p class="headline mb-8 text-white text-shadow">
                Thank you for registering! You can now proceed to view and purchase tickets for this
                event.
              </p>
              <div
                v-if="registrationData && registrationData.firstName"
                class="text-white text-shadow"
              >
                <p class="text-h6">
                  Registration for: {{ registrationData.firstName }} {{ registrationData.lastName }}
                </p>
                <p class="text-subtitle-1">
                  {{ registrationData.organization }}
                </p>
              </div>
            </div>
          </transition>
        </div>
      </v-container>
    </div>
  </section>

  <!-- Registration Confirmation Section -->
  <section class="section section-fade">
    <v-container>
      <v-row justify="center">
        <v-col
          cols="12"
          md="6"
          sm="8"
        >
          <v-card
            class="mx-auto"
            elevation="4"
          >
            <v-card-title class="text-center bg-primary text-white py-6">
              <h2 class="text-h4 font-weight-bold">
                Registration Complete!
              </h2>
            </v-card-title>
            <v-card-text class="pa-6">
              <div class="text-center">
                <v-icon
                  class="mb-4"
                  color="success"
                  size="64"
                >
                  mdi-check-circle
                </v-icon>
                <h3 class="text-h5 mb-4">
                  Thank you for registering!
                </h3>
                <p class="text-body-1 mb-6">
                  Your registration has been successfully completed. You can now proceed to view and
                  purchase tickets for this event.
                </p>

                <div
                  v-if="registrationData && registrationData.firstName"
                  class="mb-6"
                >
                  <v-divider class="my-4" />
                  <h4 class="text-h6 mb-2">
                    Registration Details:
                  </h4>
                  <p class="text-body-2">
                    <strong>Name:</strong>
                    {{ registrationData.firstName }} {{ registrationData.lastName }}
                    <br>
                    <strong>Email:</strong>
                    {{ registrationData.email }}
                    <br>
                    <strong>Organization:</strong>
                    {{ registrationData.organization || 'Not specified' }}
                  </p>
                </div>

                <v-btn
                  class="elevation-4 px-8"
                  color="primary"
                  :loading="isLoading"
                  size="large"
                  @click="proceedToTickets"
                >
                  {{ isLoading ? 'Loading...' : 'View Event Tickets' }}
                </v-btn>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </section>
</template>

<style scoped>
.hero-section {
  position: relative;
  min-height: 60vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, var(--v-theme-primary) 0%, var(--v-theme-accent) 100%);
  z-index: 1;
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(30, 60, 114, 0.35);
  z-index: 2;
}

.hero-section .v-container {
  position: relative;
  z-index: 3;
  min-height: 60vh;
}

/* Layout and utility styles are now centralized in @/styles/components.css */

/* Match landing page typography */
h1 {
  font-size: 2.5rem !important;
  font-weight: 700 !important;
  margin-bottom: 1rem !important;
}

.v-card-title {
  font-size: 1.45rem !important;
}

.v-card-text {
  font-size: 1.1rem !important;
}
</style>
