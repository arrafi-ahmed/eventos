<script setup>
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatDateTime, formatPrice } from '@/utils'

  definePage({
    name: 'counter-sessions',
    meta: {
      layout: 'default',
      title: 'Session History',
      titleKey: 'pages.counter.history.title',
      requiresAuth: true,
    },
  })

  const { rounded, density, variant } = useUiProps()
  const { t } = useI18n()
  const store = useStore()
  const router = useRouter()

  const sessions = ref([])
  const loading = ref(false)
  const downloadingId = ref(null)

  const headers = [
    { key: 'openingTime', sortable: true },
    { key: 'closingTime', sortable: true },
    { key: 'eventName' },
    { key: 'cashierName' },
    { key: 'status', align: 'center' },
    { key: 'closingCash', align: 'end' },
    { key: 'actions', sortable: false, align: 'end' },
  ]

  async function fetchSessions () {
    loading.value = true
    try {
      const response = await $axios.get('/counter/sessions')
      sessions.value = response.data?.payload || []
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
      store.commit('addSnackbar', { text: t('common.error_load'), color: 'error' })
    } finally {
      loading.value = false
    }
  }

  async function downloadReport (session) {
    downloadingId.value = session.id
    try {
      const response = await $axios.get(
        `/counter/downloadSessionReport/${session.id}`,
        { responseType: 'blob' },
      )

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `session-report-${session.id}.pdf`
      document.body.append(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Download failed:', error)
      store.commit('addSnackbar', { text: t('common.error_download'), color: 'error' })
    } finally {
      downloadingId.value = null
    }
  }

  function formatDate (date, timezone) {
    return formatDateTime({
      input: date,
      timezone: timezone || store.state.auth.currentUser?.timezone,
      format: 'MMM DD, HH:mm',
    })
  }

  onMounted(() => {
    fetchSessions()
  })
</script>

<template>
  <v-container>
    <PageTitle
      :subtitle="t('pages.counter.history.subtitle')"
      :title="t('pages.counter.history.title')"
      :title-key="'pages.counter.history.title'"
    />

    <v-card class="mt-4" elevation="2" :rounded="rounded">
      <v-data-table
        class="elevation-0"
        :headers="headers"
        hover
        :items="sessions"
        :loading="loading"
      >
        <!-- Re-mapping header titles in template for cleaner script -->
        <template v-for="h in headers" :key="h.key" #[`header.${h.key}`]>
          {{ t(`pages.counter.history.headers.${h.key}`) }}
        </template>
        <template #item.openingTime="{ item }">
          <div class="font-weight-medium">{{ formatDate(item.openingTime, item.timezone) }}</div>
        </template>

        <template #item.closingTime="{ item }">
          <div>{{ formatDate(item.closingTime, item.timezone) }}</div>
        </template>

        <template #item.status="{ item }">
          <v-chip
            class="text-uppercase font-weight-bold"
            :color="item.status === 'open' ? 'success' : 'grey'"
            size="small"
            :variant="item.status === 'open' ? 'flat' : 'tonal'"
          >
            {{ item.status }}
          </v-chip>
        </template>

        <template #item.closingCash="{ item }">
          <span v-if="item.status === 'closed'" class="font-weight-bold">
            {{ formatPrice(item.closingCash, item.currency) }}
          </span>
          <span v-else class="text-grey italic">{{ t('pages.counter.history.active') }}</span>
        </template>

        <template #item.actions="{ item }">
          <v-btn
            color="primary"
            :disabled="item.status === 'open' || (downloadingId === item.id)"
            icon="mdi-file-download"
            :loading="downloadingId === item.id"
            size="small"
            :title="t('pages.counter.history.download')"
            variant="text"
            @click="downloadReport(item)"
          />
        </template>

        <template #no-data>
          <div class="py-12 text-center text-grey">
            <v-icon class="mb-4" size="64">mdi-history</v-icon>
            <div class="text-h6">{{ t('pages.counter.history.no_sessions') }}</div>
            <div class="text-caption">{{ t('pages.counter.history.history_hint') }}</div>
          </div>
        </template>
      </v-data-table>
    </v-card>
  </v-container>
</template>

<style scoped>
.italic {
  font-style: italic;
}
</style>
