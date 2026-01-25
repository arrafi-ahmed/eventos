<script setup>
  import PageTitle from '@/components/PageTitle.vue'

  definePage({
    name: 'terms',
    meta: {
      layout: 'default',
      title: 'Terms and Conditions',
    },
  })
</script>

<template>
  <v-container class="terms-container">
    <PageTitle
      subtitle="Please read these terms carefully before using our service"
      title="Terms and Conditions"
    />

    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card :rounded="true">
          <v-card-text class="pa-6">
            <div class="terms-content">
              <!-- <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  1. Acceptance of Terms
                </h2>
                <p class="text-body-1 mb-2">
                  By accessing and using LuxTicket, you accept and agree to be bound by the terms and provision of this agreement.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  2. Use License
                </h2>
                <p class="text-body-1 mb-2">
                  Permission is granted to temporarily use LuxTicket for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
                </p>
                <ul class="ml-4 mb-2">
                  <li>modify or copy the materials</li>
                  <li>use the materials for any commercial purpose or for any public display</li>
                  <li>attempt to reverse engineer any software contained on LuxTicket</li>
                  <li>remove any copyright or other proprietary notations from the materials</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  3. Event Tickets and Purchases
                </h2>
                <p class="text-body-1 mb-2">
                  When purchasing tickets through LuxTicket:
                </p>
                <ul class="ml-4 mb-2">
                  <li>All sales are final unless otherwise stated by the event organizer</li>
                  <li>Ticket prices are set by event organizers and may be subject to change</li>
                  <li>You are responsible for ensuring the accuracy of your purchase information</li>
                  <li>Refunds are subject to the event organizer's refund policy</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  4. User Accounts
                </h2>
                <p class="text-body-1 mb-2">
                  You are responsible for:
                </p>
                <ul class="ml-4 mb-2">
                  <li>Maintaining the confidentiality of your account credentials</li>
                  <li>All activities that occur under your account</li>
                  <li>Providing accurate and current information</li>
                  <li>Notifying us immediately of any unauthorized use</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  5. Prohibited Uses
                </h2>
                <p class="text-body-1 mb-2">
                  You may not use LuxTicket:
                </p>
                <ul class="ml-4 mb-2">
                  <li>In any way that violates any applicable law or regulation</li>
                  <li>To transmit any malicious code or viruses</li>
                  <li>To impersonate or attempt to impersonate the company or any other entity</li>
                  <li>In any way that infringes upon the rights of others</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  6. Limitation of Liability
                </h2>
                <p class="text-body-1 mb-2">
                  In no event shall LuxTicket or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on LuxTicket.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  7. Changes to Terms
                </h2>
                <p class="text-body-1 mb-2">
                  LuxTicket may revise these terms of service at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  8. Contact Information
                </h2>
                <p class="text-body-1 mb-2">
                  If you have any questions about these Terms and Conditions, please contact us at:
                </p>
                <p class="text-body-1">
                  Email: contact@luxticket.com<br>
                  Phone: +1 (555) 123-4567
                </p>
              </section>

              <section class="mb-4">
                <p class="text-caption text-medium-emphasis">
                  Last updated: {{ new Date().toLocaleDateString() }}
                </p>
              </section> -->
              Demo content
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.terms-container {
  min-height: calc(100vh - 64px);
  padding: 24px;
}

.terms-content {
  line-height: 1.8;
}

.terms-content ul {
  list-style-type: disc;
}

.terms-content li {
  margin-bottom: 8px;
}

@media (max-width: 768px) {
  .terms-container {
    padding: 16px;
  }
}
</style>
