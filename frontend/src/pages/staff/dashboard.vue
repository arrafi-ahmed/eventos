<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import AppNoData from '@/components/AppNoData.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { getEventImageUrl, getClientPublicImageUrl } from '@/utils'
  import $axios from '@/plugins/axios'

  definePage({
    name: 'staff-dashboard',
    meta: {
      layout: 'default',
      title: 'Staff Dashboard',
      titleKey: 'pages.staff.title',
      requiresAuth: true,
    },
  })

  const { rounded, density, variant, size } = useUiProps()
  const { t } = useI18n()
  const store = useStore()
  const router = useRouter()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const events = ref([])
  const loading = ref(true)

  const isCashier = computed(() => store.getters['auth/isCashier'])
  const isStaff = computed(() => store.getters['auth/isStaff'])

  async function loadAssignedEvents () {
    loading.value = true
    try {
      // Fetch all events assigned to this user (backend now handles the role logic)
      const result = await store.dispatch('event/setAssignedEvents')
      events.value = result || []
    } catch (error) {
      console.error('Error loading assigned events:', error)
    } finally {
      loading.value = false
    }
  }

  function goToPOS (eventId) {
    router.push({ 
      name: 'counter-shift-start',
      query: { eventId }
    })
  }

  function goToCheckin (eventId) {
    router.push({ 
      name: 'staff-checkin',
      query: { eventId }
    })
  }

  onMounted(() => {
    loadAssignedEvents()
  })
</script>

<template>
  <v-container>
    <PageTitle
      :subtitle="t('pages.staff.subtitle')"
      :title="t('pages.staff.my_events')"
    />

    <div v-if="loading" class="d-flex justify-center align-center py-12">
      <v-progress-circular color="primary" indeterminate size="64" />
    </div>

    <v-row v-else-if="events.length > 0">
      <v-col
        v-for="event in events"
        :key="event.id"
        cols="12"
        lg="4"
        md="6"
      >
        <v-card class="event-card h-100 d-flex flex-column" elevation="3" :rounded="rounded">
          <v-img
            class="align-end"
            cover
            height="150"
            :src="getEventImageUrl(event.banner)"
          />
          <v-card-text class="pa-6 flex-grow-1">
            <h2 class="text-h5 font-weight-bold mb-2">{{ event.name }}</h2>
            <div class="d-flex align-center mb-4 text-medium-emphasis">
              <v-icon class="mr-2" size="small">mdi-calendar</v-icon>
              <span class="text-body-2">{{ new Date(event.startDatetime).toLocaleDateString() }}</span>
            </div>
            
            <p v-if="event.description" class="text-body-2 text-medium-emphasis line-clamp-2 mb-4">
              {{ event.description }}
            </p>
          </v-card-text>

          <v-divider />

          <v-card-actions class="pa-4 bg-surface-variant">
            <v-btn
              v-if="isCashier"
              block
              class="mb-2"
              color="primary"
              prepend-icon="mdi-cash-register"
              :rounded="rounded"
              variant="flat"
              @click="goToPOS(event.id)"
            >
              {{ t('pages.staff.open_pos') }}
            </v-btn>
            <v-btn
              v-if="isStaff"
              block
              color="secondary"
              prepend-icon="mdi-qrcode-scan"
              :rounded="rounded"
              variant="flat"
              @click="goToCheckin(event.id)"
            >
              {{ t('pages.staff.checkin_tickets') }}
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <div v-else class="text-center py-12">
      <AppNoData
        icon="mdi-calendar-remove"
        :message="t('pages.staff.no_assigned_msg')"
        :title="t('pages.staff.no_assigned_title')"
      />
    </div>
  </v-container>
</template>

<style scoped>
.event-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.event-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12) !important;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
