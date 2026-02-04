<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import { useUiProps } from '@/composables/useUiProps'

  import EventCard from '@/components/EventCard.vue'
  import { formatEventDateDisplay, getApiPublicImageUrl, getClientPublicImageUrl, getEventImageUrl } from '@/utils'

  const { rounded, size } = useUiProps()

  // Hero background image - use default-event.webp (can be replaced with hero-event.webp if needed)
  const heroBackgroundImage = getClientPublicImageUrl('default-event.webp')

  definePage({
    name: 'homepage',
    meta: {
      layout: 'default',
      title: 'Home',
      titleKey: 'home.title',
    },
  })

  const router = useRouter()
  const store = useStore()
  const theme = useTheme()
  const { t } = useI18n()

  // Reactive data
  const isLoading = ref(true)
  const upcomingEvents = ref([])
  const currentPage = ref(1)
  const itemsPerPage = ref(6)
  const currentBannerIndex = ref(0)

  // Computed properties
  const events = computed(() => store.state.event.events)
  const pagination = computed(() => store.state.event.pagination)
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const isAuthenticated = computed(() => {
    const user = currentUser.value
    return !!(user && (user.id || user.email))
  })
  const activeBanners = computed(() => store.state.homepage?.activeBanners || [])
  const isDark = computed(() => theme.global.name.value === 'dark')
  const calcHome = computed(() => store.getters['auth/calcHome'])

  // Features data - ordered by importance and popularity
  const features = [
    { icon: 'mdi-calendar-multiple', key: 'event_management' },
    { icon: 'mdi-store', key: 'onsite_sales' },
    { icon: 'mdi-cash-register', key: 'counter_management' },
    { icon: 'mdi-currency-usd', key: 'online_payments' },
    { icon: 'mdi-qrcode-scan', key: 'qr_checkin' },
    { icon: 'mdi-robot', key: 'ai_chatbot' },
    { icon: 'mdi-account-multiple', key: 'attendee_management' },
    { icon: 'mdi-chart-line', key: 'sales_analytics' },
    { icon: 'mdi-shopping', key: 'merchandise_shop' },
    { icon: 'mdi-file-document-edit', key: 'form_builder' },
    { icon: 'mdi-shield-account', key: 'role_access' },
    { icon: 'mdi-palette-swatch', key: 'custom_branding' },
    { icon: 'mdi-account-search', key: 'visitor_tracking' },
    { icon: 'mdi-bell-ring', key: 'cart_recovery' },
    { icon: 'mdi-ticket-percent', key: 'promo_codes' },
    { icon: 'mdi-clock-fast', key: 'early_bird' },
  ]


  // Format event data for display
  function formatEventData (events) {
    if (!events || !Array.isArray(events)) {
      return []
    }
    return events
      .map(event => {
        // Ensure banner is properly handled - check for null, undefined, empty string, or 'null' string
        const bannerValue = event.banner || event.Banner || null
        return {
          id: event.id,
          title: event.name,
          date: formatEventDateDisplay({ event: { ...event, config: { ...event.config, showEndTime: false } } }),
          location: event.location,
          description: event.description === 'null' ? '' : event.description,
          banner: getEventImageUrl(bannerValue),
          slug: event.slug,
          registrationCount: event.registrationCount,
          startDate: event.startDatetime || event.startDate,
          endDate: event.endDatetime || event.endDate,
          eventStatus: getEventStatus(event),
          is_featured: event.isFeatured || event.is_featured || false,
        }
      })
      .sort((a, b) => {
        const dateA = new Date(a.startDate)
        const dateB = new Date(b.startDate)
        return dateA - dateB
      })
  }

  // Get event status based on date
  function getEventStatus (event) {
    if (!event.startDate) {
      if (event.config?.isAllDay) {
        return 'All Day'
      } else if (event.config?.isSingleDayEvent) {
        return 'Single Day'
      } else {
        return 'Multi Day'
      }
    }

    const now = new Date()
    const eventDate = new Date(event.startDate)
    const diffTime = eventDate - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return 'Past'
    } else if (diffDays === 0) {
      return 'Today'
    } else if (diffDays === 1) {
      return 'Tomorrow'
    } else if (diffDays <= 7) {
      return 'This Week'
    } else if (diffDays <= 14) {
      return 'Next Week'
    } else {
      return 'Upcoming'
    }
  }

  // Fetch events - only published events for homepage
  async function fetchEvents (page = 1, isInitialLoad = false) {
    try {
      if (isInitialLoad) {
        isLoading.value = true
      } else {
        store.commit('setProgress', true)
      }

      // Use searchPublishedEvents to only get published events
      await store.dispatch('event/searchPublishedEvents', {
        searchTerm: '',
        page,
        itemsPerPage: itemsPerPage.value,
      })

      upcomingEvents.value = formatEventData(events.value)
    } catch (error) {
      console.error('Error fetching events:', error)
    } finally {
      if (isInitialLoad) {
        isLoading.value = false
      } else {
        store.commit('setProgress', false)
      }
    }
  }

  // Handle page change
  function onPageChange (page) {
    currentPage.value = page
    fetchEvents(page, false)
    window.scrollTo({ top: document.querySelector('.events-section')?.offsetTop - 100 || 0, behavior: 'smooth' })
  }

  function navigateToEvent (event) {
    if (event.slug) {
      router.push({ name: 'event-landing-slug', params: { slug: event.slug } })
    } else {
      router.push({ name: 'event-landing', params: { eventId: event.id } })
    }
  }

  function navigateToBrowseEvents () {
    router.push({ name: 'events-browse' })
  }

  // Banner carousel functionality
  function getBannerImageUrl (banner) {
    if (banner?.imageUrl) {
      return getApiPublicImageUrl(banner.imageUrl, 'homepage-banner')
    }
    return null
  }

  function nextBanner () {
    if (activeBanners.value.length > 0) {
      currentBannerIndex.value = (currentBannerIndex.value + 1) % activeBanners.value.length
    }
  }

  // Auto-rotate banners
  let bannerInterval = null

  function startBannerRotation () {
    if (activeBanners.value.length > 1) {
      bannerInterval = setInterval(() => {
        nextBanner()
      }, 5000)
    }
  }

  function stopBannerRotation () {
    if (bannerInterval) {
      clearInterval(bannerInterval)
      bannerInterval = null
    }
  }

  onMounted(async () => {
    // Ensure banners are loaded if not already
    if (activeBanners.value.length === 0) {
      await store.dispatch('homepage/fetchActiveBanners')
    }

    fetchEvents(1, true)

    // Start banner rotation if we have multiple banners
    if (activeBanners.value.length > 1) {
      startBannerRotation()
    }
  })

  onUnmounted(() => {
    stopBannerRotation()
  })
