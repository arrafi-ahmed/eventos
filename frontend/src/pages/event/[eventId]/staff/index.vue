<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'event-staff',
    meta: {
      layout: 'default',
      title: 'Manage Event Staff',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, density, variant, size } = useUiProps()

  const eventId = computed(() => route.params.eventId)
  const staff = computed(() => (store.state.staff.staff || []).filter(u => Number(u.globalRole) !== 20))
  const loading = computed(() => store.state.staff.loading)
  const event = computed(() => store.state.event.event)
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const organizationUsers = computed(() => (store.state.appUser.users || []).filter(u => Number(u.role) !== 20))

  const dialog = ref(false)
  const isFormValid = ref(true)
  const submitting = ref(false)
  const form = ref(null)

  const assignForm = reactive({
    userId: null,
  })

  // Filter out users already assigned to this event
  const availableUsers = computed(() => {
    const assignedIds = new Set(staff.value.map(s => s.userId))
    return organizationUsers.value.filter(u => !assignedIds.has(u.id))
  })

  const roleOptions = [
    { title: 'Organizer', value: 30 },
    { title: 'Attendee', value: 40 },
    { title: 'Cashier', value: 50 },
    { title: 'Check-in Agent', value: 60 },
  ]

  const headers = [
    { title: 'Name', key: 'fullName' },
    { title: 'Email', key: 'email' },
    { title: 'Global Role', key: 'globalRole' },
    { title: 'Actions', key: 'actions', align: 'end', sortable: false },
  ]

  async function loadData () {
    await Promise.all([
      store.dispatch('staff/fetchStaff', { eventId: eventId.value }),
      store.dispatch('event/setEvent', { eventId: eventId.value }),
    ])

    if (currentUser.value?.organizationId) {
      await store.dispatch('appUser/fetchUsers', { organizationId: currentUser.value.organizationId })
    }
  }

  function openAssignDialog () {
    assignForm.userId = null
    dialog.value = true
  }

  // Ensure navigate to edit page works if needed (or we can just remove edit from here since it's global now)
  // Since staff editing is now global, we might remove local editing or redirect to global edit page.
  // But requirement says "Edit Staff" option to the menu.
  // Actually, editing staff details (name/email) should probably be done globally.
  // Changing ROLE for this event can be done here.
  // Let's implement Update Role here.

  const editDialog = ref(false)
  const editForm = reactive({
    userId: null,
    role: 60,
    fullName: '',
  })

  function openEditRoleDialog (item) {
    // We don't edit roles here anymore, but we can show details or redirect to global edit
    // For now, let's keep it simple and just show the name
    Object.assign(editForm, {
      userId: item.userId,
      fullName: item.fullName,
    })
    // editDialog.value = true // Disable editing here
  }

  async function handleAssign () {
    const { valid } = await form.value.validate()
    if (!valid) return

    submitting.value = true
    try {
      await store.dispatch('staff/assignStaff', {
        eventId: eventId.value,
        userId: assignForm.userId,
        // Role is now derived from app_user in backend
        organizationId: currentUser.value.organizationId,
      })
      dialog.value = false
      await loadData()
    } catch (error) {
      console.error('Error assigning staff:', error)
    } finally {
      submitting.value = false
    }
  }

  async function handleUpdateRole () {
    submitting.value = true
    try {
      // Re-using assignStaff since it handles upsert (ON CONFLICT UPDATE) in backend
      await store.dispatch('staff/assignStaff', {
        eventId: eventId.value,
        userId: editForm.userId,
        role: editForm.role,
        organizationId: currentUser.value.organizationId,
      })
      editDialog.value = false
      await loadData()
    } catch (error) {
      console.error('Error updating role:', error)
    } finally {
      submitting.value = false
    }
  }

  async function handleRemoveStaff (userId, role) {
    try {
      await store.dispatch('staff/removeStaff', {
        userId,
        role,
        eventId: eventId.value,
      })
    } catch (error) {
      console.error('Error removing staff:', error)
    }
  }

  function getRoleName (role) {
    return roleOptions.find(r => r.value === Number.parseInt(role))?.title || 'Unknown'
  }

  onMounted(() => {
    loadData()
  })
</script>

