<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { apiCall, formatDateTime } from '@/utils'

  definePage({
    name: 'event-visitors',
    meta: {
      layout: 'default',
      title: 'Event Landing Visitors',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, variant, density, size } = useUiProps()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const prefetchedEvent = computed(() => store.getters['event/getEventById'](route.params.eventId))
  const event = computed(() =>
    prefetchedEvent.value?.id ? prefetchedEvent.value : store.state.event.event,
  )

  const isLoading = ref(true)
  const visitors = ref([])
  const stats = ref({})
  const pagination = ref({
    page: 1,
    itemsPerPage: 50,
    total: 0,
    totalPages: 0,
  })
  const includeConverted = ref(true)

  // Table headers
  const headers = [
    { title: 'Name', key: 'name', sortable: true },
    { title: 'Email', key: 'email', sortable: true },
    { title: 'Phone', key: 'phone', sortable: false },
    { title: 'Visited At', key: 'visited_at', sortable: true },
    { title: 'Status', key: 'converted', sortable: true },
    { title: '', key: 'action', sortable: false, width: '50px' },
  ]

  async function fetchVisitors () {
    try {
      isLoading.value = true
      const eventId = Number.parseInt(route.params.eventId)
      if (!eventId) {
        throw new Error('Invalid event ID')
      }

      const response = await apiCall.get('/event-visitor/getEventVisitors', {
        params: {
          eventId: eventId,
          page: pagination.value.page,
          itemsPerPage: pagination.value.itemsPerPage,
          includeConverted: includeConverted.value,
        },
      })

      if (response.data?.payload) {
        visitors.value = response.data.payload.visitors.map(v => {
          // Database converts snake_case to camelCase, so use camelCase
          // Handle null/undefined values for name
          const firstName = v.firstName || ''
          const lastName = v.lastName || ''
          const fullName = `${firstName} ${lastName}`.trim() || 'Unknown'

          return {
            ...v,
            name: fullName,
            // Keep both camelCase and snake_case for compatibility with v-data-table
            visited_at: v.visitedAt || null,
            visitedAt: v.visitedAt || null,
          }
        })
        pagination.value = response.data.payload.pagination
      }
    } catch (error) {
      console.error('Error fetching visitors:', error)
    // Error notification will be shown automatically by axios interceptor from API response
    } finally {
      isLoading.value = false
    }
  }

  async function fetchStats () {
    try {
      const eventId = Number.parseInt(route.params.eventId)
      if (!eventId) {
        return
      }

      const response = await apiCall.get('/event-visitor/stats', {
        params: {
          eventId: eventId,
        },
      })

      if (response.data?.payload) {
        stats.value = response.data.payload
      // Debug: log stats to see what we're getting
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
      // Stats error is not critical, but log it for debugging
      if (error.response?.data?.message) {
        console.error('Stats error message:', error.response.data.message)
      }
    }
  }

  function formatDate (dateString) {
    return formatDateTime({
      input: dateString,
      timezone: currentUser.value?.timezone,
      format: 'MMM DD, YYYY HH:mm',
    })
  }

  function getStatusBadge (visitor) {
    if (visitor.converted) {
      return { color: 'success', text: 'Converted' }
    }
    return { color: 'warning', text: 'Not Converted' }
  }

  async function deleteVisitor (visitor) {
    try {
      await apiCall.delete('/event-visitor/delete', {
        params: {
          visitorId: visitor.id,
          eventId: route.params.eventId,
        },
      })

      // Remove from local state without refetching (preserves itemsPerPage)
      const index = visitors.value.findIndex(v => v.id === visitor.id)
      if (index !== -1) {
        visitors.value.splice(index, 1)
        // Update total count
        pagination.value.total = Math.max(0, pagination.value.total - 1)
      }
    // Notification will be shown automatically by axios interceptor from API response
    } catch (error) {
      console.error('Error deleting visitor:', error)
    // Error notification will be shown automatically by axios interceptor from API response
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
        router.push({ name: 'dashboard-organizer' })
        return
      }
    }
  }

  onMounted(async () => {
    try {
      await fetchData()
      await Promise.all([fetchVisitors(), fetchStats()])
    } catch (error) {
      console.error('Error loading data:', error)
    }
  })

  // Watch for filter changes
  watch(includeConverted, () => {
    pagination.value.page = 1
    fetchVisitors()
  })
</script>

<template>
  <v-container>
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Landing Visitors"
    />

    <!-- Statistics Cards -->
    <v-row
      v-if="stats && Object.keys(stats).length > 0"
      class="mb-6"
      justify="center"
    >
      <v-col
        cols="12"
        md="3"
      >
        <v-card
          elevation="2"
          :rounded="rounded"
        >
          <v-card-text>
            <div class="text-h6 text-primary">
              {{ stats.totalVisitors || stats.total_visitors || 0 }}
            </div>
            <div class="text-caption text-medium-emphasis">
              Total Visitors
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="3"
      >
        <v-card
          elevation="2"
          :rounded="rounded"
        >
          <v-card-text>
            <div class="text-h6 text-success">
              {{ stats.convertedVisitors || stats.converted_visitors || 0 }}
            </div>
            <div class="text-caption text-medium-emphasis">
              Converted
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="3"
      >
        <v-card
          elevation="2"
          :rounded="rounded"
        >
          <v-card-text>
            <div class="text-h6 text-warning">
              {{ stats.unconvertedVisitors || stats.unconverted_visitors || 0 }}
            </div>
            <div class="text-caption text-medium-emphasis">
              Not Converted
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="3"
      >
        <v-card
          elevation="2"
          :rounded="rounded"
        >
          <v-card-text>
            <div class="text-h6 text-info">
              {{ stats.conversionRate || stats.conversion_rate || 0 }}%
            </div>
            <div class="text-caption text-medium-emphasis">
              Conversion Rate
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Visitors Table -->
    <v-row justify="center">
      <v-col cols="12">
        <v-card
          elevation="2"
          :rounded="rounded"
        >
          <v-card-title class="d-flex align-center justify-space-between">
            <span>Visitors List</span>
            <v-switch
              v-model="includeConverted"
              class="mt-0"
              color="primary"
              density="compact"
              hide-details
              inset
              label="Include Converted"
            />
          </v-card-title>

          <v-data-table
            :headers="headers"
            hover
            :items="visitors"
            :items-per-page="pagination.itemsPerPage"
            :loading="isLoading"
            :page="pagination.page"
            :server-items-length="pagination.total"
            @update:items-per-page="(itemsPerPage) => { pagination.itemsPerPage = itemsPerPage; pagination.page = 1; fetchVisitors() }"
            @update:page="(page) => { pagination.page = page; fetchVisitors() }"
          >
            <template #item.name="{ item }">
              <div class="font-weight-medium">
                {{ item.name }}
              </div>
            </template>

            <template #item.email="{ item }">
              <a
                class="text-primary text-decoration-none"
                :href="`mailto:${item.email}`"
              >
                {{ item.email }}
              </a>
            </template>

            <template #item.phone="{ item }">
              <span v-if="item.phone">
                {{ item.phone }}
              </span>
              <span
                v-else
                class="text-medium-emphasis"
              >
                -
              </span>
            </template>

            <template #item.visited_at="{ item }">
              {{ formatDate(item.visitedAt || item.visited_at || null) }}
            </template>

            <template #item.converted="{ item }">
              <v-chip
                :color="getStatusBadge(item).color"
                density="compact"
                size="small"
                variant="tonal"
              >
                {{ getStatusBadge(item).text }}
              </v-chip>
            </template>

            <template #item.action="{ item }">
              <v-menu transition="scale-transition">
                <template #activator="{ props }">
                  <v-btn
                    :density="density"
                    icon="mdi-dots-vertical"
                    v-bind="props"
                    variant="text"
                    @click.stop
                  />
                </template>
                <v-list density="compact" :rounded="rounded">
                  <confirmation-dialog @confirm="deleteVisitor(item)">
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        density="compact"
                        prepend-icon="mdi-delete"
                        title="Delete"
                        @click.stop="onClick"
                      />
                    </template>
                  </confirmation-dialog>
                </v-list>
              </v-menu>
            </template>

            <template #no-data>
              <div class="py-10">
                <AppNoData
                  icon="mdi-account-off-outline"
                  message="No visitors have landed on your event page yet. Once people visit, they will appear here."
                  title="No Visitors Found"
                />
              </div>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