</script>

<template>

  <v-container class="pt-0" fluid>
    <v-row>
      <v-col cols="12">
        <!-- Ad Banner Section -->
        <section
          v-if="activeBanners.length > 0"
          class="ad-banner-section"
          @mouseenter="stopBannerRotation"
          @mouseleave="startBannerRotation"
        >
          <v-carousel
            v-model="currentBannerIndex"
            cycle
            height="auto"
            hide-delimiter-background
            :hide-delimiters="false"
            interval="5000"
            :show-arrows="activeBanners.length > 1"
          >
            <v-carousel-item
              v-for="(banner, index) in activeBanners"
              :key="banner.id"
            >
              <v-img
                :alt="`Banner ${index + 1}`"
                cover
                height="160"
                :src="getBannerImageUrl(banner)"
              >
                <template #placeholder>
                  <div class="d-flex align-center justify-center fill-height">
                    <v-progress-circular
                      color="primary"
                      indeterminate
                    />
                  </div>
                </template>
              </v-img>
            </v-carousel-item>
          </v-carousel>
        </section>

        <!-- Hero Section -->
        <section class="hero-section">
          <div class="hero-background">
            <v-img
              class="hero-image"
              cover
              eager
              :src="heroBackgroundImage"
            >
              <template #placeholder>
                <div class="d-flex align-center justify-center fill-height">
                  <v-progress-circular
                    color="primary"
                    indeterminate
                  />
                </div>
              </template>
              <div class="hero-overlay" />
            </v-img>
          </div>
          <v-container class="px-2 px-sm-4 px-md-8 px-lg-12 hero-container">
            <v-row
              align="center"
              class="fill-height"
              justify="center"
            >
              <v-col
                class="text-center"
                cols="12"
                lg="10"
                md="11"
                xl="9"
              >
                <div class="hero-content">
                  <h1 class="hero-title text-h4 text-md-h3 text-lg-h2 text-xl-h1 font-weight-black mb-4 mb-md-6">
                    {{ t('home.hero_title') }}
                  </h1>
                  <p class="hero-subtitle text-body-1 text-md-h6 text-lg-h5 text-wrap mb-8 mb-md-10 opacity-90 mx-auto">
                    {{ t('home.hero_subtitle') }}
                  </p>
                  <div class="hero-actions d-flex flex-column flex-sm-row justify-center">
                    <v-btn
                      v-if="!isAuthenticated"
                      class="hero-btn hero-btn-active mb-3 mb-sm-0"
                      color="primary"
                      elevation="8"
                      prepend-icon="mdi-plus-circle-outline"
                      rounded="xl"
                      size="large"
                      :to="{ name: 'event-add' }"
                    >
                      {{ t('home.create_event') }}
                    </v-btn>
                    <v-btn
                      v-else
                      class="hero-btn hero-btn-active mb-3 mb-sm-0"
                      color="primary"
                      elevation="8"
                      prepend-icon="mdi-view-dashboard-outline"
                      rounded="xl"
                      size="large"
                      :to="calcHome"
                    >
                      {{ t('home.go_to_dashboard') }}
                    </v-btn>
                    <v-btn
                      class="hero-btn hero-btn-mobile ml-2"
                      color="secondary"
                      prepend-icon="mdi-calendar-search"
                      rounded="xl"
                      size="large"
                      :to="{ name: 'events-browse' }"
                      variant="outlined"
                    >
                      {{ t('home.browse_events') }}
                    </v-btn>
                  </div>
                </div>
              </v-col>
            </v-row>
          </v-container>
        </section>
      </v-col>
    </v-row>
  </v-container>
  <v-container>
    <v-row>
      <v-col>

        <!-- Upcoming Events Section -->
        <section class="events-section py-8 py-md-16">

          <div class="text-center mb-8 mb-md-12">
            <h2 class="text-h5 text-md-h4 text-lg-h3 text-xl-h2 font-weight-bold mb-3 mb-md-4">
              {{ t('home.upcoming_events') }}
            </h2>
            <p class="text-body-1 text-md-h6 text-lg-h5 text-medium-emphasis mb-4 mb-md-6">
              {{ t('home.join_us') }}
            </p>
            <v-btn
              class="browse-events-btn"
              color="primary"
              prepend-icon="mdi-calendar-search"
              rounded="xl"
              size="default"
              variant="outlined"
              @click="navigateToBrowseEvents"
            >
              {{ t('home.browse_all_events') }}
            </v-btn>
          </div>

          <!-- Loading State -->
          <div
            v-if="isLoading"
            class="d-flex flex-column align-center justify-center py-8 py-md-16"
          >
            <v-progress-circular
              color="primary"
              indeterminate
              size="64"
            />
            <p class="text-h6 mt-4 text-medium-emphasis">
              {{ t('home.loading_events') }}
            </p>
          </div>

          <!-- Events Grid -->
          <v-row
            v-else
            justify="center"
          >
            <v-col
              v-for="event in upcomingEvents"
              :key="event.id"
              cols="12"
              lg="4"
              md="4"
              sm="6"
            >
              <EventCard
                :event="event"
                @click="navigateToEvent"
              />
            </v-col>
          </v-row>

          <!-- Pagination -->
          <div
            v-if="!isLoading && pagination.totalPages > 1"
            class="d-flex justify-center mt-8 mt-md-12"
          >
            <v-pagination
              v-model="currentPage"
              color="primary"
              density="compact"
              :length="pagination.totalPages"
              :total-visible="$vuetify.display.xs ? 5 : 7"
              @update:model-value="onPageChange"
            />
          </div>

          <!-- No Events State -->
          <div
            v-if="!isLoading && upcomingEvents.length === 0"
            class="d-flex flex-column align-center justify-center py-8 py-md-16 text-center"
          >
            <v-icon
              class="mb-4"
              color="primary"
              size="64"
            >
              mdi-calendar-outline
            </v-icon>
            <h3 class="text-h5 mb-2">
              {{ t('home.no_upcoming_events') }}
            </h3>
            <p class="text-body-1 text-medium-emphasis">
              {{ t('home.check_back_soon') }}
            </p>
          </div>
        </section>

        <!-- Features Section -->
        <section class="features-section py-8 py-md-16">
          <div class="text-center mb-3 mb-md-4">
            <h2 class="text-h5 text-md-h4 text-lg-h3 text-xl-h2 font-weight-bold mb-3 mb-md-4">
              {{ t('home.powerful_features') }}
            </h2>
            <p class="text-body-1 text-md-h6 text-lg-h5 text-medium-emphasis">
              {{ t('home.everything_you_need') }}
            </p>
          </div>

          <!-- Desktop/Tablet: Grid Layout -->
          <v-row class="d-none d-md-flex" justify="center">
            <v-col
              v-for="(feature, index) in features"
              :key="index"
              cols="6"
              lg="3"
              md="4"
            >
              <v-card
                class="feature-card hover-glow"
                elevation="2"
                :ripple="false"
                rounded="xl"
              >
                <v-card-text class="text-center pa-4 pa-md-6">
                  <div class="feature-icon-wrapper mb-3 mb-md-4">
                    <v-icon
                      color="primary"
                      :icon="feature.icon"
                      :size="$vuetify.display.xs ? 40 : 56"
                    />
                  </div>
                  <h3 class="text-subtitle-1 text-md-h6 font-weight-bold mb-2 mb-md-3">
                    {{ t(`home.features.${feature.key}.title`) }}
                  </h3>
                  <p class="text-caption text-md-body-2 text-medium-emphasis">
                    {{ t(`home.features.${feature.key}.desc`) }}
                  </p>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Mobile: Slide Group -->
          <div class="d-md-none">
            <v-slide-group
              class="feature-slide-group"
              mobile
              show-arrows
              :show-arrows="false"
            >
              <v-slide-group-item
                v-for="(feature, index) in features"
                :key="index"
              >
                <v-card
                  class="feature-card feature-card-mobile hover-glow ma-1"
                  elevation="2"
                  :ripple="false"
                  rounded="lg"
                >
                  <v-card-text class="text-center pa-4 pa-sm-6">
                    <div class="feature-icon-wrapper mb-4">
                      <v-icon
                        color="primary"
                        :icon="feature.icon"
                        size="56"
                      />
                    </div>
                    <h3 class="text-h6 font-weight-bold mb-3">
                      {{ t(`home.features.${feature.key}.title`) }}
                    </h3>
                    <p class="text-body-2 text-medium-emphasis">
                      {{ t(`home.features.${feature.key}.desc`) }}
                    </p>
                  </v-card-text>
                </v-card>
              </v-slide-group-item>
            </v-slide-group>
          </div>
        </section>

        <!-- CTA Section -->
        <section class="py-8 py-md-16">
          <v-row justify="center">
            <v-col lg="8" md="10">
              <v-card
                class="text-center pa-md-8 pa-lg-12"
                color="primary"
                elevation="4"
                rounded="xl"
                variant="tonal"
              >
                <v-card-title class="text-h5 text-md-h4 text-lg-h3 text-xl-h2 text-wrap my-3 my-md-4">
                  {{ t('home.ready_to_start') }}
                </v-card-title>
                <v-card-text class="text-body-1 text-md-h6 text-lg-h5">
                  {{ t('home.join_thousands') }}
                </v-card-text>
                <v-card-actions class="justify-center">
                  <v-btn
                    v-if="!isAuthenticated"
                    class="cta-btn-mobile"
                    color="secondary"
                    prepend-icon="mdi-account-plus"
                    :rounded="rounded"
                    :size="size"
                    :to="{ name: 'register' }"
                  >
                    {{ t('home.signup_free') }}
                  </v-btn>
                  <v-btn
                    v-else
                    class="cta-btn-mobile"
                    color="secondary"
                    prepend-icon="mdi-view-dashboard"
                    :rounded="rounded"
                    :size="size"
                    :to="calcHome"
                  >
                    {{ t('home.go_to_dashboard') }}
                  </v-btn>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>
        </section>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
