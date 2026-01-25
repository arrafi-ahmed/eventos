<script setup>
  import { computed, onMounted, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  definePage({
    name: 'event-sponsorship-packages',
    meta: {
      layout: 'default',
      title: 'Event Sponsorship Packages',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { rounded, size, density, variant } = useUiProps()
  const store = useStore()
  const route = useRoute()
  const router = useRouter()

  const event = computed(() => store.getters['event/getEventById'](route.params.eventId))

  const packages = computed(() => store.state.sponsorshipPackage.packages)
  const isLoading = ref(false)
  const showAddDialog = ref(false)
  const showEditDialog = ref(false)
  const selectedPackage = ref(null)

  // Computed property for dialog visibility
  const showDialog = computed({
    get: () => showAddDialog.value || showEditDialog.value,
    set: value => {
      if (!value) {
        showAddDialog.value = false
        showEditDialog.value = false
      }
    },
  })

  // Form data for new/edit package
  const packageForm = ref({
    id: null,
    name: '',
    description: '',
    price: 0,
    currency: 'USD',
    availableCount: -1,
    isActive: true,
    features: [],
  })

  // Default features list
  const defaultFeatures = [
    'PCSM Coins',
    'Sponsored Sessions',
    '1:1 Meetings',
    'Virtual Booth',
    'Dedicated Email Blast',
    'Prime Location Ads',
    'Gamification Inclusion',
    'Promoted Videos',
    'Press Release Inclusion',
    'High-Profile Branding',
    'Breakout Room Branding',
    'Video Testimonials',
    'Rotating Ads on Events App',
    'Social Media Posts',
    'Email Mentions',
    'Company Profile on Event Site',
    'Logo on Website',
    'General Marketing Inclusion',
    'Logo on Event Platform',
    'Logo on Waiting Room Videos',
  ]

  async function fetchPackages () {
    try {
      isLoading.value = true

      await store.dispatch('sponsorshipPackage/setPackages', route.params.eventId)
    } catch {

    // Backend already sends error message via ApiResponse
    } finally {
      isLoading.value = false
    }
  }

  function openAddDialog () {
    packageForm.value = {
      id: null,
      name: '',
      description: '',
      price: 0,
      currency: 'USD',
      availableCount: -1,
      isActive: true,
      features: defaultFeatures.map(feature => ({
        text: feature,
        included: false,
      })),
    }
    showAddDialog.value = true
  }

  function openEditDialog (pkg) {
    selectedPackage.value = pkg
    packageForm.value = {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      currency: pkg.currency,
      availableCount: pkg.availableCount,
      isActive: pkg.isActive,
      features: pkg.features || [],
    }
    showEditDialog.value = true
  }

  function closeDialog () {
    showAddDialog.value = false
    showEditDialog.value = false
    selectedPackage.value = null
    packageForm.value = {
      id: null,
      name: '',
      description: '',
      price: 0,
      currency: 'USD',
      availableCount: -1,
      isActive: true,
      features: [],
    }
  }

  async function savePackage () {
    try {
      const packageData = {
        ...packageForm.value,
        eventId: route.params.eventId,
        organizationId: event.value.organizationId,
      }

      await store.dispatch('sponsorshipPackage/savePackage', packageData)
      closeDialog()
    } catch {
    // Backend already sends error message via ApiResponse
    }
  }

  async function deletePackage (packageId) {
    try {
      await store.dispatch('sponsorshipPackage/deletePackage', {
        packageId,
        eventId: route.params.eventId,
        organizationId: event.value.organizationId,
      })
    } catch {
    // Backend already sends error message via ApiResponse
    }
  }

  function toggleFeature (index) {
    packageForm.value.features[index].included = !packageForm.value.features[index].included
  }

  function getAvailableText (count) {
    return count === -1 ? 'Unlimited' : `${count} available`
  }

  onMounted(() => {
    fetchPackages()
  })
</script>

<template>
  <v-container class="sponsorship-packages-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="event?.name"
      title="Sponsorship Packages"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          @click="openAddDialog"
        >
          Add Package
        </v-btn>
      </template>

    </PageTitle>

    <v-row justify="center">
      <v-col cols="12">
        <div
          v-if="isLoading"
          class="text-center"
        >
          <v-progress-circular
            color="primary"
            indeterminate
          />
          <div class="mt-2">
            Loading sponsorship packages...
          </div>
        </div>
        <div v-else-if="packages && packages.length > 0">
          <v-row justify="center">
            <v-col
              v-for="pkg in packages"
              :key="pkg.id"
              cols="12"
              lg="4"
              md="6"
            >
              <v-card
                class="package-card"
                elevation="2"
                :rounded="rounded"
              >
                <v-card-title class="d-flex justify-space-between align-center">
                  <span class="text-h6">{{ pkg.name }}</span>
                  <v-chip
                    :color="pkg.isActive ? 'success' : 'grey'"
                    size="small"
                  >
                    {{ pkg.isActive ? 'Active' : 'Inactive' }}
                  </v-chip>
                </v-card-title>

                <v-card-text>
                  <div class="mb-3">
                    <div class="text-h5 font-weight-bold text-primary">
                      {{ formatPrice(pkg.price, pkg.currency) }}
                    </div>
                    <div class="text-caption text-grey">
                      {{ getAvailableText(pkg.availableCount) }}
                    </div>
                  </div>

                  <p
                    v-if="pkg.description"
                    class="text-body-2 mb-3 text-pre-wrap"
                  >
                    {{ pkg.description }}
                  </p>

                  <div class="text-caption font-weight-medium mb-2">
                    Features:
                  </div>
                  <v-list density="compact">
                    <v-list-item
                      v-for="(feature, index) in pkg.features"
                      :key="index"
                      class="pa-0"
                    >
                      <template #prepend>
                        <v-icon
                          :color="feature.included ? 'success' : 'grey'"
                          size="small"
                        >
                          {{ feature.included ? 'mdi-check' : 'mdi-close' }}
                        </v-icon>
                      </template>
                      <v-list-item-title class="text-body-2">
                        {{ feature.text }}
                      </v-list-item-title>
                    </v-list-item>
                  </v-list>
                </v-card-text>

                <v-card-actions>
                  <v-spacer />
                  <v-btn
                    color="primary"
                    size="small"
                    variant="text"
                    @click="openEditDialog(pkg)"
                  >
                    Edit
                  </v-btn>
                  <confirmation-dialog @confirm="deletePackage(pkg.id)">
                    <template #activator="{ onClick }">
                      <v-btn
                        color="error"
                        size="small"
                        variant="text"
                        @click="onClick"
                      >
                        Delete
                      </v-btn>
                    </template>
                  </confirmation-dialog>
                </v-card-actions>
              </v-card>
            </v-col>
          </v-row>
        </div>

        <AppNoData
          v-else-if="!isLoading"
          icon="mdi-hand-heart-outline"
          message="No sponsorship packages found for this event. Create your first package to attract sponsors!"
          title="No Packages Found"
        />
      </v-col>
    </v-row>

    <!-- Add/Edit Package Dialog -->
    <v-dialog
      v-model="showDialog"
      max-width="800"
      persistent
    >
      <v-card>
        <v-card-title>{{ packageForm.id ? 'Edit' : 'Add' }} Sponsorship Package</v-card-title>

        <v-card-text>
          <v-form @submit.prevent="savePackage">
            <v-row>
              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="packageForm.name"
                  density="compact"
                  label="Package Name"
                  required
                  variant="solo"
                />
              </v-col>

              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="packageForm.price"
                  density="compact"
                  label="Price"
                  required
                  type="number"
                  variant="solo"
                />
              </v-col>

              <v-col
                cols="12"
                md="6"
              >
                <v-select
                  v-model="packageForm.currency"
                  density="compact"
                  :items="['USD', 'EUR', 'GBP']"
                  label="Currency"
                  required
                  variant="solo"
                />
              </v-col>

              <v-col
                cols="12"
                md="6"
              >
                <v-text-field
                  v-model="packageForm.availableCount"
                  density="compact"
                  label="Available Count (-1 for unlimited)"
                  required
                  type="number"
                  variant="solo"
                />
              </v-col>

              <v-col cols="12">
                <v-textarea
                  v-model="packageForm.description"
                  class="text-pre-wrap"
                  density="compact"
                  label="Description (optional)"
                  rows="3"
                  variant="solo"
                />
              </v-col>

              <v-col cols="12">
                <v-switch
                  v-model="packageForm.isActive"
                  color="primary"
                  label="Active"
                />
              </v-col>

              <v-col cols="12">
                <div class="text-h6 mb-3">
                  Features
                </div>
                <v-row>
                  <v-col
                    v-for="(feature, index) in packageForm.features"
                    :key="index"
                    cols="12"
                    md="6"
                  >
                    <v-card
                      class="feature-card"
                      :class="{ 'feature-included': feature.included }"
                      @click="toggleFeature(index)"
                    >
                      <v-card-text class="pa-3">
                        <div class="d-flex align-center">
                          <v-icon
                            class="me-2"
                            :color="feature.included ? 'success' : 'grey'"
                          >
                            {{ feature.included ? 'mdi-check-circle' : 'mdi-circle-outline' }}
                          </v-icon>
                          <span class="text-body-2">{{ feature.text }}</span>
                        </div>
                      </v-card-text>
                    </v-card>
                  </v-col>
                </v-row>
              </v-col>
            </v-row>
          </v-form>
        </v-card-text>

        <v-card-actions>
          <v-spacer />
          <v-btn
            class="mr-3"
            color="grey"
            variant="text"
            @click="closeDialog"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            @click="savePackage"
          >
            {{ packageForm.id ? 'Update' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.package-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.package-card .v-card-actions {
  margin-top: auto;
}

.feature-card {
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid transparent;
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.feature-included {
  border-color: #4caf50;
  background-color: #f1f8e9;
}
</style>
