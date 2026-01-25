<script setup>
  import QRCodeVue3 from 'qrcode-vue3'
  import { computed, ref } from 'vue'
  import $axios from '@/plugins/axios'
  import { generateQrData } from '@/utils'

  const props = defineProps({
    attendee: {
      type: Object,
      required: true,
    },
    ticketTitle: {
      type: String,
      default: 'Event Entry',
    },
    eventName: {
      type: String,
      default: 'Event Name',
    },
    registrationId: {
      type: [String, Number],
      required: true,
    },
    qrUuid: {
      type: String,
      required: true,
    },
    startDate: {
      type: String,
      default: '',
    },
    location: {
      type: String,
      default: '',
    },
  })

  // QR Code options
  const qrOptions = {
    type: 'square',
    color: '#000000',
    backgroundOptions: {
      color: '#ffffff',
    },
  }

  const qrValue = computed(() => {
    return generateQrData({
      registrationId: props.registrationId,
      attendeeId: props.attendee.id,
      qrUuid: props.qrUuid,
    })
  })

  const isDownloading = ref(false)

  async function downloadTicket () {
    try {
      isDownloading.value = true
      const response = await $axios.get(`/registration/download-ticket/${props.attendee.id}/${props.qrUuid}`, {
        responseType: 'blob',
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const link = document.createElement('a')
      link.href = window.URL.createObjectURL(blob)
      link.download = `ticket-${props.qrUuid.split('-')[0]}.pdf`
      document.body.append(link)
      link.click()
      link.remove()
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      isDownloading.value = false
    }
  }
</script>

<template>
  <div class="digital-ticket-wrapper">
    <div class="digital-ticket">
      <!-- Ticket Header -->
      <div class="ticket-header pa-4 d-flex justify-space-between align-center bg-surface-light">
        <div>
          <div class="text-overline font-weight-bold text-medium-emphasis mb-0 tracking-wide line-height-1">
            Event Entry
          </div>
          <div class="text-h6 font-weight-black text-uppercase text-primary line-height-1 mt-1">
            {{ eventName }}
          </div>
        </div>
        <v-icon color="primary" size="28">mdi-ticket-confirmation</v-icon>
      </div>

      <!-- Divider with Cutouts -->
      <div class="ticket-divider">
        <div class="ticket-cutout left" />
        <div class="ticket-line" />
        <div class="ticket-cutout right" />
      </div>

      <!-- Ticket Body -->
      <div class="ticket-body pa-4">
        <v-row align="center" no-gutters>
          <v-col class="pr-2" cols="7">
            <div class="text-caption text-medium-emphasis font-weight-bold text-uppercase mb-1">Attendee</div>
            <div class="text-h6 font-weight-bold mb-0 text-truncate text-high-emphasis">
              {{ attendee.firstName }} {{ attendee.lastName }}
            </div>
            <div class="text-caption font-weight-black text-primary text-uppercase mb-3">
              {{ ticketTitle }}
            </div>

            <div class="d-flex align-center text-body-2 text-medium-emphasis">
              <v-icon class="mr-2" size="16">{{ attendee.email ? 'mdi-email-outline' : 'mdi-phone-outline' }}</v-icon>
              <span class="text-truncate mr-1">{{ attendee.email || attendee.phone || attendee.phoneNumber || 'N/A' }}</span>
            </div>

            <!-- Date & Location Row -->
            <div v-if="startDate || location" class="mt-4 pt-4 border-t opacity-80">
              <div v-if="startDate" class="d-flex align-center text-caption text-medium-emphasis mb-1">
                <v-icon class="mr-2" color="primary" size="14">mdi-calendar-clock-outline</v-icon>
                <span class="font-weight-bold">{{ new Date(startDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) }}</span>
              </div>
              <div v-if="location" class="d-flex align-center text-caption text-medium-emphasis">
                <v-icon class="mr-2" color="primary" size="14">mdi-map-marker-outline</v-icon>
                <span class="text-truncate">{{ location }}</span>
              </div>
            </div>
          </v-col>

          <v-col class="d-flex justify-center" cols="5">
            <div class="qr-frame pa-3 bg-white rounded-lg elevation-1">
              <QRCodeVue3
                :corners-square-options="{ type: 'square', color: '#000000' }"
                :dots-options="{ type: 'square', color: '#000000' }"
                :height="150"
                :value="qrValue"
                :width="150"
              />
            </div>
          </v-col>
        </v-row>

        <v-divider class="my-4 opacity-10" />

        <div class="d-flex justify-center flex-column align-center">
          <div class="text-caption font-weight-bold text-uppercase text-medium-emphasis tracking-widest opacity-60">
            Scan at Entry
          </div>
        </div>
      </div>
    </div>

    <!-- Download Button outside the ticket container -->
    <div class="d-flex justify-center mt-4">
      <v-btn
        class="font-weight-bold px-8 rounded-pill"
        color="primary"
        :loading="isDownloading"
        prepend-icon="mdi-download-outline"
        size="default"
        variant="flat"
        @click="downloadTicket"
      >
        Download Ticket
      </v-btn>
    </div>
  </div>
</template>

<style scoped>
.digital-ticket-wrapper {
  filter: drop-shadow(0 8px 24px rgba(0,0,0,0.2));
}

.digital-ticket {
  background: rgb(var(--v-theme-surface));
  border-radius: 20px;
  overflow: hidden;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
}

.ticket-divider {
  position: relative;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
}

.ticket-line {
  width: 85%;
  height: 0;
  border-bottom: 2px dashed rgba(var(--v-theme-on-surface), 0.1);
}

.ticket-cutout {
  position: absolute;
  width: 24px;
  height: 24px;
  background: rgb(var(--v-theme-background)); /* Binds better to page background */
  border-radius: 50%;
  top: 50%;
  transform: translateY(-50%);
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.06);
}

/* Ensure cutouts blend with parent background */
:deep(.v-theme--light) .ticket-cutout {
    background: #f3f4f6; /* Common background color */
}

.ticket-cutout.left { left: -12px; }
.ticket-cutout.right { right: -12px; }

.tracking-wide { letter-spacing: 0.05em; }
.tracking-widest { letter-spacing: 0.15em; }
.line-height-1 { line-height: 1; }

@media print {
  /* Hide the download button container */
  .d-flex.justify-center.mt-4 {
    display: none !important;
  }
}
</style>