/* Hero Section */
.hero-section {
  position: relative;
  height: 100vh;
  max-height: 720px;
  display: flex;
  align-items: center;
  overflow: hidden;
}

.hero-background {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}

.hero-image {
  width: 100%;
  height: 100%;
}

.hero-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  /* Use semi-transparent black overlay for better text readability */
  background: linear-gradient(
    180deg,
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.5) 100%
  );
  z-index: 1;
}

.hero-container {
  position: relative;
  z-index: 2;
  height: 100%;
}

.hero-content {
  position: relative;
  z-index: 3;
}

.hero-title {
  color: rgb(var(--v-theme-on-surface));
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  line-height: 1.2;
}

.hero-subtitle {
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
  line-height: 1.5;
  color: rgb(var(--v-theme-on-surface));
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

.hero-actions {
  margin-top: 24px;
}

.hero-btn {
  min-width: 180px;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.5px;
  transition: box-shadow 0.3s ease, border-color 0.3s ease;
}

.hero-btn {
  transition: filter 0.3s ease;
}

.hero-btn:hover {
  /* Increased blur radius to 20px for more visible spread */
  filter: drop-shadow(0 0 20px rgb(var(--v-theme-tertiary))) !important;
}

.hero-btn-outlined {
  border-color: rgb(var(--v-theme-secondary));
  color: rgb(var(--v-theme-secondary));
  transition: filter 0.3s ease, border-color 0.3s ease, background-color 0.3s ease;
}

.hero-btn-outlined:hover {
  background-color: rgba(var(--v-theme-secondary), 0.1);
  /* Increased blur radius to 18px for more visible spread */
  filter: drop-shadow(0 0 18px rgb(var(--v-theme-tertiary))) !important;
  border-color: rgba(var(--v-theme-tertiary), 0.5) !important;
}

/* Features Section */
.features-section {
  background: linear-gradient(
    to bottom,
    transparent 0%,
    rgba(var(--v-theme-primary), 0.02) 50%,
    transparent 100%
  );
}

.feature-card {
  height: 100%;
  border: 1px solid rgba(var(--v-theme-outline), 0.08);
}

.feature-card-mobile {
  height: auto;
}

.feature-icon-wrapper {
  display: inline-flex;
  padding: 16px;
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.1) 0%,
    rgba(var(--v-theme-secondary), 0.1) 100%
  );
  border-radius: 20px;
  position: relative;
  overflow: hidden;
}

