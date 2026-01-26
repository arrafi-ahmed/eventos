<script setup>
  import QRCodeVue3 from 'qrcode-vue3'
  import { computed, onMounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { generateQrData } from '@/utils'

  definePage({
    name: 'qr-viewer',
    meta: {
      layout: 'default',
      title: 'Your QR Code',
      requiresOrganizer: true,
    },
  })

  const store = useStore()
  const route = useRoute()
  const router = useRouter()
  const { rounded, variant } = useUiProps()

  const eventId = computed(() => route.params.eventId)
  const registrationId = computed(() => route.params.registrationId)
  const attendeeId = computed(() => route.params.attendeeId)
  const qrUuid = computed(() => route.params.qrUuid)

  const loading = ref(true)
  const attendee = ref(null)

  const qrOptions = {
    type: 'dot',
    color: '#000000',
  }

  async function fetchData () {
    loading.value = true
    try {
      const regRes = await store.dispatch('registration/getRegistrationById', { registrationId: registrationId.value })
      if (regRes && regRes.attendees) {
        attendee.value = regRes.attendees.find(a => a.id == attendeeId.value || a.attendeeId == attendeeId.value)
      }
    } catch (error) {
      console.error('Failed to fetch QR details:', error)
    } finally {
      loading.value = false
    }
  }

  function goBack () {
    router.back()
  }

  onMounted(() => {
    fetchData()
  })
</script>

<template>
  <v-container class="pb-12">
    <!-- Title Section -->
    <PageTitle
      :back-route="{ name: 'event-attendees', params: { eventId } }"
      subtitle="Show this QR code at the entrance for scanning"
      title="Your QR Code"
    />

    <v-row class="mt-4" justify="center">
      <v-col cols="12" lg="4" md="6" sm="8">
        <v-card
          v-if="attendeeId && qrUuid"
          class="pa-8 text-center"
          elevation="4"
          :loading="loading"
          :rounded="rounded"
        >
          <div v-if="!loading && attendee" class="mb-6">
            <h2 class="text-h5 font-weight-bold">{{ attendee.firstName }} {{ attendee.lastName }}</h2>
            <v-chip class="mt-2 font-weight-bold" color="primary" size="small" variant="flat">
              {{ attendee.ticket?.title || attendee.ticketTitle || 'General Admission' }}
            </v-chip>
          </div>

          <div class="qr-wrapper pa-4 bg-white rounded-lg d-inline-block elevation-2">
            <QRCodeVue3
              v-if="attendeeId && qrUuid"
              :corners-square-options="qrOptions"
              :dots-options="qrOptions"
              :download="true"
              download-button="v-btn v-btn--block bg-primary mt-6 v-btn--size-default"
              :height="240"
              :value="generateQrData({ registrationId, attendeeId, qrUuid })"
              :width="240"
            />
          </div>

          <p class="text-caption text-grey mt-6 font-weight-medium">
            Scan to check-in
          </p>
        </v-card>

        <v-alert
          v-else-if="!loading"
          class="mt-4"
          text="Invalid QR Code data provided"
          type="error"
          variant="tonal"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.qr-wrapper {
  border: 1px solid #eee;
  background: white;
}
</style>
