<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'organizer-staff',
    meta: {
      layout: 'default',
      title: 'Manage Organization Staff',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const { rounded, density, variant } = useUiProps()

  const staff = computed(() => store.state.appUser.users || [])
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const loading = ref(false)

  const dialog = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)
  const submitting = ref(false)

  const staffFormInit = {
    id: null,
    email: '',
    password: '',
    fullName: '',
    role: 60, // Default to Check-in Agent
  }
  const staffForm = reactive({ ...staffFormInit })

  const roleOptions = [
    { title: 'Cashier', value: 50 },
    { title: 'Check-in Agent', value: 60 },
    { title: 'Organizer', value: 30 },
  ]

  const headers = [
    { title: 'Name', key: 'fullName' },
    { title: 'Email', key: 'email' },
    { title: 'Role', key: 'role' },
    { title: 'Actions', key: 'actions', align: 'end', sortable: false },
  ]

  async function loadStaff () {
    loading.value = true
    try {
      await store.dispatch('appUser/fetchUsers', { organizationId: currentUser.value.organizationId })
    } finally {
      loading.value = false
    }
  }

  function openAddDialog () {
    Object.assign(staffForm, staffFormInit)
    dialog.value = true
  }

  function openEditDialog (item) {
    Object.assign(staffForm, {
      id: item.id,
      email: item.email,
      fullName: item.fullName,
      role: Number.parseInt(item.role),
      password: '', // Optional during edit
    })
    dialog.value = true
  }

  async function handleSubmit () {
    await form.value.validate()
    if (!isFormValid.value) return

    submitting.value = true
    try {
      await store.dispatch('appUser/saveAppUser', {
        ...staffForm,
        organizationId: currentUser.value.organizationId,
      })
      dialog.value = false
      await loadStaff() // Reload to get fresh list
    } catch (error) {
      console.error('Error saving staff:', error)
    } finally {
      submitting.value = false
    }
  }

  async function handleRemoveUser (userId) {
    try {
      await store.dispatch('appUser/removeUser', {
        userId,
        organizationId: currentUser.value.organizationId,
      })
    } catch (error) {
      console.error('Error removing user:', error)
    }
  }

  function getRoleName (role) {
    return roleOptions.find(r => r.value === Number.parseInt(role))?.title || 'Unknown'
  }

  onMounted(() => {
    if (currentUser.value?.organizationId) {
      loadStaff()
    }
  })
</script>

<template>
  <v-container>
    <PageTitle
      :back-route="{ name: 'dashboard-organizer' }"
      subtitle="Manage your team members"
      title="Organization Staff"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-account-plus"
          :rounded="rounded"
          :size="size"
          variant="flat"
          @click="openAddDialog"
        >
          Add Staff
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
            @click:row="(e, { item }) => openEditDialog(item)"
          >
            <template #item.fullName="{ item }">
              <div class="font-weight-medium">{{ item.fullName }}</div>
            </template>

            <template #item.role="{ item }">
              <v-chip
                :color="parseInt(item.role) === 50 ? 'primary' : parseInt(item.role) === 30 ? 'purple' : 'secondary'"
                label
                size="small"
                variant="tonal"
              >
                {{ getRoleName(item.role) }}
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
                    prepend-icon="mdi-pencil"
                    title="Edit Staff"
                    @click="openEditDialog(item)"
                  />
                  <v-divider />
                  <confirmation-dialog
                    popup-content="Are you sure you want to remove this user from your organization?"
                    @confirm="handleRemoveUser(item.id)"
                  >
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        prepend-icon="mdi-account-remove"
                        title="Remove User"
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
                message="No staff members found in your organization."
                title="No Staff Found"
              />
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add/Edit Staff Dialog -->
    <v-dialog v-model="dialog" max-width="500px">
      <v-card :rounded="rounded">
        <v-card-title class="pa-6 pb-0">
          <span class="text-h5">{{ staffForm.id ? 'Edit' : 'Add' }} Staff Member</span>
        </v-card-title>

        <v-card-text class="pa-6">
          <p class="text-body-2 text-grey-darken-1 mb-6">
            {{ staffForm.id ? 'Update staff details below.' : 'Create a new staff account. They can be assigned to events later.' }}
          </p>

          <v-form ref="form" v-model="isFormValid" @submit.prevent="handleSubmit">
            <v-text-field
              v-model="staffForm.fullName"
              :density="density"
              label="Full Name"
              prepend-inner-icon="mdi-account"
              required
              :rounded="rounded"
              :rules="[v => !!v || 'Full Name is required']"
              :variant="variant"
            />

            <v-text-field
              v-model="staffForm.email"
              class="mt-2"
              :density="density"
              label="Email Address"
              prepend-inner-icon="mdi-email"
              required
              :rounded="rounded"
              :rules="[v => !!v || 'Email is required', v => /.+@.+\..+/.test(v) || 'E-mail must be valid']"
              type="email"
              :variant="variant"
            />

            <v-text-field
              v-model="staffForm.password"
              class="mt-2"
              :density="density"
              :hint="staffForm.id ? 'Leave blank to keep current password' : 'Initial password'"
              label="Password"
              persistent-hint
              prepend-inner-icon="mdi-lock"
              :required="!staffForm.id"
              :rounded="rounded"
              :rules="staffForm.id ? [] : [v => !!v || 'Password is required', v => v.length >= 6 || 'Min 6 characters']"
              type="password"
              :variant="variant"
            />

            <v-select
              v-model="staffForm.role"
              class="mt-4"
              :density="density"
              :items="roleOptions"
              label="Role"
              prepend-inner-icon="mdi-badge-account"
              :rounded="rounded"
              :variant="variant"
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
            :loading="submitting"
            :rounded="rounded"
            variant="flat"
            @click="handleSubmit"
          >
            {{ staffForm.id ? 'Update' : 'Add' }} Staff
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