.feature-icon {
  font-size: 40px;
}

.feature-icon-wrapper::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.05) 0%,
    rgba(var(--v-theme-secondary), 0.05) 100%
  );
  opacity: 0;
  transition: opacity 0.3s ease;
}

.feature-card:hover .feature-icon-wrapper::before {
  opacity: 1;
}

.feature-slide-group {
  padding: 8px 0;
}

@media (min-width: 600px) {
  .feature-icon-wrapper {
    padding: 20px;
  }

  .feature-icon {
    font-size: 56px;
  }
}

/* Mobile Responsive */
@media (max-width: 960px) {
  .hero-title {
    font-size: 2rem;
  }

  .hero-subtitle {
    font-size: 1.1rem;
  }
}

@media (max-width: 600px) {
  .hero-section {
    max-height: 720px;
  }
  .hero-title {
    font-size: 1.5rem;
    margin-bottom: 12px;
    line-height: 1.3;
  }

  .hero-subtitle {
    font-size: 0.9rem;
    margin-bottom: 20px;
    line-height: 1.4;
  }

  .hero-btn {
    min-width: 100%;
    width: 100%;
    font-size: 0.875rem;
    padding: 10px 16px;
  }

  .hero-btn-mobile {
    font-size: 0.875rem;
    padding: 10px 16px;
  }

  .hero-actions {
    margin-top: 16px;
    gap: 12px;
  }

  .browse-events-btn {
    font-size: 0.875rem;
    padding: 8px 16px;
  }

  .cta-btn-mobile {
    font-size: 0.875rem;
    padding: 10px 20px;
    min-width: 200px;
  }

  .events-section {
    padding: 48px 0;
  }

  .feature-card-mobile {
    width: 240px;
  }

  .feature-icon-wrapper {
    padding: 12px;
  }

  .feature-icon-wrapper .v-icon {
    font-size: 40px;
  }
}
</style>
