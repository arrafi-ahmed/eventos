<script setup>
  import { computed, ref } from 'vue'
  import { useTheme } from 'vuetify'
  import DigitalTicketCard from '@/components/ticket/DigitalTicketCard.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatPrice } from '@/utils'

  const { rounded, density, variant } = useUiProps()
  const theme = useTheme()

  const props = defineProps({
    modelValue: Boolean,
    saleData: Object,
    event: Object,
    cartItems: {
      type: Array,
      default: () => [],
    },
  })

  const emit = defineEmits(['update:modelValue'])

  const dialog = computed({
    get: () => props.modelValue,
    set: val => emit('update:modelValue', val),
  })

  const shareDialog = ref(false)
  const shareEmail = ref('')
  const sharing = ref(false)

  // QR Code options matching app style
  const qrOptions = {
    type: 'dot',
    color: '#000000',
  }

  const ticketItems = computed(() => {
    return props.cartItems.filter(item => item.type === 'ticket')
  })

  function handlePrint () {
    const content = document.querySelector('.printable-tickets')
    if (!content) return

    // Create temporary iframe for isolated printing
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.append(iframe)

    const doc = iframe.contentWindow.document

    // Clone all styles from main document to guarantee look and feel
    let styles = ''
    for (const el of document.querySelectorAll('style, link[rel="stylesheet"]')) {
      styles += el.outerHTML
    }

    // Add specific print optimizations for the isolated view
    const printStyles = `
    <style>
      @page { size: auto; margin: 10mm; }
      body { margin: 0; padding: 0; background: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .printable-tickets { padding: 0 !important; }
      .digital-ticket-wrapper { box-shadow: none !important; filter: none !important; margin-bottom: 30px; page-break-inside: avoid; }
      .digital-ticket { border: 1px solid #eee !important; }
      .bg-surface-light { background-color: #f8fafc !important; }
      .text-primary { color: #ED2939 !important; }
      .v-icon { color: #ED2939 !important; }
      .border-t { border-top: 1px solid #eee !important; }
    </style>
  `

    doc.open()
    doc.write('<html><head>' + styles + printStyles + '</head><body>')
    doc.write(content.innerHTML)
    doc.write('</body></html>')
    doc.close()

    // Wait for resources (fonts, etc.) to load then print
    iframe.contentWindow.addEventListener('load', () => {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
      // Cleanup
      setTimeout(() => {
        iframe.remove()
      }, 1000)
    })
  }

  function openShareDialog () {
    shareDialog.value = true
  }

  async function handleShare () {
    if (!shareEmail.value || !props.saleData?.registrationId) return

    sharing.value = true
    try {
      await $axios.post('/email/resendTickets', {
        registrationId: props.saleData.registrationId,
        email: shareEmail.value,
      })

      shareDialog.value = false
      shareEmail.value = ''
      dialog.value = false
    } catch (error) {
      console.error('Share failed:', error)
    } finally {
      sharing.value = false
    }
  }

  function handleClose () {
    dialog.value = false
  }
</script>

<template>
  <v-dialog v-model="dialog" max-width="600" scrollable>
    <v-card class="overflow-hidden border no-print-shadow" :rounded="rounded">
      <v-toolbar class="no-print border-b" color="surface" density="compact">
        <v-toolbar-title class="text-subtitle-1 font-weight-bold">Ticket Preview</v-toolbar-title>
        <v-spacer />
        <v-btn icon="mdi-close" size="small" variant="text" @click="handleClose" />
      </v-toolbar>

      <v-card-text class="pa-0 bg-surface-variant ticket-preview-content">
        <!-- Ticket Container -->
        <div class="tickets-preview-wrapper pa-6 pa-md-8 printable-tickets">
          <div v-for="attendee in saleData?.attendees" :key="attendee.id" class="mb-4">
            <DigitalTicketCard
              :attendee="attendee"
              :event-name="event?.name || 'Event'"
              :location="event?.location"
              :qr-uuid="attendee.qrUuid"
              :registration-id="saleData?.registrationId"
              :start-date="event?.startDatetime || event?.startDate || event?.start_datetime"
              :ticket-title="attendee.ticketTitle || 'Event Entry'"
            />
          </div>
        </div>
      </v-card-text>

      <v-divider class="no-print" />

      <!-- Final Actions -->
      <v-card-actions class="pa-6 bg-surface no-print">
        <v-row dense>
          <v-col cols="12" sm="6">
            <v-btn
              block
              class="text-none font-weight-bold"
              color="secondary"
              prepend-icon="mdi-printer"
              :rounded="rounded"
              size="large"
              variant="outlined"
              @click="handlePrint"
            >
              Print Tickets
            </v-btn>
          </v-col>
          <v-col class="mt-4 mt-sm-0" cols="12" sm="6">
            <v-btn
              block
              class="text-none font-weight-bold"
              color="primary"
              prepend-icon="mdi-share-variant"
              :rounded="rounded"
              size="large"
              variant="flat"
              @click="openShareDialog"
            >
              Share via Email
            </v-btn>
          </v-col>
        </v-row>
      </v-card-actions>
    </v-card>

    <!-- Share Dialog -->
    <v-dialog v-model="shareDialog" max-width="450">
      <v-card :rounded="rounded">
        <v-card-title class="pa-6 text-h5 font-weight-bold">Complete your share</v-card-title>
        <v-card-text class="pa-6 pt-0">
          <p class="text-body-1 text-medium-emphasis mb-6">Send the generated tickets directly to the customer's inbox.</p>
          <v-text-field
            v-model="shareEmail"
            :density="density"
            hide-details
            label="Customer Email Address"
            placeholder="example@email.com"
            prepend-inner-icon="mdi-email-outline"
            :rounded="rounded"
            type="email"
            :variant="variant"
          />
        </v-card-text>
        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn :rounded="rounded" size="large" variant="text" @click="shareDialog = false">Cancel</v-btn>
          <v-btn
            color="primary"
            :disabled="!shareEmail"
            :loading="sharing"
            :rounded="rounded"
            size="large"
            variant="flat"
            @click="handleShare"
          >
            Send Tickets
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-dialog>
</template>

<style scoped>
.tickets-preview-wrapper {
  max-width: 600px;
  margin-left: auto;
  margin-right: auto;
}

.no-print-shadow {
  box-shadow: none !important;
}

@media print {
  .no-print {
    display: none !important;
  }
}
</style>