<template>
  <v-container>
    <PageTitle
      :back-route="{ name: 'dashboard-organizer' }"
      :subtitle="event?.name"
      title="Event Staff Assignment"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-account-plus"
          :rounded="rounded"
          :size="size"
          variant="flat"
          @click="openAssignDialog"
        >
          Assign Staff
        </v-btn>
      </template>
    </PageTitle>

    <v-row>
      <v-col cols="12">
        <v-card elevation="2" :rounded="rounded">
          <v-data-table
            :headers="headers"
            hover
            :items="staff"
            :loading="loading"
            @click:row="(e, { item }) => openEditRoleDialog(item)"
          >
            <template #item.fullName="{ item }">
              <div class="font-weight-medium">{{ item.fullName }}</div>
            </template>

            <template #item.globalRole="{ item }">
              <v-chip
                :color="parseInt(item.globalRole) === 50 ? 'primary' : 'secondary'"
                label
                size="small"
                variant="tonal"
              >
                {{ getRoleName(item.globalRole) }}
              </v-chip>
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
                <v-list class="pa-0" density="compact" :rounded="rounded">
                  <v-list-item
                    prepend-icon="mdi-account-cog"
                    title="Manage User Role"
                    :to="{ name: 'organizer-staff' }"
                  />
                  <v-divider />
                  <confirmation-dialog
                    popup-content="Are you sure you want to remove this staff member from this event?"
                    @confirm="handleRemoveStaff(item.userId, item.role)"
                  >
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        prepend-icon="mdi-account-remove"
                        title="Remove from Event"
                        @click.stop="onClick"
                      />
                    </template>
                  </confirmation-dialog>
                </v-list>
              </v-menu>
            </template>

            <template #no-data>
              <AppNoData
                icon="mdi-account-group-outline"
                message="No staff members assigned to this event."
                title="No Staff Assigned"
              >
                <template #actions>
                  <div class="text-caption text-grey mt-2">
                    Use "Manage Staff" in dashboard to add new team members first.
                  </div>
                </template>
              </AppNoData>
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Assign Staff Dialog -->
    <v-dialog v-model="dialog" max-width="500px">
      <v-card :rounded="rounded">
        <v-card-title class="pa-6 pb-0">
          <span class="text-h5">Assign Staff to Event</span>
        </v-card-title>

        <v-card-text class="pa-6">
          <div v-if="availableUsers.length === 0" class="text-center py-4">
            <v-icon class="mb-2" color="grey-lighten-1" size="64">mdi-account-off</v-icon>
            <p class="text-body-1 font-weight-medium">No Available Staff</p>
            <p class="text-body-2 text-grey mb-4">
              All your organization staff are already assigned or you haven't added any yet.
            </p>
            <v-btn
              color="primary"
              :to="{ name: 'organizer-staff' }"
              variant="tonal"
              @click="dialog = false"
            >
              Manage Organization Staff
            </v-btn>
          </div>

          <v-form v-else ref="form" @submit.prevent="handleAssign">
            <v-autocomplete
              v-model="assignForm.userId"
              :density="density"
              item-title="fullName"
              item-value="id"
              :items="availableUsers"
              label="Select Staff Member"
              prepend-inner-icon="mdi-account-search"
              required
              :rounded="rounded"
              :rules="[v => !!v || 'Please select a staff member']"
              :variant="variant"
            >
              <template #item="{ props, item }">
                <v-list-item v-bind="props" :subtitle="`${getRoleName(item.raw.role)} • ${item.raw.email}`" />
              </template>
            </v-autocomplete>

          </v-form>
        </v-card-text>

        <v-card-actions v-if="availableUsers.length > 0" class="pa-6 pt-0">
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
            :loading="submitting"
            :rounded="rounded"
            variant="flat"
            @click="handleAssign"
          >
            Assign
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Role Dialog -->
    <v-dialog v-model="editDialog" max-width="500px">
      <v-card :rounded="rounded">
        <v-card-title class="pa-6 pb-0">
          <span class="text-h5">Change Role</span>
        </v-card-title>
        <v-card-text class="pa-6">
          <p class="mb-4">
            Update role for <strong>{{ editForm.fullName }}</strong> in this event.
          </p>
          <v-select
            v-model="editForm.role"
            :density="density"
            :items="roleOptions"
            label="Role"
            prepend-inner-icon="mdi-badge-account"
            :rounded="rounded"
            :variant="variant"
          />
        </v-card-text>
        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            color="secondary"
            :rounded="rounded"
            variant="text"
            @click="editDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :loading="submitting"
            :rounded="rounded"
            variant="flat"
            @click="handleUpdateRole"
          >
            Update Role
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
