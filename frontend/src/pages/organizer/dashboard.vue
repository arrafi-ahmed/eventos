<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'

  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatEventDateDisplay, getEventImageUrl } from '@/utils'

  definePage({
    name: 'dashboard-organizer',
    meta: {
      layout: 'default',
      title: 'Organizer Dashboard',
      titleKey: 'pages.organizer.dashboard',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, size, density, variant } = useUiProps()
  const store = useStore()
  const router = useRouter()
  const { t } = useI18n()

  const events = computed(() => store.state.event.events)
  const pagination = computed(() => store.state.event.pagination)
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const currentPage = ref(1)
  const itemsPerPage = ref(6)

  const verificationStatus = computed(() => currentUser.value?.verification_status || currentUser.value?.verificationStatus || 'pending')
  const isVerified = computed(() => store.getters['auth/isOrganizerVerified'])
  const showVerificationBanner = computed(() => !isVerified.value)

  // Get organizer dashboard banner settings from unified systemSettings store
  const organizerBanner = computed(() => store.getters['systemSettings/organizerDashboardBanner'] || {
    isEnabled: false,
    icon: null,
    title: null,
    description: null,
    ctaButtonText: null,
    ctaButtonUrl: null,
  })

  function deleteEvent (eventId) {
    store.dispatch('event/removeEvent', { eventId, organizationId: currentUser.value.organizationId })
  }

  async function publishEvent (eventId) {
    // Refresh user data to get latest verification status
    await store.dispatch('auth/refreshCurrentUser')

    // Check if organizer is verified using the getter
    if (!isVerified.value) {
      store.commit('addSnackbar', {
        text: 'You must verify your identity before publishing events. Please upload your ID document and wait for admin approval.',
        color: 'warning',
      })
      router.push({ name: 'organizer-verify' })
      return
    }

    try {
      await store.dispatch('event/publishEvent', { eventId })
      await fetchData(currentPage.value)
    // Notification handled by backend
    } catch (error) {
      console.error('Error publishing event:', error)
      if (error?.response?.data?.message?.includes('verification')) {
        // Refresh user data in case verification status changed
        await store.dispatch('auth/refreshCurrentUser')
        router.push({ name: 'organizer-verify' })
      }
    // Error notification handled by backend via axios interceptor
    }
  }

  async function unpublishEvent (eventId) {
    try {
      await store.dispatch('event/unpublishEvent', { eventId })
      await fetchData(currentPage.value)
    } catch (error) {
      console.error('Error unpublishing event:', error)
    }
  }

  async function fetchData (page = 1) {
    await store.dispatch('event/setEvents', {
      organizationId: currentUser.value.organizationId,
      page,
      itemsPerPage: itemsPerPage.value,
      fetchTotalCount: true,
    })
  }

  function onPageChange (page) {
    currentPage.value = page
    fetchData(page)
  }

  onMounted(async () => {
    // Refresh current user data to get latest verification status
    await store.dispatch('auth/refreshCurrentUser')
    // Fetch system settings (includes organizer dashboard banner) if not already loaded
    if (!store.getters['systemSettings/organizerDashboardBanner']?.icon) {
      await store.dispatch('systemSettings/fetchSettings')
    }
    await fetchData()
  })

  function formatEventDates (item) {
    return formatEventDateDisplay({ event: item, eventConfig: item.config })
  }

  function viewEventPage (slug) {
    const route = router.resolve({ name: 'event-landing-slug', params: { slug } })
    window.open(route.href, '_blank', 'noopener,noreferrer')
  }
</script>

<template>
  <v-container class="organizer-dashboard">
    <!-- Verification Status Banner -->
    <v-row v-if="showVerificationBanner" class="mb-4">
      <v-col cols="12">
        <v-alert
          :color="verificationStatus === 'pending' ? 'warning' : 'error'"
          :icon="verificationStatus === 'pending' ? 'mdi-clock-outline' : 'mdi-alert-circle'"
          prominent
          variant="tonal"
        >
          <div class="d-flex align-center justify-space-between flex-wrap">
            <div>
              <div class="text-h6 mb-1">
                {{
                  verificationStatus === 'pending' ? t('pages.organizer.identity_pending') : t('pages.organizer.identity_rejected')
                }}
              </div>
            <v-btn
              class="mt-2"
              :color="verificationStatus === 'pending' ? 'warning' : 'error'"
              variant="outlined"
              @click="showVerificationDialog = true"
            >
              {{ currentUser?.id_document ? t('pages.organizer.update_id') : t('pages.organizer.upload_id') }}
            </v-btn>
          </div>
        </div>
      </v-alert>
      </v-col>
    </v-row>

    <!-- Organizer Dashboard Banner -->
    <v-row v-if="organizerBanner.isEnabled" class="mb-4">
      <v-col cols="12">
        <v-card
          class="recto-cta-card"
          elevation="0"
          :rounded="rounded"
          variant="outlined"
        >
          <v-card-text class="pa-4">
            <div class="d-flex align-center justify-space-between flex-wrap gap-3">
              <div class="d-flex align-center gap-3">
                <v-icon
                  color="secondary"
                  size="32"
                >
                  {{ organizerBanner.icon }}
                </v-icon>
                <div>
                  <div class="text-body-1 font-weight-medium mb-1">
                    {{ organizerBanner.title }}
                  </div>
                  <div
                    v-if="organizerBanner.description"
                    class="text-body-2 text-medium-emphasis"
                  >
                    {{ organizerBanner.description }}
                  </div>
                </div>
              </div>
              <v-btn
                v-if="organizerBanner.ctaButtonUrl"
                color="secondary"
                :href="organizerBanner.ctaButtonUrl"
                prepend-icon="mdi-open-in-new"
                rel="noopener noreferrer"
                :rounded="rounded"
                size="small"
                target="_blank"
                variant="outlined"
              >
                {{ organizerBanner.ctaButtonText }}
              </v-btn>
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Header Section -->
    <PageTitle
      :show-back-button="false"
      :subtitle="t('pages.organizer.subtitle')"
      :title="t('pages.organizer.dashboard')"
    >
      <template #actions>
        <v-btn
          color="secondary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          :to="{ name: 'event-add' }"
          :variant="variant"
        >
          {{ t('pages.organizer.add_event.label') }}
        </v-btn>
      </template>

    </PageTitle>

    <!-- Events Grid -->
    <template v-if="events && events.length > 0">
      <v-row>
        <v-col
          v-for="(item, index) in events"
          :key="index"
          cols="12"
          lg="4"
          md="6"
        >
          <v-card
            class="event-card"
            :rounded="rounded"
          >
            <!-- Vertical Accent Bar -->
            <div
              class="event-accent-bar"
              :class="{
                'accent-published': item.status === 'published',
                'accent-draft': item.status === 'draft'
              }"
            />

            <!-- Event Image -->
            <v-img
              :aspect-ratio="16 / 9"
              class="event-image"
              cover
              :src="getEventImageUrl(item.banner, item.name)"
            >
              <!-- Status Badge (Top Left) -->
              <v-chip
                class="status-badge"
                :color="item.status === 'published' ? 'success' : 'warning'"
                :prepend-icon="item.status === 'published' ? 'mdi-check-circle' : 'mdi-clock-outline'"
                size="small"
                variant="flat"
              >
                {{ item.status === 'published' ? t('pages.organizer.published') : t('pages.organizer.draft') }}
              </v-chip>

              <!-- View Button (Top Right) -->
              <v-btn
                class="view-button"
                color="info"

                prepend-icon="mdi-web"
                rounded="rounded"
                size="small"
                variant="flat"
                @click.stop="viewEventPage(item.slug)"
              >{{ t('pages.organizer.view') }}</v-btn>

              <template #placeholder>
                <div class="d-flex align-center justify-center fill-height">
                  <v-icon
                    color="grey-lighten-1"
                    size="64"
                  >
                    mdi-calendar
                  </v-icon>
                </div>
              </template>
            </v-img>

            <!-- Event Content -->
            <v-card-text class="pa-5">
              <h3 class="event-title mb-3">
                {{ item.name }}
              </h3>

              <div class="event-details mb-4">
                <div class="d-flex align-center mb-2">
                  <v-icon
                    class="mr-2"
                    color="primary"
                    size="23"
                  >
                    mdi-calendar
                  </v-icon>
                  <span class="text-body-2">
                    {{ formatEventDates(item) }}
                  </span>
                </div>
                <div class="d-flex align-center">
                  <v-icon
                    class="mr-2"
                    color="primary"
                    size="23"
                  >
                    mdi-map-marker
                  </v-icon>
                  <span class="text-body-2">{{ item.location }}</span>
                </div>
              </div>

              <!-- Action Buttons -->
              <div class="d-flex align-center gap-2 mb-2">
                <v-btn
                  class="flex-grow-1"
                  color="primary"
                  density="comfortable"
                  height="40"
                  prepend-icon="mdi-account-multiple"
                  rounded="rounded"
                  :to="{ name: 'event-attendees', params: { eventId: item.id } }"
                  variant="tonal"
                >
                  {{ t('pages.organizer.attendees') }}
                </v-btn>
                <v-btn
                  class="flex-grow-1"
                  color="success"
                  density="comfortable"
                  height="40"
                  prepend-icon="mdi-qrcode"
                  rounded="rounded"
                  :to="{ name: 'event-checkin', params: { eventId: item.id, variant: 'main' } }"
                  variant="tonal"
                >
                  {{ t('pages.organizer.scanner') }}
                </v-btn>

                <!-- Quick Actions Menu -->
                <v-menu transition="scale-transition">
                  <template #activator="{ props }">
                    <v-btn
                      color="grey-darken-1"
                      v-bind="props"
                      density="compact"
                      icon="mdi-dots-vertical"
                      :ripple="false"
                      variant="plain"
                    />
                  </template>
                  <v-list
                    class="mt-2"
                    density="compact"
                    elevation="8"
                    :rounded="rounded"
                    width="320"
                  >
                    <!-- Group 1: Event Management -->
                    <v-list-subheader class="text-uppercase font-weight-bold letter-spacing-1 opacity-70" style="font-size: 0.65rem;">
                      {{ t('pages.organizer.event_management') }}
                    </v-list-subheader>

                    <!-- Publish/Unpublish (Priority #1) -->
                    <v-list-item
                      v-if="item.status === 'draft'"
                      prepend-icon="mdi-publish"
                      :title="t('pages.organizer.publish_event')"
                      @click="publishEvent(item.id)"
                    >
                      <template #append>
                        <v-chip
                          color="success"
                          label
                          size="x-small"
                          variant="tonal"
                        >
                          {{ t('pages.organizer.public') }}
                        </v-chip>
                      </template>
                    </v-list-item>
                    <v-list-item
                      v-else
                      prepend-icon="mdi-package-down"
                      :title="t('pages.organizer.unpublish_event')"
                      @click="unpublishEvent(item.id)"
                    >
                      <template #append>
                        <v-chip
                          color="warning"
                          label
                          size="x-small"
                          variant="tonal"
                        >
                          {{ t('pages.organizer.private') }}
                        </v-chip>
                      </template>
                    </v-list-item>

                    <v-list-item
                      prepend-icon="mdi-pencil"
                      :title="t('pages.organizer.edit_event')"
                      @click="router.push({ name: 'event-edit', params: { eventId: item.id } })"
                    />
                    <v-list-item
                      prepend-icon="mdi-ticket"
                      :title="t('pages.organizer.manage_tickets')"
                      @click="router.push({ name: 'event-tickets', params: { eventId: item.id } })"
                    />
                    <v-list-item
                      prepend-icon="mdi-plus"
                      :title="t('pages.organizer.import_attendees')"
                      @click="router.push({ name: 'import', params: { eventId: item.id, variant: 'main' } })"
                    />
                    <v-list-item
                      prepend-icon="mdi-ticket-percent-outline"
                      :title="t('pages.organizer.promo_codes')"
                      @click="router.push({ name: 'event-promo-codes', params: { eventId: item.id } })"
                    />
                    <v-list-item
                      prepend-icon="mdi-cog"
                      :title="t('pages.organizer.config.title')"
                      @click="router.push({ name: 'event-config', params: { eventId: item.id } })"
                    />
                    <v-list-item
                      prepend-icon="mdi-account-group"
                      :title="t('pages.organizer.staff_mgmt')"
                      @click="router.push({ name: 'event-staff', params: { eventId: item.id } })"
                    />
                    <v-list-item
                      prepend-icon="mdi-account-eye"
                      :title="t('pages.organizer.view_visitors')"
                      @click="router.push({ name: 'event-visitors', params: { eventId: item.id } })"
                    >
                      <template #append>
                        <v-chip
                          color="info"
                          label
                          size="x-small"
                          variant="tonal"
                        >
                          {{ t('pages.organizer.insights') }}
                        </v-chip>
                      </template>
                    </v-list-item>

                    <v-divider class="my-2" />

                    <!-- Group 2: Commerce -->
                    <v-list-subheader class="text-uppercase font-weight-bold letter-spacing-1 opacity-70" style="font-size: 0.65rem;">
                      {{ t('pages.organizer.commerce') }}
                    </v-list-subheader>
                    <v-list-item
                      prepend-icon="mdi-store"
                      :title="t('pages.organizer.manage_shop')"
                      @click="router.push({ name: 'event-manage-shop', params: { eventId: item.id } })"
                    />
                    <v-list-item
                      prepend-icon="mdi-package-variant"
                      :title="t('pages.organizer.product_orders')"
                      @click="router.push({ name: 'dashboard-organizer-event-product-orders', params: { eventId: item.id } })"
                    />

                    <v-divider class="my-2" />

                    <!-- Group 3: Danger Zone -->
                    <v-list-subheader class="text-uppercase font-weight-bold letter-spacing-1 text-error" style="font-size: 0.65rem;">
                      {{ t('pages.organizer.danger_zone') }}
                    </v-list-subheader>
                    <confirmation-dialog @confirm="deleteEvent(item.id)">
                      <template #activator="{ onClick }">
                        <v-list-item
                          class="text-error"
                          prepend-icon="mdi-delete"
                          :title="t('pages.organizer.delete_event')"
                          @click.stop="onClick"
                        />
                      </template>
                    </confirmation-dialog>
                  </v-list>
                </v-menu>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Pagination -->
      <div
        v-if="pagination.totalPages > 1"
        class="pagination-container"
      >
        <v-pagination
          v-model="currentPage"
          :length="pagination.totalPages"
          :total-visible="7"
          @update:model-value="onPageChange"
        />
      </div>
    </template>

    <!-- Empty State -->
    <v-row v-else>
      <v-col cols="12">
        <v-card
          class="empty-state-card"
          elevation="2"
          :rounded="rounded"
        >
          <AppNoData
            icon="mdi-calendar-plus"
            :message="t('pages.organizer.no_events_msg')"
            :title="t('pages.organizer.no_events_title')"
          >
            <template #actions>
              <v-btn
                color="primary"
                prepend-icon="mdi-plus"
                :rounded="rounded"
                :to="{ name: 'event-add' }"
                variant="flat"
              >
                {{ t('pages.organizer.create_event') }}
              </v-btn>
            </template>
          </AppNoData>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.organizer-dashboard {
  padding-bottom: 64px;
}

.event-card {
  position: relative;
  background: rgba(var(--v-theme-surface), 0.7) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 20px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.event-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.event-accent-bar {
  position: absolute;
  top: 20px;
  bottom: 20px;
  left: 0;
  width: 4px;
  background: rgb(var(--v-theme-primary));
  opacity: 0.8;
  border-radius: 0 4px 4px 0;
  z-index: 5;
  transition: background 0.3s ease;
}

.event-accent-bar.accent-published {
  background: rgb(var(--v-theme-success));
}

.event-accent-bar.accent-draft {
  background: rgb(var(--v-theme-warning));
}

.event-image {
  position: relative;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.event-title {
  font-size: 1.5rem;
  font-weight: 800;
  color: #ffffff;
  line-height: 1.2;
  letter-spacing: -0.02em;
}

.event-details {
  color: rgba(255, 255, 255, 0.6);
}

.status-badge {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 2;
  backdrop-filter: blur(8px);
  font-weight: 700;
  letter-spacing: 0.5px;
}

.view-button {
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 2;
  backdrop-filter: blur(8px);
  background: rgba(var(--v-theme-info), 0.8) !important;
  font-weight: 700;
}

.empty-state-card {
  border-radius: 20px;
  max-width: 500px;
  margin: 0 auto;
}

.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }

/* Pagination Styles */
.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 40px;
  padding: 20px 0;
}

.pagination-container .v-pagination {
  background: transparent;
}

/* Responsive Design */
@media (max-width: 768px) {
  .organizer-dashboard {
    padding-bottom: 32px;
  }

  .d-flex.gap-3 {
    flex-direction: column;
    gap: 12px !important;
  }
}
</style>
