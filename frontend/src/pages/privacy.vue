<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import PageTitle from '@/components/PageTitle.vue'

  const { t } = useI18n()

  definePage({
    name: 'privacy',
    meta: {
      layout: 'default',
      title: 'Privacy Policy',
      titleKey: 'pages.privacy.title',
    },
  })

  const ui = computed(() => ({
    title: t('footer.privacy_policy'),
    subtitle: t('common.legal.privacy_subtitle'),
  }))
</script>

<template>
  <v-container class="privacy-container">
    <PageTitle
      :subtitle="ui.subtitle"
      :title="ui.title"
      :title-key="'pages.privacy.title'"
    />

    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card :rounded="true">
          <v-card-text class="pa-6">
            <div class="privacy-content">
              <!-- <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  1. Introduction
                </h2>
                <p class="text-body-1 mb-2">
                  LuxTicket ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  2. Information We Collect
                </h2>
                <h3 class="text-h6 mb-2 mt-4">
                  Personal Information
                </h3>
                <p class="text-body-1 mb-2">
                  We may collect personal information that you provide to us, including:
                </p>
                <ul class="ml-4 mb-4">
                  <li>Name and contact information (email address, phone number)</li>
                  <li>Billing and shipping addresses</li>
                  <li>Payment information (processed securely through third-party providers)</li>
                  <li>Account credentials</li>
                </ul>

                <h3 class="text-h6 mb-2 mt-4">
                  Automatically Collected Information
                </h3>
                <p class="text-body-1 mb-2">
                  We may automatically collect certain information when you use our service:
                </p>
                <ul class="ml-4 mb-2">
                  <li>Device information and identifiers</li>
                  <li>IP address and location data</li>
                  <li>Browser type and version</li>
                  <li>Usage data and analytics</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  3. How We Use Your Information
                </h2>
                <p class="text-body-1 mb-2">
                  We use the information we collect to:
                </p>
                <ul class="ml-4 mb-2">
                  <li>Process and manage your ticket purchases</li>
                  <li>Provide customer support and respond to inquiries</li>
                  <li>Send you important updates about events and your purchases</li>
                  <li>Improve our services and user experience</li>
                  <li>Detect and prevent fraud or abuse</li>
                  <li>Comply with legal obligations</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  4. Information Sharing and Disclosure
                </h2>
                <p class="text-body-1 mb-2">
                  We may share your information with:
                </p>
                <ul class="ml-4 mb-2">
                  <li><strong>Event Organizers:</strong> Information necessary for event management and check-in</li>
                  <li><strong>Payment Processors:</strong> To process your transactions securely</li>
                  <li><strong>Service Providers:</strong> Third-party services that help us operate our platform</li>
                  <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  5. Data Security
                </h2>
                <p class="text-body-1 mb-2">
                  We implement appropriate technical and organizational security measures to protect your personal information. However, no method of transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  6. Your Rights
                </h2>
                <p class="text-body-1 mb-2">
                  Depending on your location, you may have the right to:
                </p>
                <ul class="ml-4 mb-2">
                  <li>Access your personal information</li>
                  <li>Correct inaccurate data</li>
                  <li>Request deletion of your data</li>
                  <li>Object to processing of your data</li>
                  <li>Data portability</li>
                  <li>Withdraw consent where applicable</li>
                </ul>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  7. Cookies and Tracking Technologies
                </h2>
                <p class="text-body-1 mb-2">
                  We use cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  8. Children's Privacy
                </h2>
                <p class="text-body-1 mb-2">
                  Our service is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  9. Changes to This Privacy Policy
                </h2>
                <p class="text-body-1 mb-2">
                  We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.
                </p>
              </section>

              <section class="mb-6">
                <h2 class="text-h5 mb-3">
                  10. Contact Us
                </h2>
                <p class="text-body-1 mb-2">
                  If you have any questions about this Privacy Policy, please contact us at:
                </p>
                <p class="text-body-1">
                  Email: contact@luxticket.com<br>
                  Phone: +1 (555) 123-4567<br>
                  Address: 123 Event Street, City, Country 12345
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
.privacy-container {
  min-height: calc(100vh - 64px);
}

.privacy-content {
  line-height: 1.8;
}

.privacy-content ul {
  list-style-type: disc;
}

.privacy-content li {
  margin-bottom: 8px;
}

</style>
