<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'event-landing-config',
    meta: {
      layout: 'default',
      title: 'Landing Page Configuration',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const prefetchedEvent = computed(() => store.getters['event/getEventById'](route.params.eventId))
  const event = computed(() =>
    prefetchedEvent.value?.id ? prefetchedEvent.value : store.state.event.event,
  )

  const landingConfigInit = {
    id: null,
    enableLandingPage: false,
    heroTitle: '',
    heroSubtitle: '',
    overviewTitle: '',
    overviewDescription: '',
    customCSS: '',
    customJS: '',
  }

  const landingConfig = reactive({ ...landingConfigInit })

  const form = ref(null)
  const isFormValid = ref(true)
  const isLoading = ref(true)
  const isSaving = ref(false)

  async function handleSubmitLandingConfig () {
    await form.value.validate()
    if (!isFormValid.value) return

    isSaving.value = true

    try {
      const formData = new FormData()
      formData.append('id', landingConfig.id)
      formData.append('enableLandingPage', landingConfig.enableLandingPage)
      formData.append('heroTitle', landingConfig.heroTitle)
      formData.append('heroSubtitle', landingConfig.heroSubtitle)
      formData.append('overviewTitle', landingConfig.overviewTitle)
      formData.append('overviewDescription', landingConfig.overviewDescription)
      formData.append('customCSS', landingConfig.customCSS)
      formData.append('customJS', landingConfig.customJS)

      await store.dispatch('event/saveLandingConfig', formData)

      // Show success message or redirect
      router.push({
        name: 'event-config',
        params: { eventId: route.params.eventId },
      })
    } catch (error) {
      console.error('Error saving landing configuration:', error)
    } finally {
      isSaving.value = false
    }
  }

  async function fetchData () {
    if (!event.value?.id && route.params.eventId) {
      try {
        await store.dispatch('event/setEventByEventIdnOrganizationId', {
          eventId: route.params.eventId,
          organizationId: currentUser.value?.organizationId,
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

      if (event.value && event.value.id) {
        Object.assign(landingConfig, {
          id: event.value.id,
          ...event.value.landingConfig,
        })
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
  <v-container class="event-landing-config-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Landing Page Configuration"
    />

    <v-row v-if="isLoading" justify="center">
      <v-col
        cols="12"
        lg="10"
        xl="8"
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
              Loading landing page configuration...
            </p>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else justify="center">
      <v-col
        cols="12"
        lg="10"
        xl="8"
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
              @submit.prevent="handleSubmitLandingConfig"
            >
              <!-- Landing Page Toggle -->
              <v-card-title class="text-h6 pa-0 mb-4">
                <v-icon class="me-2">mdi-web</v-icon>
                Landing Page Settings
              </v-card-title>

              <v-row class="mb-6">
                <v-col
                  cols="12"
                >
                  <v-switch
                    v-model="landingConfig.enableLandingPage"
                    color="primary"
                    hide-details
                    label="Enable Custom Landing Page"
                  />
                  <v-card-text class="text-caption text-grey-darken-1 pa-0 mt-1">
                    When enabled, a custom landing page will be displayed instead of the default registration page.
                  </v-card-text>
                </v-col>
              </v-row>

              <!-- Hero Section -->
              <v-divider class="my-6" />
              <v-card-title class="text-h6 pa-0 mb-4">
                <v-icon class="me-2">mdi-image-text</v-icon>
                Hero Section
              </v-card-title>

              <v-row
                v-if="landingConfig.enableLandingPage"
                class="mb-4"
              >
                <v-col
                  cols="12"
                >
                  <v-text-field
                    v-model="landingConfig.heroTitle"
                    density="comfortable"
                    hide-details="auto"
                    label="Hero Title"
                    prepend-inner-icon="mdi-format-title"
                    variant="solo"
                  />
                </v-col>
                <v-col
                  cols="12"
                >
                  <v-textarea
                    v-model="landingConfig.heroSubtitle"
                    density="comfortable"
                    hide-details="auto"
                    label="Hero Subtitle"
                    prepend-inner-icon="mdi-text"
                    rows="3"
                    variant="solo"
                  />
                </v-col>
              </v-row>

              <!-- Overview Section -->
              <v-divider class="my-6" />
              <v-card-title class="text-h6 pa-0 mb-4">
                <v-icon class="me-2">mdi-information</v-icon>
                Overview Section
              </v-card-title>

              <v-row
                v-if="landingConfig.enableLandingPage"
                class="mb-4"
              >
                <v-col
                  cols="12"
                >
                  <v-text-field
                    v-model="landingConfig.overviewTitle"
                    density="comfortable"
                    hide-details="auto"
                    label="Overview Section Title"
                    prepend-inner-icon="mdi-format-title"
                    variant="solo"
                  />
                </v-col>
                <v-col
                  cols="12"
                >
                  <v-textarea
                    v-model="landingConfig.overviewDescription"
                    density="comfortable"
                    hide-details="auto"
                    label="Overview Description"
                    prepend-inner-icon="mdi-text"
                    rows="4"
                    variant="solo"
                  />
                </v-col>
              </v-row>

              <!-- Custom Code Section -->
              <v-divider class="my-6" />
              <v-card-title class="text-h6 pa-0 mb-4">
                <v-icon class="me-2">mdi-code-tags</v-icon>
                Custom Code
              </v-card-title>

              <v-row
                v-if="landingConfig.enableLandingPage"
                class="mb-4"
              >
                <v-col
                  cols="12"
                >
                  <v-textarea
                    v-model="landingConfig.customCSS"
                    density="comfortable"
                    hide-details="auto"
                    label="Custom CSS"
                    prepend-inner-icon="mdi-language-css3"
                    rows="6"
                    variant="solo"
                  />
                  <v-card-text class="text-caption text-grey-darken-1 pa-0 mt-1">
                    Add custom CSS styles for your landing page.
                  </v-card-text>
                </v-col>
                <v-col
                  cols="12"
                >
                  <v-textarea
                    v-model="landingConfig.customJS"
                    density="comfortable"
                    hide-details="auto"
                    label="Custom JavaScript"
                    prepend-inner-icon="mdi-language-javascript"
                    rows="6"
                    variant="solo"
                  />
                  <v-card-text class="text-caption text-grey-darken-1 pa-0 mt-1">
                    Add custom JavaScript for your landing page.
                  </v-card-text>
                </v-col>
              </v-row>

              <div class="d-flex align-center mt-6">
                <v-btn
                  color="secondary"
                  prepend-icon="mdi-cog"
                  :size="xs ? 'default' : 'large'"
                  :to="{ name: 'event-config', params: { eventId: landingConfig.id } }"
                  variant="outlined"
                >
                  Back to Config
                </v-btn>
                <v-spacer />
                <v-btn
                  color="primary"
                  :disabled="isSaving"
                  :loading="isSaving"
                  :size="xs ? 'default' : 'large'"
                  type="submit"
                >
                  Save Landing Config
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.event-landing-config-container {
  max-width: 1200px;
}

.form-card {
  border-radius: 12px;
}
</style>
