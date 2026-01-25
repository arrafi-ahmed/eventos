<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import EventCard from '@/components/EventCard.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatEventDateDisplay, getEventImageUrl } from '@/utils'

  definePage({
    name: 'events-browse',
    meta: {
      layout: 'default',
      title: 'Browse Events',
    },
  })

  const router = useRouter()
  const store = useStore()
  const { variant, density, size, rounded } = useUiProps()

  // State
  const isLoading = ref(true)
  const search = ref('')
  const currentPage = ref(1)
  const itemsPerPage = 12
  const searchTimeout = ref(null)

  // Store
  const events = computed(() => store.state.event.events || [])
  const pagination = computed(() => store.state.event.pagination)
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])

  function navigateToEvent (event) {
    if (event.slug) {
      router.push({ name: 'event-landing-slug', params: { slug: event.slug } })
    } else {
      router.push({ name: 'event-landing', params: { eventId: event.id } })
    }
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

  function normalizeEventList (raw) {
    if (!raw || !Array.isArray(raw)) return []
    return raw
      .map(event => {
        // Ensure banner is properly handled - check for null, undefined, empty string, or 'null' string
        const bannerValue = event.banner || event.Banner || null
        return {
          id: event.id,
          title: event.name,
          date: formatEventDateDisplay({ event, eventConfig: event.config }),
          time: event.startTime || null,
          location: event.location,
          description: event.description === 'null' ? '' : event.description,
          banner: getEventImageUrl(bannerValue),
          slug: event.slug,
          startDate: event.startDatetime || event.startDate,
          endDate: event.endDatetime || event.endDate,
          eventStatus: getEventStatus(event),
          is_featured: event.isFeatured || event.is_featured || false,
        }
      })
  }

  const formattedEvents = computed(() => normalizeEventList(events.value))

  const totalPages = computed(() => pagination.value?.totalPages || 0)

  async function fetchEvents (searchTerm = '', page = 1) {
    try {
      isLoading.value = true
      // Always use backend published-only search (empty term lists all published upcoming across organizations)
      await store.dispatch('event/searchPublishedEvents', {
        searchTerm: (searchTerm || '').trim(),
        page,
        itemsPerPage,
      })
    } catch {
      store.commit('event/setEvents', [])
    } finally {
      isLoading.value = false
    }
  }

  function onPageChange (page) {
    currentPage.value = page
    fetchEvents(search.value, page)
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Keep current page within valid bounds when total pages change
  watch(() => pagination.value?.totalPages, newTotal => {
    const total = Number(newTotal) || 0
    if (total > 0 && currentPage.value > total) {
      currentPage.value = 1
    }
  })

  function handleSearch () {
    // Always start from first page for a new search
    currentPage.value = 1
    fetchEvents(search.value, 1)
  }

  onMounted(() => {
    fetchEvents('', 1)
  })
</script>

<template>
  <div class="browse-events-page">
    <v-container class="px-4 px-md-8 px-lg-12">
      <PageTitle
        :back-route="'/'"
        subtitle="Discover upcoming events"
        title="Browse Events"
      />

      <v-row
        align="center"
        class="mb-4"
        justify="center"
      >
        <v-col
          cols="12"
          md="12"
        >
          <v-text-field
            v-model="search"
            append-inner-icon="mdi-magnify"
            clearable
            hide-details
            label="Search events"
            :rounded="rounded"
            :variant="variant"
            @click:append-inner="handleSearch"
          />
        </v-col>
      </v-row>

      <div
        v-if="isLoading"
        class="d-flex flex-column align-center justify-center py-12"
      >
        <v-progress-circular
          color="primary"
          indeterminate
          size="48"
        />
        <div class="text-caption mt-3">
          Loading events…
        </div>
      </div>

      <v-row
        v-else
        justify="center"
      >
        <v-col
          v-for="event in formattedEvents"
          :key="event.id"
          class="event-col"
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

        <v-col
          v-if="formattedEvents.length === 0"
          cols="12"
        >
          <v-alert
            type="info"
            variant="tonal"
          >
            No upcoming events found.
          </v-alert>
        </v-col>
      </v-row>

      <!-- Pagination -->
      <div
        v-if="totalPages > 1"
        class="d-flex justify-center mt-12"
      >
        <v-pagination
          v-model="currentPage"
          color="primary"
          :length="totalPages"
          :total-visible="7"
          @update:model-value="onPageChange"
        />
      </div>

      <!-- Results info -->
      <div
        v-if="!isLoading && formattedEvents.length > 0"
        class="d-flex justify-center mt-6"
      >
        <v-chip
          color="primary"
          size="small"
          variant="outlined"
        >
          Showing {{
            Math.min(((currentPage - 1) * itemsPerPage) + 1, Math.max(1, pagination.totalItems))
          }}-{{ Math.min(currentPage * itemsPerPage, pagination.totalItems) }} of {{ pagination.totalItems }} events
        </v-chip>
      </div>
    </v-container>
  </div>
</template>

<style scoped>
</style>
