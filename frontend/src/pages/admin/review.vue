<script setup>
  import { computed, ref } from 'vue'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatDateTime, getApiPublicImageUrl } from '@/utils'

  definePage({
    name: 'admin-review',
    meta: {
      layout: 'default',
      title: 'Organizer Review',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const { rounded, size, variant, density } = useUiProps()
  const selectedTab = ref('all')
  const selectedOrganizer = ref(null)
  const approvalDialog = ref(false)
  const rejectionDialog = ref(false)
  const rejectionReason = ref('')
  const idDocumentDialog = ref(false)
  const viewingOrganizer = ref(null)

  // State for each tab
  const allState = {
    organizers: ref([]),
    loading: ref(false),
    totalCount: ref(0),
    itemsPerPage: ref(10),
  }

  const pendingState = {
    organizers: ref([]),
    loading: ref(false),
    totalCount: ref(0),
    itemsPerPage: ref(10),
  }

  const approvedState = {
    organizers: ref([]),
    loading: ref(false),
    totalCount: ref(0),
    itemsPerPage: ref(10),
  }

  const rejectedState = {
    organizers: ref([]),
    loading: ref(false),
    totalCount: ref(0),
    itemsPerPage: ref(10),
  }

  // Computed properties to ensure arrays
  const allOrganizers = computed(() => Array.isArray(allState.organizers.value) ? allState.organizers.value : [])
  const pendingOrganizers = computed(() => Array.isArray(pendingState.organizers.value) ? pendingState.organizers.value : [])
  const approvedOrganizers = computed(() => Array.isArray(approvedState.organizers.value) ? approvedState.organizers.value : [])
  const rejectedOrganizers = computed(() => Array.isArray(rejectedState.organizers.value) ? rejectedState.organizers.value : [])

  // Computed properties for loading and totalCount to ensure reactivity
  const allLoading = computed(() => allState.loading.value)
  const allTotalCount = computed(() => allState.totalCount.value)
  const allItemsPerPage = computed({
    get: () => allState.itemsPerPage.value,
    set: val => {
      allState.itemsPerPage.value = val
    },
  })
  const pendingLoading = computed(() => pendingState.loading.value)
  const pendingTotalCount = computed(() => pendingState.totalCount.value)
  const pendingItemsPerPage = computed({
    get: () => pendingState.itemsPerPage.value,
    set: val => {
      pendingState.itemsPerPage.value = val
    },
  })
  const approvedLoading = computed(() => approvedState.loading.value)
  const approvedTotalCount = computed(() => approvedState.totalCount.value)
  const approvedItemsPerPage = computed({
    get: () => approvedState.itemsPerPage.value,
    set: val => {
      approvedState.itemsPerPage.value = val
    },
  })
  const rejectedLoading = computed(() => rejectedState.loading.value)
  const rejectedTotalCount = computed(() => rejectedState.totalCount.value)
  const rejectedItemsPerPage = computed({
    get: () => rejectedState.itemsPerPage.value,
    set: val => {
      rejectedState.itemsPerPage.value = val
    },
  })

  const headers = [
    { title: 'Name', key: 'fullName' },
    { title: 'Email', key: 'email' },
    { title: 'ID Document', key: 'idDocument', sortable: false, width: '140' },
    { title: 'Status', key: 'verificationStatus', sortable: false },
    { title: 'Submitted', key: 'createdAt' },
    { title: '', key: 'actions', sortable: false },
  ]

  function loadItemsAll ({ page, itemsPerPage }) {
    allState.loading.value = true
    return store
      .dispatch('admin/setOrganizers', {
        page,
        itemsPerPage,
        status: undefined,
        fetchTotalCount: !allState.organizers.value?.length,
      })
      .then(({ total }) => {
        allState.organizers.value = store.state.admin?.organizers || []
        if (total !== undefined) {
          allState.totalCount.value = Number(total) || 0
        }
      })
      .catch(error => {
        console.error('Error loading organizers:', error)
      })
      .finally(() => {
        allState.loading.value = false
      })
  }

  function loadItemsPending ({ page, itemsPerPage }) {
    pendingState.loading.value = true
    return store
      .dispatch('admin/setOrganizers', {
        page,
        itemsPerPage,
        status: 'pending',
        fetchTotalCount: !pendingState.organizers.value?.length,
      })
      .then(({ total }) => {
        pendingState.organizers.value = store.state.admin?.organizers || []
        if (total !== undefined) {
          pendingState.totalCount.value = Number(total) || 0
        }
      })
      .catch(error => {
        console.error('Error loading organizers:', error)
      })
      .finally(() => {
        pendingState.loading.value = false
      })
  }

  function loadItemsApproved ({ page, itemsPerPage }) {
    approvedState.loading.value = true
    return store
      .dispatch('admin/setOrganizers', {
        page,
        itemsPerPage,
        status: 'approved',
        fetchTotalCount: !approvedState.organizers.value?.length,
      })
      .then(({ total }) => {
        approvedState.organizers.value = store.state.admin?.organizers || []
        if (total !== undefined) {
          approvedState.totalCount.value = Number(total) || 0
        }
      })
      .catch(error => {
        console.error('Error loading organizers:', error)
      })
      .finally(() => {
        approvedState.loading.value = false
      })
  }

  function loadItemsRejected ({ page, itemsPerPage }) {
    rejectedState.loading.value = true
    return store
      .dispatch('admin/setOrganizers', {
        page,
        itemsPerPage,
        status: 'rejected',
        fetchTotalCount: !rejectedState.organizers.value?.length,
      })
      .then(({ total }) => {
        rejectedState.organizers.value = store.state.admin?.organizers || []
        if (total !== undefined) {
          rejectedState.totalCount.value = Number(total) || 0
        }
      })
      .catch(error => {
        console.error('Error loading organizers:', error)
      })
      .finally(() => {
        rejectedState.loading.value = false
      })
  }

  function getStateForStatus (status) {
    switch (status) {
      case 'all': {
        return allState
      }
      case 'pending': {
        return pendingState
      }
      case 'approved': {
        return approvedState
      }
      case 'rejected': {
        return rejectedState
      }
      default: {
        return allState
      }
    }
  }

  function openApprovalDialog (organizer) {
    selectedOrganizer.value = organizer
    approvalDialog.value = true
  }

  function openRejectionDialog (organizer) {
    selectedOrganizer.value = organizer
    rejectionReason.value = ''
    rejectionDialog.value = true
  }

  async function approveOrganizer () {
    if (!selectedOrganizer.value) return

    try {
      await $axios.post(`/admin/organizers/${selectedOrganizer.value.id}/approve`)
      const state = getStateForStatus(selectedTab.value)
      const loadFn = selectedTab.value === 'all'
        ? loadItemsAll
        : selectedTab.value === 'pending'
          ? loadItemsPending
          : selectedTab.value === 'approved'
            ? loadItemsApproved
            : loadItemsRejected
      await loadFn({
        page: 1,
        itemsPerPage: state.itemsPerPage.value,
      })
      approvalDialog.value = false
      selectedOrganizer.value = null
    } catch (error) {
      console.error('Error approving organizer:', error)
    }
  }

  async function rejectOrganizer () {
    if (!selectedOrganizer.value || !rejectionReason.value.trim()) return

    try {
      await $axios.post(`/admin/organizers/${selectedOrganizer.value.id}/reject`, {
        reason: rejectionReason.value,
      })
      const state = getStateForStatus(selectedTab.value)
      const loadFn = selectedTab.value === 'all'
        ? loadItemsAll
        : selectedTab.value === 'pending'
          ? loadItemsPending
          : selectedTab.value === 'approved'
            ? loadItemsApproved
            : loadItemsRejected
      await loadFn({
        page: 1,
        itemsPerPage: state.itemsPerPage.value,
      })
      rejectionDialog.value = false
      selectedOrganizer.value = null
      rejectionReason.value = ''
    } catch (error) {
      console.error('Error rejecting organizer:', error)
    }
  }

  function getStatusColor (status) {
    switch (status) {
      case 'approved': {
        return 'success'
      }
      case 'rejected': {
        return 'error'
      }
      case 'pending': {
        return 'warning'
      }
      default: {
        return 'grey'
      }
    }
  }

  function getStatusIcon (status) {
    switch (status) {
      case 'approved': {
        return 'mdi-check-circle'
      }
      case 'rejected': {
        return 'mdi-close-circle'
      }
      case 'pending': {
        return 'mdi-clock-outline'
      }
      default: {
        return 'mdi-help-circle'
      }
    }
  }

  function getStatusText (status) {
    switch (status) {
      case 'approved': {
        return 'Approved'
      }
      case 'rejected': {
        return 'Rejected'
      }
      case 'pending': {
        return 'Pending Review'
      }
      default: {
        return 'Unknown'
      }
    }
  }

  function getDocumentUrl (filename) {
    if (!filename) return null
    return getApiPublicImageUrl(filename, 'id-document')
  }

  function openIdDocumentDialog (organizer) {
    viewingOrganizer.value = organizer
    idDocumentDialog.value = true
  }

  async function handleApproveFromViewer () {
    if (!viewingOrganizer.value) return
    selectedOrganizer.value = viewingOrganizer.value
    await approveOrganizer()
    idDocumentDialog.value = false
    viewingOrganizer.value = null
  }

  async function handleRejectFromViewer () {
    if (!viewingOrganizer.value) return
    selectedOrganizer.value = viewingOrganizer.value
    idDocumentDialog.value = false
    viewingOrganizer.value = null
    rejectionDialog.value = true
  }

  function handleRowClick (event, item) {
    // Always open ID document dialog when clicking a row
    openIdDocumentDialog(item.item)
  }

  function hasIdDocument (item) {
    if (!item) return false
    const doc = item.idDocument || item.id_document
    return doc !== null && doc !== undefined && doc !== ''
  }

  function isImageFile (filename) {
    if (!filename) return false
    const ext = filename.toLowerCase().split('.').pop()
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)
  }

  function isPdfFile (filename) {
    if (!filename) return false
    return filename.toLowerCase().endsWith('.pdf')
  }

  function formatDate (date) {
    return formatDateTime({ input: date })
  }
</script>

<template>
  <v-container class="admin-dashboard">
    <!-- Header Section -->
    <PageTitle
      :show-back-button="false"
      subtitle="Review and approve organizer identities"
      title="Organizer Review"
    />

    <!-- Tabs -->
    <v-row
      class="mb-4"
      justify="center"
    >
      <v-col cols="12">
        <v-tabs
          v-model="selectedTab"
          color="primary"
        >
          <v-tab value="all">All</v-tab>
          <v-tab value="pending">Pending</v-tab>
          <v-tab value="approved">Approved</v-tab>
          <v-tab value="rejected">Rejected</v-tab>
        </v-tabs>

        <!-- All Tab -->
        <div v-if="selectedTab === 'all'">
          <v-card
            elevation="2"
            :rounded="rounded"
          >
            <v-data-table-server
              v-model:items-per-page="allItemsPerPage"
              disable-sort
              :headers="headers"
              :items="allOrganizers"
              :items-length="allTotalCount"
              :loading="allLoading"
              @click:row="handleRowClick"
              @update:options="loadItemsAll"
            >
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              <template #item.verificationStatus="{ item }">
                <v-chip
                  :color="getStatusColor(item.verificationStatus)"
                  :prepend-icon="getStatusIcon(item.verificationStatus)"
                  size="small"
                  variant="flat"
                >
                  {{ getStatusText(item.verificationStatus) }}
                  <v-tooltip
                    v-if="item.verificationStatus === 'rejected' && item.rejectionReason"
                    activator="parent"
                  >
                    <div class="text-caption">
                      Rejection Reason: {{ item.rejectionReason }}
                    </div>
                  </v-tooltip>
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <div class="d-flex align-center justify-end flex-wrap gap-2">
                  <v-btn
                    :color="hasIdDocument(item) ? 'primary' : 'grey'"
                    :density="density"
                    :disabled="!hasIdDocument(item)"
                    icon="mdi-file-document"
                    :rounded="rounded"
                    variant="text"
                    @click.stop="openIdDocumentDialog(item)"
                  >
                    <v-tooltip activator="parent">
                      {{ hasIdDocument(item) ? 'View ID Document' : 'No ID Document Available' }}
                    </v-tooltip>
                  </v-btn>
                  <v-menu v-if="item.verificationStatus === 'pending'">
                    <template #activator="{ props }">
                      <v-btn
                        :density="density"
                        icon="mdi-dots-vertical"
                        :rounded="rounded"
                        v-bind="props"
                        variant="text"
                      />
                    </template>
                    <v-list>
                      <v-list-item
                        prepend-icon="mdi-check"
                        title="Approve"
                        @click="openApprovalDialog(item)"
                      />
                      <v-list-item
                        prepend-icon="mdi-close"
                        title="Reject"
                        @click="openRejectionDialog(item)"
                      />
                    </v-list>
                  </v-menu>
                </div>
              </template>
            </v-data-table-server>
          </v-card>
        </div>

        <!-- Pending Tab -->
        <div v-if="selectedTab === 'pending'">
          <v-card
            elevation="2"
            :rounded="rounded"
          >
            <v-data-table-server
              v-model:items-per-page="pendingItemsPerPage"
              disable-sort
              :headers="headers"
              :items="pendingOrganizers"
              :items-length="pendingTotalCount"
              :loading="pendingLoading"
              @click:row="handleRowClick"
              @update:options="loadItemsPending"
            >
              <template #item.idDocument="{ item }">
                <v-chip
                  v-if="hasIdDocument(item)"
                  color="success"
                  prepend-icon="mdi-file-document-check"
                  size="small"
                  variant="flat"
                >
                  Uploaded
                </v-chip>
                <v-chip
                  v-else
                  color="grey"
                  prepend-icon="mdi-file-document-remove"
                  size="small"
                  variant="tonal"
                >
                  None
                </v-chip>
              </template>
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              <template #item.verificationStatus="{ item }">
                <v-chip
                  :color="getStatusColor(item.verificationStatus)"
                  :prepend-icon="getStatusIcon(item.verificationStatus)"
                  size="small"
                  variant="flat"
                >
                  {{ getStatusText(item.verificationStatus) }}
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <div class="d-flex align-center justify-end flex-wrap gap-2">
                  <v-btn
                    :color="hasIdDocument(item) ? 'primary' : 'grey'"
                    :density="density"
                    :disabled="!hasIdDocument(item)"
                    icon="mdi-file-document"
                    :rounded="rounded"
                    variant="text"
                    @click.stop="openIdDocumentDialog(item)"
                  >
                    <v-tooltip activator="parent">
                      {{ hasIdDocument(item) ? 'View ID Document' : 'No ID Document Available' }}
                    </v-tooltip>
                  </v-btn>
                  <v-menu>
                    <template #activator="{ props }">
                      <v-btn
                        :density="density"
                        icon="mdi-dots-vertical"
                        :rounded="rounded"
                        v-bind="props"
                        variant="text"
                      />
                    </template>
                    <v-list>
                      <v-list-item
                        prepend-icon="mdi-check"
                        title="Approve"
                        @click="openApprovalDialog(item)"
                      />
                      <v-list-item
                        prepend-icon="mdi-close"
                        title="Reject"
                        @click="openRejectionDialog(item)"
                      />
                    </v-list>
                  </v-menu>
                </div>
              </template>
            </v-data-table-server>
          </v-card>
        </div>

        <!-- Approved Tab -->
        <div v-if="selectedTab === 'approved'">
          <v-card
            elevation="2"
            :rounded="rounded"
          >
            <v-data-table-server
              v-model:items-per-page="approvedItemsPerPage"
              disable-sort
              :headers="headers"
              :items="approvedOrganizers"
              :items-length="approvedTotalCount"
              :loading="approvedLoading"
              @click:row="handleRowClick"
              @update:options="loadItemsApproved"
            >
              <template #item.idDocument="{ item }">
                <v-chip
                  v-if="hasIdDocument(item)"
                  color="success"
                  prepend-icon="mdi-file-document-check"
                  size="small"
                  variant="flat"
                >
                  Uploaded
                </v-chip>
                <v-chip
                  v-else
                  color="grey"
                  prepend-icon="mdi-file-document-remove"
                  size="small"
                  variant="tonal"
                >
                  None
                </v-chip>
              </template>
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              <template #item.verificationStatus="{ item }">
                <v-chip
                  :color="getStatusColor(item.verificationStatus)"
                  :prepend-icon="getStatusIcon(item.verificationStatus)"
                  size="small"
                  variant="flat"
                >
                  {{ getStatusText(item.verificationStatus) }}
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <div class="d-flex align-center justify-end flex-wrap gap-2">
                  <v-btn
                    :color="hasIdDocument(item) ? 'primary' : 'grey'"
                    :density="density"
                    :disabled="!hasIdDocument(item)"
                    icon="mdi-file-document"
                    :rounded="rounded"
                    variant="text"
                    @click.stop="openIdDocumentDialog(item)"
                  >
                    <v-tooltip activator="parent">
                      {{ hasIdDocument(item) ? 'View ID Document' : 'No ID Document Available' }}
                    </v-tooltip>
                  </v-btn>
                </div>
              </template>
            </v-data-table-server>
          </v-card>
        </div>

        <!-- Rejected Tab -->
        <div v-if="selectedTab === 'rejected'">
          <v-card
            elevation="2"
            :rounded="rounded"
          >
            <v-data-table-server
              v-model:items-per-page="rejectedItemsPerPage"
              disable-sort
              :headers="headers"
              :items="rejectedOrganizers"
              :items-length="rejectedTotalCount"
              :loading="rejectedLoading"
              @click:row="handleRowClick"
              @update:options="loadItemsRejected"
            >
              <template #item.idDocument="{ item }">
                <v-chip
                  v-if="hasIdDocument(item)"
                  color="success"
                  prepend-icon="mdi-file-document-check"
                  size="small"
                  variant="flat"
                >
                  Uploaded
                </v-chip>
                <v-chip
                  v-else
                  color="grey"
                  prepend-icon="mdi-file-document-remove"
                  size="small"
                  variant="tonal"
                >
                  None
                </v-chip>
              </template>
              <template #item.createdAt="{ item }">
                {{ formatDate(item.createdAt) }}
              </template>
              <template #item.verificationStatus="{ item }">
                <v-chip
                  :color="getStatusColor(item.verificationStatus)"
                  :prepend-icon="getStatusIcon(item.verificationStatus)"
                  size="small"
                  variant="flat"
                >
                  {{ getStatusText(item.verificationStatus) }}
                  <v-tooltip
                    activator="parent"
                    if="item.rejectionReason"
                  >
                    <div class="text-caption">
                      Rejection Reason: {{ item.rejectionReason }}
                    </div>
                  </v-tooltip>
                </v-chip>
              </template>
              <template #item.actions="{ item }">
                <div class="d-flex align-center justify-end flex-wrap gap-2">
                  <v-btn
                    v-if="hasIdDocument(item)"
                    color="primary"
                    icon="mdi-file-document"
                    variant="text"
                    @click.stop="openIdDocumentDialog(item)"
                  >
                    <v-tooltip activator="parent">View ID Document</v-tooltip>
                  </v-btn>
                </div>
              </template>
            </v-data-table-server>
          </v-card>
        </div>
      </v-col>
    </v-row>

    <!-- Approval Dialog -->
    <v-dialog
      v-model="approvalDialog"
      max-width="900"
      :rounded="rounded"
      scrollable
    >
      <v-card :rounded="rounded">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Approve Organizer - {{ selectedOrganizer?.fullName }}</span>
          <v-btn
            icon="mdi-close"
            :rounded="rounded"
            :size="size"
            :variant="variant"
            @click="approvalDialog = false"
          />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <div class="mb-4">
            <p class="text-body-1 mb-2">
              Are you sure you want to approve <strong>{{ selectedOrganizer?.fullName }}</strong>?
            </p>
            <p class="text-body-2 text-medium-emphasis">
              Once approved, this organizer will be able to publish events.
            </p>
          </div>

          <!-- ID Document Preview -->
          <div v-if="selectedOrganizer?.idDocument" class="mt-4">
            <v-divider class="mb-4" />
            <div class="text-subtitle-1 font-weight-bold mb-3">ID Document</div>
            <div class="document-preview">
              <!-- Image Preview -->
              <div
                v-if="isImageFile(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                class="text-center"
              >
                <v-img
                  class="mx-auto mb-3"
                  contain
                  max-height="400"
                  :rounded="rounded"
                  :src="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                />
                <div class="d-flex justify-center gap-3">
                  <v-btn
                    color="primary"
                    :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                    prepend-icon="mdi-open-in-new"
                    :rounded="rounded"
                    :size="size"
                    target="_blank"
                    :variant="variant"
                  >
                    View Full Size
                  </v-btn>
                  <v-btn
                    color="primary"
                    download
                    :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                    prepend-icon="mdi-download"
                    :rounded="rounded"
                    :size="size"
                    :variant="variant"
                  >
                    Download Image
                  </v-btn>
                </div>
              </div>
              <!-- PDF Preview -->
              <div v-else-if="isPdfFile(selectedOrganizer.idDocument || selectedOrganizer.id_document)" class="mb-3">
                <div
                  class="text-center pa-6"
                  style="background-color: rgba(var(--v-theme-surfaceVariant), 0.3); border-radius: 8px;"
                >
                  <v-icon
                    class="mb-3"
                    color="error"
                    size="64"
                  >
                    mdi-file-pdf-box
                  </v-icon>
                  <p class="text-body-2 text-medium-emphasis mb-4">
                    {{ selectedOrganizer.idDocument || selectedOrganizer.id_document }}
                  </p>
                  <div class="d-flex justify-center gap-3 flex-wrap">
                    <v-btn
                      color="primary"
                      :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                      prepend-icon="mdi-open-in-new"
                      :rounded="rounded"
                      :size="size"
                      target="_blank"
                      :variant="variant"
                    >
                      Open in New Tab
                    </v-btn>
                    <v-btn
                      color="primary"
                      download
                      :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                      prepend-icon="mdi-download"
                      :rounded="rounded"
                      :size="size"
                      :variant="variant"
                    >
                      Download PDF
                    </v-btn>
                  </div>
                </div>
              </div>
              <!-- Other file types -->
              <div v-else class="text-center">
                <v-icon
                  class="mb-2"
                  color="grey"
                  size="48"
                >
                  mdi-file-document
                </v-icon>
                <p class="text-body-2 mb-3">Document preview not available</p>
                <v-btn
                  color="primary"
                  download
                  :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                  prepend-icon="mdi-download"
                  :rounded="rounded"
                  :size="size"
                  target="_blank"
                  :variant="variant"
                >
                  Download Document
                </v-btn>
              </div>
            </div>
          </div>
          <div v-else class="mt-4">
            <v-alert
              :density="density"
              type="warning"
              variant="tonal"
            >
              No ID document uploaded by this organizer.
            </v-alert>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            :rounded="rounded"
            :size="size"
            :variant="variant"
            @click="approvalDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="success"
            :rounded="rounded"
            :size="size"
            variant="elevated"
            @click="approveOrganizer"
          >
            Approve
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Rejection Dialog -->
    <v-dialog
      v-model="rejectionDialog"
      max-width="900"
      scrollable
    >
      <v-card>
        <v-card-title class="d-flex align-center justify-space-between">
          <span>Reject Organizer - {{ selectedOrganizer?.fullName }}</span>
          <v-btn
            icon="mdi-close"
            variant="text"
            @click="rejectionDialog = false"
          />
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-4">
          <div class="mb-4">
            <p class="text-body-1 mb-2">
              Please provide a reason for rejecting <strong>{{ selectedOrganizer?.fullName }}</strong>:
            </p>
            <v-textarea
              v-model="rejectionReason"
              :density="density"
              label="Rejection Reason"
              placeholder="Enter the reason for rejection..."
              required
              :rounded="rounded"
              rows="4"
              :rules="[(v) => !!v || 'Rejection reason is required']"
              :variant="variant"
            />
          </div>

          <!-- ID Document Preview -->
          <div v-if="hasIdDocument(selectedOrganizer)" class="mt-4">
            <v-divider class="mb-4" />
            <div class="text-subtitle-1 font-weight-bold mb-3">ID Document</div>
            <div class="document-preview">
              <!-- Image Preview -->
              <div
                v-if="isImageFile(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                class="text-center"
              >
                <v-img
                  class="mx-auto mb-3"
                  contain
                  max-height="400"
                  :rounded="rounded"
                  :src="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                />
                <div class="d-flex justify-center gap-3">
                  <v-btn
                    color="primary"
                    :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                    prepend-icon="mdi-open-in-new"
                    :rounded="rounded"
                    :size="size"
                    target="_blank"
                    :variant="variant"
                  >
                    View Full Size
                  </v-btn>
                  <v-btn
                    color="primary"
                    download
                    :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                    prepend-icon="mdi-download"
                    :rounded="rounded"
                    :size="size"
                    :variant="variant"
                  >
                    Download Image
                  </v-btn>
                </div>
              </div>
              <!-- PDF Preview -->
              <div v-else-if="isPdfFile(selectedOrganizer.idDocument || selectedOrganizer.id_document)" class="mb-3">
                <div
                  class="text-center pa-6"
                  style="background-color: rgba(var(--v-theme-surfaceVariant), 0.3); border-radius: 8px;"
                >
                  <v-icon
                    class="mb-3"
                    color="error"
                    size="64"
                  >
                    mdi-file-pdf-box
                  </v-icon>
                  <p class="text-body-2 text-medium-emphasis mb-4">
                    {{ selectedOrganizer.idDocument || selectedOrganizer.id_document }}
                  </p>
                  <div class="d-flex justify-center gap-3 flex-wrap">
                    <v-btn
                      color="primary"
                      :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                      prepend-icon="mdi-open-in-new"
                      :rounded="rounded"
                      :size="size"
                      target="_blank"
                      :variant="variant"
                    >
                      Open in New Tab
                    </v-btn>
                    <v-btn
                      color="primary"
                      download
                      :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                      prepend-icon="mdi-download"
                      :rounded="rounded"
                      :size="size"
                      :variant="variant"
                    >
                      Download PDF
                    </v-btn>
                  </div>
                </div>
              </div>
              <!-- Other file types -->
              <div v-else class="text-center">
                <v-icon
                  class="mb-2"
                  color="grey"
                  size="48"
                >
                  mdi-file-document
                </v-icon>
                <p class="text-body-2 mb-3">Document preview not available</p>
                <v-btn
                  color="primary"
                  download
                  :href="getDocumentUrl(selectedOrganizer.idDocument || selectedOrganizer.id_document)"
                  prepend-icon="mdi-download"
                  :rounded="rounded"
                  :size="size"
                  target="_blank"
                  :variant="variant"
                >
                  Download Document
                </v-btn>
              </div>
            </div>
          </div>
          <div v-else class="mt-4">
            <v-alert
              :density="density"
              type="warning"
              variant="tonal"
            >
              No ID document uploaded by this organizer.
            </v-alert>
          </div>
        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            :rounded="rounded"
            :size="size"
            :variant="variant"
            @click="rejectionDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="error"
            :disabled="!rejectionReason.trim()"
            :rounded="rounded"
            :size="size"
            variant="elevated"
            @click="rejectOrganizer"
          >
            Reject
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- ID Document Viewer Dialog -->
    <v-dialog
      v-model="idDocumentDialog"
      max-width="900"
      :rounded="rounded"
      scrollable
    >
      <v-card :rounded="rounded">
        <v-card-title class="d-flex align-center justify-space-between">
          <span>ID Document - {{ viewingOrganizer?.fullName }}</span>
        </v-card-title>
        <v-divider />
        <v-card-text class="pa-0">
          <div v-if="hasIdDocument(viewingOrganizer)" class="document-viewer">
            <!-- Image Viewer -->
            <div
              v-if="isImageFile(viewingOrganizer.idDocument || viewingOrganizer.id_document)"
              class="text-center pa-4"
            >
              <v-img
                class="mx-auto mb-4"
                contain
                max-height="70vh"
                :rounded="rounded"
                :src="getDocumentUrl(viewingOrganizer.idDocument || viewingOrganizer.id_document)"
              />
            </div>
            <!-- PDF Viewer -->
            <div v-else-if="isPdfFile(viewingOrganizer.idDocument || viewingOrganizer.id_document)" class="pa-8">
              <div class="text-center">
                <v-icon
                  class="mb-4"
                  color="error"
                  size="80"
                >
                  mdi-file-pdf-box
                </v-icon>
                <h3 class="text-h6 mb-2">PDF Document</h3>
                <p class="text-body-2 text-medium-emphasis mb-6">
                  {{ viewingOrganizer.idDocument || viewingOrganizer.id_document }}
                </p>
              </div>
            </div>
            <!-- Fallback for other file types -->
            <div v-else class="text-center pa-8">
              <v-icon
                class="mb-4"
                color="grey"
                size="64"
              >
                mdi-file-document
              </v-icon>
              <p class="text-body-1 mb-4">Document preview not available</p>
              <v-btn
                color="primary"
                download
                :href="getDocumentUrl(viewingOrganizer.idDocument || viewingOrganizer.id_document)"
                prepend-icon="mdi-download"
                target="_blank"
              >
                Download Document
              </v-btn>
            </div>
            <div v-if="viewingOrganizer?.verificationStatus === 'pending'" class="mt-2 mt-md-4 text-center">
              <v-btn
                color="success"
                prepend-icon="mdi-check-circle"
                :rounded="rounded"
                variant="flat"
                @click="handleApproveFromViewer"
              >
                Approve
              </v-btn>
              <v-btn
                class="ml-2"
                color="error"
                prepend-icon="mdi-close-circle"
                :rounded="rounded"
                variant="flat"
                @click="handleRejectFromViewer"
              >
                Reject
              </v-btn>
            </div>
          </div>
          <div v-else class="text-center pa-8">
            <v-icon
              class="mb-4"
              color="grey-lighten-1"
              size="64"
            >
              mdi-file-document-off
            </v-icon>
            <p class="text-h6 text-grey mb-2">No ID Document Uploaded</p>
            <p class="text-body-2 text-grey">
              This organizer has not uploaded an ID document yet.
            </p>
          </div>
        </v-card-text>
        <v-card-actions class="pa-4">
          <v-spacer />
          <v-btn
            v-if="hasIdDocument(viewingOrganizer)"
            color="primary"
            :href="getDocumentUrl(viewingOrganizer.idDocument || viewingOrganizer.id_document)"
            prepend-icon="mdi-open-in-new"
            :rounded="rounded"
            target="_blank"
          >
            Open in New Tab
          </v-btn>
          <v-btn
            :rounded="rounded"
            @click="idDocumentDialog = false"
          >
            Close
          </v-btn>

        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.admin-dashboard {
  padding: 24px;
}

.pdf-viewer-container {
  width: 100%;
  height: 70vh;
  min-height: 500px;
  border: 1px solid rgba(var(--v-border-opacity), var(--v-border-opacity));
  border-radius: 4px;
  overflow: hidden;
  background-color: #f5f5f5;
}

.pdf-viewer {
  width: 100%;
  height: 100%;
  border: none;
}

.pdf-preview-container {
  width: 100%;
  height: 400px;
  min-height: 300px;
  border: 1px solid rgba(var(--v-border-opacity), var(--v-border-opacity));
  border-radius: 4px;
  overflow: hidden;
  background-color: #f5f5f5;
}

.pdf-preview {
  width: 100%;
  height: 100%;
  border: none;
}

.document-preview {
  background-color: rgba(var(--v-theme-surface), 0.5);
  border-radius: 8px;
  padding: 16px;
}
</style>
