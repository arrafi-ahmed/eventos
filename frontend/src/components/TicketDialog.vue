<script setup>
  import DigitalTicketCard from '@/components/ticket/DigitalTicketCard.vue'
  import { useUiProps } from '@/composables/useUiProps'

  const { rounded } = useUiProps()

  const props = defineProps({
    modelValue: {
      type: Boolean,
      default: false,
    },
    order: {
      type: Object,
      required: true,
    },
  })

  defineEmits(['update:modelValue'])

  function getTicketTitle(attendee) {
    if (!props.order?.itemsTicket?.length) return 'Entry Ticket'
    
    // If we can't match by ID (or ID is missing), and there's only one ticket type, use it
    if (props.order.itemsTicket.length === 1) {
      return props.order.itemsTicket[0].title || 'Entry Ticket'
    }

    if (!attendee.ticketId) return 'Entry Ticket'
    
    // Use loose equality to handle string/number mismatch
    const ticket = props.order.itemsTicket.find(t => t.ticketId == attendee.ticketId)
    return ticket?.title || 'Entry Ticket'
  }
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="600"
    @update:model-value="$emit('update:modelValue', $event)"
  >
    <v-card :rounded="rounded" class="pa-4">
      <v-card-title class="d-flex justify-space-between align-center px-2">
        <span class="text-h6 font-weight-bold">Your Tickets</span>
        <v-btn icon="mdi-close" variant="text" @click="$emit('update:modelValue', false)" />
      </v-card-title>

      <v-card-text class="pa-2">
        <div v-if="order?.customerData?.attendees?.length">
          <div
            v-for="(attendee, index) in order.customerData.attendees"
            :key="index"
            class="mb-4"
          >
            <DigitalTicketCard
              :attendee="attendee"
              :event-name="order.eventName"
              :location="order.eventLocation"
              :qr-uuid="attendee.qrUuid"
              :registration-id="order.registrationId"
              :start-date="order.eventDate"
              :ticket-title="getTicketTitle(attendee)"
            />
          </div>
        </div>
        <div v-else class="text-center py-8 text-medium-emphasis">
          <v-icon size="48" class="mb-2">mdi-ticket-off-outline</v-icon>
          <p>No ticket information found for this order.</p>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>
