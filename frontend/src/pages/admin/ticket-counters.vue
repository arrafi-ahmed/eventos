<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { TicketCounter } from '@/models/TicketCounter'

  definePage({
    name: 'admin-ticket-counters',
    meta: {
      layout: 'default',
      title: 'Ticket Counters',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { rounded, density, size, variant } = useUiProps()
  const store = useStore()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const organizationId = computed(() => currentUser.value?.organizationId)

  const ticketCounters = ref([])
  const loading = ref(false)

  const dialog = ref(false)
  const dialogEdit = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)

  const counterInit = {
    id: null,
    name: '',
    status: true,
  }
  const counter = reactive({ ...counterInit })

  const headers = [
    { title: 'Name', key: 'name', sortable: true },
    { title: 'Status', key: 'isActive', sortable: true },
    { title: 'Created', key: 'createdAt', sortable: true },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
  ]

  function openAddDialog () {
    Object.assign(counter, counterInit)
    dialog.value = true
  }

  function openEditDialog (item) {
    Object.assign(counter, {
      ...item,
      status: item.isActive,
    })
    dialog.value = true
    dialogEdit.value = true
  }

  async function handleSave () {
    await form.value.validate()
    if (!isFormValid.value) return

    const payload = new TicketCounter({
      ...counter,
      organizationId: organizationId.value,
    }).toJSON()

    store.dispatch('ticketCounter/save', payload).then(() => {
      dialog.value = false
      loadItems()
    })
  }

  function deleteCounter (id) {
    store.dispatch('ticketCounter/deleteTicketCounter', { id }).then(() => {
      loadItems()
    })
  }

  function loadItems () {
    loading.value = true
    store
      .dispatch('ticketCounter/setTicketCounters', {
        organizationId: organizationId.value,
      })
      .then(data => {
        ticketCounters.value = data || []
      })
      .finally(() => {
        loading.value = false
      })
  }

  function formatDate (dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  onMounted(() => {
    loadItems()
  })
</script>

<template>
  <v-container>
    <PageTitle
      :back-route="{ name: 'dashboard-organizer' }"
      subtitle="Manage physical points of sale for your organization"
      title="Ticket Counters"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          :variant="variant"
          @click="openAddDialog"
        >
          Add Counter
        </v-btn>
      </template>
    </PageTitle>

    <v-row justify="center">
      <v-col cols="12">
        <v-card elevation="2" :rounded="rounded">
          <v-data-table
            :density="density"
            :headers="headers"
            hover
            :items="ticketCounters"
            :loading="loading"
          >
            <template #item.name="{ item }">
              <div class="font-weight-medium">
                {{ item.name }}
              </div>
            </template>

            <template #item.isActive="{ item }">
              <v-chip
                :color="item.isActive ? 'success' : 'error'"
                :density="density"
                label
                size="small"
              >
                {{ item.isActive ? 'Active' : 'Inactive' }}
              </v-chip>
            </template>

            <template #item.createdAt="{ item }">
              {{ formatDate(item.createdAt) }}
            </template>

            <template #item.actions="{ item }">
              <v-menu transition="scale-transition">
                <template #activator="{ props }">
                  <v-btn
                    :density="density"
                    icon="mdi-dots-vertical"
                    variant="text"
                    v-bind="props"
                    @click.stop
                  />
                </template>
                <v-list density="compact" :rounded="rounded">
                  <v-list-item
                    prepend-icon="mdi-pencil"
                    title="Edit"
                    @click="openEditDialog(item)"
                  />
                  <v-divider />
                  <confirmation-dialog
                    popup-content="Are you sure you want to delete this ticket counter? This action cannot be undone."
                    @confirm="deleteCounter(item.id)"
                  >
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        prepend-icon="mdi-delete"
                        title="Delete"
                        @click.stop="onClick"
                      />
                    </template>
                  </confirmation-dialog>
                </v-list>
              </v-menu>
            </template>

            <template #no-data>
              <AppNoData
                icon="mdi-store-off"
                message="No ticket counters found. Start by adding one to begin onsite sales."
                title="No Counters Found"
              />
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add/Edit Dialog -->
    <v-dialog v-model="dialog" max-width="500px">
      <v-card :rounded="rounded">
        <v-card-title class="pa-6 pb-0">
          <span class="text-h5">{{ dialogEdit ? 'Edit' : 'Add' }} Ticket Counter</span>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form ref="form" v-model="isFormValid" @submit.prevent="handleSave">
            <v-text-field
              v-model="counter.name"
              :density="density"
              label="Counter Name"
              prepend-inner-icon="mdi-store"
              required
              :rounded="rounded"
              :rules="[v => !!v || 'Name is required']"
              :variant="variant"
            />

            <v-switch
              v-model="counter.status"
              class="mt-4"
              color="primary"
              inset
              label="Counter Status (Active/Inactive)"
            />
          </v-form>
        </v-card-text>

        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            color="secondary"
            :rounded="rounded"
            variant="text"
            @click="dialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :rounded="rounded"
            variant="flat"
            @click="handleSave"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.gap-2 {
  gap: 8px;
}
</style>
