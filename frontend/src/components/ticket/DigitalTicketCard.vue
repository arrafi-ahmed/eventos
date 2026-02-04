<script setup>
  import QRCodeVue3 from 'qrcode-vue3'
  import { computed } from 'vue'
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
    // Branding props
    logo: String,
    logoPosition: {
      type: String,
      default: 'left',
    },
    primaryColor: {
      type: String,
      default: '#ED2939',
    },
    appName: {
      type: String,
      default: 'Ticketi',
    },
  })

  const qrValue = computed(() => {
    return generateQrData({
      registrationId: props.registrationId,
      attendeeId: props.attendee.id,
      qrUuid: props.qrUuid,
    })
  })

  const ticketUuidDisplay = computed(() => {
    return (props.qrUuid || '').split('-')[0].toUpperCase()
  })
</script>

<template>
  <div class="premium-ticket-wrapper">
    <div class="premium-ticket">
      <!-- Header -->
      <div class="ticket-header" :style="{ textAlign: logoPosition }">
        <img v-if="logo" :src="logo" alt="Logo" class="logo-img">
        <span class="event-name-overline">Event Entry</span>
        <h1 class="ticket-title" :style="{ color: primaryColor }">{{ eventName }}</h1>
        <svg class="header-icon" :style="{ color: primaryColor }" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13,8.5H11V6.5H13V8.5M13,13H11V11H13V13M13,17.5H11V15.5H13V17.5M22,10V6C22,4.89 21.1,4 20,4H4A2,2 0 0,0 2,6V10C3.11,10 4,10.9 4,12C4,13.11 3.11,14 2,14V18C2,19.11 2.9,20 4,20H20C21.11,20 22,19.11 22,18V14C20.9,14 20,13.11 20,12C20,10.9 20.9,10 22,10Z" />
        </svg>
      </div>

      <!-- Divider -->
      <div class="ticket-divider">
        <div class="ticket-cutout left" />
        <div class="ticket-line" />
        <div class="ticket-cutout right" />
      </div>

      <!-- Body -->
      <div class="ticket-body">
        <div class="attendee-info">
          <div class="label">Attendee</div>
          <div class="name">{{ attendee.firstName }} {{ attendee.lastName }}</div>
          <div class="ticket-type-badge" :style="{ backgroundColor: primaryColor }">{{ ticketTitle }}</div>

          <div class="contact">
            <svg v-if="attendee.email" class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 6C22 4.9 21.1 4 20 4H4C2.9 4 2 4.9 2 6V18C2 19.1 2.9 20 4 20H20C21.1 20 22 19.1 22 18V6M20 6L12 11L4 6H20M20 18H4V8L12 13L20 8V18Z" />
            </svg>
            <svg v-else class="contact-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20,15.5C18.8,15.5 17.5,15.3 16.4,14.9C16.3,14.9 16.2,14.9 16.1,14.9C15.8,14.9 15.6,15 15.4,15.2L13.2,17.4C10.4,15.9 8,13.6 6.6,10.8L8.8,8.6C9,8.4 9.1,8.2 9.1,7.9C9.1,7.8 9,7.7 9,7.6C8.6,6.5 8.4,5.2 8.4,4C8.4,3.4 8,3 7.4,3H4C3.4,3 3,3.4 3,4C3,13.4 10.6,21 20,21C20.6,21 21,20.6 21,20V16.6C21,16 20.6,15.5 20,15.5M5,5H7.1C7.2,6 7.4,7 7.7,8L6.3,9.4C5.7,7.9 5.3,6.5 5.1,5M19,19C17.5,18.8 16.1,18.3 14.6,17.7L16,16.3C17,16.6 18,16.8 19,16.9V19Z" />
            </svg>
            <span>{{ attendee.email || attendee.phone || attendee.phoneNumber || 'N/A' }}</span>
          </div>

          <div class="meta-section">
            <div v-if="startDate" class="meta-item">
              <svg class="meta-icon" :style="{ color: primaryColor }" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15,13H16.5V15.82L18.94,17.23L18.19,18.53L15,16.69V13M19,8H5V19H19V8M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M19,5V6H5V5H19Z" />
              </svg>
              <div class="meta-content">
                <span class="meta-label">Date & Time</span>
                <span class="meta-value">{{ new Date(startDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) }}</span>
              </div>
            </div>
            <div v-if="location" class="meta-item">
              <svg class="meta-icon" :style="{ color: primaryColor }" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5M12,2A7,7 0 0,1 19,9C19,14.25 12,22 12,22C12,22 5,14.25 5,9A7,7 0 0,1 12,2M12,4A5,5 0 0,0 7,9C7,10 7,12 12,18.71C17,12 17,10 17,9A5,5 0 0,0 12,4Z" />
              </svg>
              <div class="meta-content">
                <span class="meta-label">Location</span>
                <span class="meta-value">{{ location }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="qr-section">
          <div class="qr-frame">
            <QRCodeVue3
              :corners-square-options="{ type: 'square', color: '#000000' }"
              :dots-options="{ type: 'square', color: '#000000' }"
              :height="150"
              :value="qrValue"
              :width="150"
            />
          </div>
          <div class="ticket-uuid">#{{ ticketUuidDisplay }}</div>
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="scan-text">SCAN AT ENTRY</div>
        <div class="powered-by">Powered by {{ appName }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.premium-ticket-wrapper {
  filter: drop-shadow(0 10px 15px rgba(0, 0, 0, 0.1));
  width: 100%;
  max-width: 650px;
  margin: 0 auto;
}

.premium-ticket {
  background: #ffffff !important;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  position: relative;
  color: #000000 !important; /* Force black text */
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}

/* Header */
.ticket-header {
  padding: 32px;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  border-bottom: 1px solid #e2e8f0;
  position: relative;
}

.header-icon {
  position: absolute;
  top: 32px;
  right: 32px;
  width: 32px;
  height: 32px;
}

.logo-img {
  max-height: 50px;
  width: auto;
  margin-bottom: 12px;
}

.event-name-overline {
  font-size: 11px;
  font-weight: 800;
  color: #000000; /* Force black for contrast */
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 4px;
  display: block;
}

.ticket-title {
  font-size: 24px;
  font-weight: 800;
  line-height: 1.2;
  margin: 0;
  letter-spacing: -0.02em;
}

/* Divider */
.ticket-divider {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: -20px 0;
  z-index: 10;
}

.ticket-line {
  width: 90%;
  height: 0;
  border-bottom: 2px dashed #cbd5e1;
}

.ticket-cutout {
  position: absolute;
  width: 32px;
  height: 32px;
  background: white; /* Matches common dialog background */
  border: 1px solid #e2e8f0;
  border-radius: 50%;
  top: 50%;
  margin-top: -16px;
}

.ticket-cutout.left { left: -16px; }
.ticket-cutout.right { right: -16px; }

/* Body */
.ticket-body {
  padding: 32px;
  display: flex;
  background: white !important;
}

.attendee-info {
  flex: 7;
  padding-right: 24px;
  min-width: 0; /* Prevents overflow */
}

.label {
  font-size: 10px;
  font-weight: 700;
  color: #000000;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 4px;
}

.name {
  font-size: 22px;
  font-weight: 800;
  color: #000000 !important;
  margin-bottom: 12px;
  letter-spacing: -0.01em;
  word-break: break-word;
}

.ticket-type-badge {
  display: inline-block;
  padding: 4px 12px;
  color: #ffffff !important;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 700;
  margin-bottom: 20px;
}

.contact {
  display: flex;
  align-items: center;
  font-size: 14px;
  color: #000000;
  margin-bottom: 24px;
}

.contact-icon {
  width: 18px;
  height: 18px;
  margin-right: 10px;
  color: #000000;
}

.meta-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border-top: 1px solid #e2e8f0;
  padding-top: 20px;
}

.meta-item {
  display: flex;
  align-items: center;
}

.meta-icon {
  width: 20px;
  height: 20px;
  margin-right: 12px;
}

.meta-content {
  display: flex;
  flex-direction: column;
}

.meta-label {
  font-size: 9px;
  font-weight: 700;
  color: #000000;
  text-transform: uppercase;
}

.meta-value {
  font-size: 13px;
  font-weight: 600;
  color: #000000 !important;
}

/* QR Section */
.qr-section {
  flex: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-left: 1px solid #e2e8f0;
  padding-left: 24px;
}

.qr-frame {
  padding: 12px;
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.ticket-uuid {
  margin-top: 10px;
  font-size: 10px;
  color: #64748b;
  font-family: monospace;
  font-weight: 600;
}

/* Footer */
.footer {
  background: #f8fafc;
  padding: 20px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}

.scan-text {
  font-size: 10px;
  font-weight: 800;
  color: #000000;
  text-transform: uppercase;
  letter-spacing: 0.2em;
}

.powered-by {
  margin-top: 6px;
  font-size: 9px;
  color: #64748b;
  font-weight: 600;
}

/* Responsive Overrides */
@media (max-width: 600px) {
  .ticket-body {
    flex-direction: column;
  }
  .qr-section {
    border-left: none;
    border-top: 1px solid #e2e8f0;
    padding-left: 0;
    padding-top: 24px;
    margin-top: 24px;
    width: 100%;
  }
  .attendee-info {
    padding-right: 0;
    margin-bottom: 0;
    width: 100%;
  }
}

@media print {
  .premium-ticket-wrapper {
    filter: none !important;
    box-shadow: none !important;
    max-width: 700px !important;
    margin: 0 !important;
    width: 100% !important;
  }
  .premium-ticket {
    border: 1px solid #000 !important; /* Darker border for print */
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .ticket-cutout {
    background: white !important;
    border: 1px solid #000 !important;
  }
  .ticket-line {
    border-bottom: 2px dashed #000 !important;
  }
  .qr-frame {
    box-shadow: none !important;
    border: 1px solid #000 !important;
  }
}
</style>
