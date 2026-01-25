<script setup>
  import { computed, onMounted, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatDateTime, formatPrice } from '@/utils'

  definePage({
    name: 'event-sponsorships',
    meta: {
      layout: 'default',
      title: 'Event Sponsorships',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const store = useStore()
  const route = useRoute()
  const router = useRouter()
  const { rounded, density } = useUiProps()

  const event = computed(() => store.getters['event/getEventById'](route.params.eventId))

  const sponsorships = computed(() => store.state.sponsorship.sponsorships)
  const isLoading = ref(false)

  // Get currency from event
  const eventCurrency = computed(() => {
    const currency = event.value?.currency
    if (currency && typeof currency === 'string' && currency.length === 3) {
      return currency.toUpperCase()
    }
    return 'USD'
  })

  // Format sponsor names for display
  function formatSponsorName (sponsorData) {
    if (!sponsorData) return 'N/A'
    const firstName = sponsorData.firstName || ''
    const lastName = sponsorData.lastName || ''
    if (firstName && lastName) {
      return `${firstName} ${lastName}`
    } else if (firstName) {
      return firstName
    } else if (lastName) {
      return lastName
    }
    return 'N/A'
  }

  // Dialog state
  const sponsorshipDetailsDialog = ref(false)
  const selectedSponsorship = ref(null)

  async function fetchSponsorships () {
    try {
      isLoading.value = true
      await store.dispatch('sponsorship/setSponsorships', route.params.eventId)
    } catch {
    // Backend already sends error message via ApiResponse
    } finally {
      isLoading.value = false
    }
  }

  function getTotalAmount () {
    return sponsorships.value
      .filter(sponsorship => sponsorship.paymentStatus === 'paid')
      .reduce((total, sponsorship) => total + sponsorship.amount, 0)
  }

  function getPendingAmount () {
    return sponsorships.value
      .filter(sponsorship => sponsorship.paymentStatus === 'pending')
      .reduce((total, sponsorship) => total + sponsorship.amount, 0)
  }

  onMounted(() => {
    fetchSponsorships()
  })

  function viewSponsorshipDetails (sponsorship) {
    selectedSponsorship.value = sponsorship
    sponsorshipDetailsDialog.value = true
  }
</script>

<template>
  <v-container class="event-sponsorships-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Event Sponsorships"
    />

    <!-- Summary Cards -->
    <v-row
      class="mb-6"
      justify="center"
    >
      <v-col
        cols="12"
        md="4"
      >
        <v-card
          class="text-center"
          color="primary"
          dark
          :rounded="rounded"
        >
          <v-card-title>Total Sponsorships</v-card-title>
          <v-card-text>
            <div class="text-h4">
              {{ sponsorships.length }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-card
          class="text-center"
          color="success"
          dark
          :rounded="rounded"
        >
          <v-card-title>Total Amount (Paid)</v-card-title>
          <v-card-text>
            <div class="text-h4">
              {{ formatPrice(getTotalAmount(), eventCurrency) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col
        cols="12"
        md="4"
      >
        <v-card
          class="text-center"
          color="warning"
          dark
          :rounded="rounded"
        >
          <v-card-title>Pending Amount</v-card-title>
          <v-card-text>
            <div class="text-h4">
              {{ formatPrice(getPendingAmount(), eventCurrency) }}
            </div>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <v-row justify="center">
      <v-col cols="12">
        <v-card
          elevation="2"
          :rounded="rounded"
        >
          <v-card-title class="d-flex justify-space-between align-center">
            <span>Sponsorship Details</span>
            <v-btn
              color="primary"
              :loading="isLoading"
              prepend-icon="mdi-refresh"
              :rounded="rounded"
              variant="tonal"
              @click="fetchSponsorships"
            >
              Refresh
            </v-btn>
          </v-card-title>

          <v-data-table
            class="elevation-0"
            :headers="[
              { title: 'Sponsor', key: 'sponsorName' },
              { title: 'Email', key: 'email' },
              { title: 'Package', key: 'packageType' },
              { title: 'Amount', key: 'amount' },
              { title: 'Status', key: 'paymentStatus' },
              { title: 'Date', key: 'createdAt' },
              { title: 'Actions', key: 'actions', sortable: false },
            ]"
            hover
            :items="sponsorships"
            :loading="isLoading"
          >
            <template #item.sponsorName="{ item }">
              {{ formatSponsorName(item.sponsorData) }}
            </template>
            <template #item.email="{ item }">
              {{ item.sponsorData?.email || 'N/A' }}
            </template>
            <template #item.amount="{ item }">
              {{ formatPrice(item.amount, item.currency) }}
            </template>
            <template #item.packageType="{ item }">
              <v-chip
                :color="
                  item.packageType.toLowerCase() === 'elite'
                    ? 'purple'
                    : item.packageType.toLowerCase() === 'premier'
                      ? 'blue'
                      : item.packageType.toLowerCase() === 'diamond'
                        ? 'green'
                        : item.packageType.toLowerCase() === 'gold'
                          ? 'amber'
                          : 'grey'
                "
                size="small"
                variant="flat"
              >
                {{ item.packageType.toUpperCase() }}
              </v-chip>
            </template>

            <template #item.paymentStatus="{ item }">
              <v-chip
                :color="
                  item.paymentStatus === 'paid'
                    ? 'success'
                    : item.paymentStatus === 'pending'
                      ? 'warning'
                      : 'error'
                "
                size="small"
              >
                {{ item.paymentStatus.toUpperCase() }}
              </v-chip>
            </template>

            <template #item.createdAt="{ item }">
              {{ formatDateTime({input: item.createdAt}) }}
            </template>

            <template #item.actions="{ item }">
              <v-menu transition="scale-transition">
                <template #activator="{ props }">
                  <v-btn
                    :density="density"
                    icon="mdi-dots-vertical"
                    v-bind="props"
                    variant="text"
                    @click.stop
                  />
                </template>
                <v-list density="compact" :rounded="rounded">
                  <v-list-item
                    prepend-icon="mdi-eye"
                    title="View Details"
                    @click="viewSponsorshipDetails(item)"
                  />
                </v-list>
              </v-menu>
            </template>

            <template #no-data>
              <div class="py-10">
                <AppNoData
                  icon="mdi-handshake-outline"
                  message="No sponsorships have been recorded for this event yet."
                  title="No Sponsorships Found"
                />
              </div>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Sponsorship Details Dialog -->
    <v-dialog
      v-model="sponsorshipDetailsDialog"
      max-width="600"
    >
      <v-card v-if="selectedSponsorship">
        <v-card-title>Sponsorship Details</v-card-title>
        <v-card-text>
          <v-list>
            <v-list-item>
              <v-list-item-title>Sponsor Name</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatSponsorName(selectedSponsorship.sponsorData) }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Email</v-list-item-title>
              <v-list-item-subtitle>
                {{ selectedSponsorship.sponsorData?.email }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Phone</v-list-item-title>
              <v-list-item-subtitle>
                {{ selectedSponsorship.sponsorData?.phone || 'N/A' }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Organization</v-list-item-title>
              <v-list-item-subtitle>
                {{ selectedSponsorship.sponsorData?.organization || 'N/A' }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Package Type</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  :color="
                    selectedSponsorship.packageType === 'elite'
                      ? 'purple'
                      : selectedSponsorship.packageType === 'premier'
                        ? 'blue'
                        : selectedSponsorship.packageType === 'diamond'
                          ? 'green'
                          : selectedSponsorship.packageType === 'gold'
                            ? 'amber'
                            : 'grey'
                  "
                  size="small"
                >
                  {{ selectedSponsorship.packageType.toUpperCase() }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Amount</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatPrice(selectedSponsorship.amount, selectedSponsorship.currency) }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Payment Status</v-list-item-title>
              <v-list-item-subtitle>
                <v-chip
                  :color="
                    selectedSponsorship.paymentStatus === 'paid'
                      ? 'success'
                      : selectedSponsorship.paymentStatus === 'pending'
                        ? 'warning'
                        : 'error'
                  "
                  size="small"
                >
                  {{ selectedSponsorship.paymentStatus.toUpperCase() }}
                </v-chip>
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item>
              <v-list-item-title>Created At</v-list-item-title>
              <v-list-item-subtitle>
                {{ formatDateTime({input: selectedSponsorship.createdAt}) }}
              </v-list-item-subtitle>
            </v-list-item>

            <v-list-item v-if="selectedSponsorship.stripePaymentIntentId">
              <v-list-item-title>Stripe Payment ID</v-list-item-title>
              <v-list-item-subtitle>
                {{ selectedSponsorship.stripePaymentIntentId }}
              </v-list-item-subtitle>
            </v-list-item>
          </v-list>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            @click="sponsorshipDetailsDialog = false"
          >
            Close
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.v-data-table {
  border-radius: 8px;
}
</style>
