<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute } from 'vue-router'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { generatePassword } from '@/utils'

  definePage({
    name: 'credential-generate',
    meta: {
      layout: 'default',
      title: 'Access Credential',
      titleKey: 'pages.organizer.credential',
      requiresAuth: true,
    },
  })

  const store = useStore()
  const route = useRoute()
  const { rounded, density, variant, size } = useUiProps()
  const { t } = useI18n()

  const organization = computed(() => store.getters['organization/getOrganizationById'](route.params.organizationId))
  const organizers = computed(() => store.state.appUser.admins || [])

  const loading = ref(false)
  const addUserDialog = ref(false)
  const editDialog = ref(false)

  const form = ref(null)
  const isFormValid = ref(true)

  const userInit = {
    id: null,
    fullName: null,
    email: null,
    password: null,
    role: 30, // Default to organizer
    organizationId: null,
  }
  const user = reactive({ ...userInit })

  function openEditDialog (selectedUser) {
    Object.assign(user, {
      id: selectedUser.id,
      fullName: selectedUser.fullName || selectedUser.full_name,
      email: selectedUser.email,
      password: null,
      role: 30, // Always organizer for organization users
      organizationId: selectedUser.organizationId || selectedUser.organization_id,
    })
    editDialog.value = true
  }

  function openAddUserDialog () {
    Object.assign(user, {
      ...userInit,
      organizationId: route.params.organizationId,
      role: 30, // Always organizer for organization users
    })
    addUserDialog.value = true
  }

  async function handleSubmitUser () {
    await form.value.validate()
    if (!isFormValid.value) return

    user.organizationId = route.params.organizationId
    user.role = 30 // Always organizer for organization users

    // Generate password if creating new user
    if (!user.id && !user.password) {
      user.password = generatePassword()
    }

    await store.dispatch('appUser/saveAppUser', {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      password: user.password,
      role: 30, // Always organizer
      organizationId: user.organizationId,
      type: 'organizer',
    }).then(() => {
      if (user.id) {
        editDialog.value = false
      } else {
        addUserDialog.value = false
      }
      Object.assign(user, { ...userInit })
      // Reload organizers after save
      loadUsers()
      store.commit('addSnackbar', { text: `Organizer ${user.id ? 'updated' : 'created'} successfully`, color: 'success' })
    }).catch(error => {
      console.error('Error saving organizer:', error)
      store.commit('addSnackbar', {
        text: error.response?.data?.message || 'Error saving organizer',
        color: 'error',
      })
    })
  }

  function deleteUser (userId) {
    store.dispatch('appUser/deleteAppUser', userId).then(() => {
      // Reload users after deletion
      loadUsers()
    })
  }

  const showGeneratedPassword = ref(false)

  function handleGeneratePassword () {
    user.password = generatePassword()
    showGeneratedPassword.value = true
  }

  function loadUsers () {
    loading.value = true
    store.dispatch('appUser/setAdmins', {
      organizationId: Number.parseInt(route.params.organizationId),
    }).finally(() => {
      loading.value = false
    })
  }

  onMounted(() => {
    loadUsers()
  })
</script>

<template>
  <v-container class="credentials-container">
    <!-- Header Section -->
    <PageTitle
      :back-route="{ name: 'dashboard-organizer' }"
      subtitle="Manage API keys and access credentials"
      title="Access Credential"
      :title-key="'pages.organizer.credential'"
    />

    <!-- Organizers Table -->
    <v-card
      class="rounded-xl"
      elevation="2"
      :rounded="rounded"
    >
      <v-card-title class="d-flex align-center justify-space-between">
        <span>Organizers</span>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          @click="openAddUserDialog"
        >
          Create Organizer
        </v-btn>
      </v-card-title>
      <v-card-text>
        <v-table
          v-if="organizers.length > 0"
          :density="density"
          hover
        >
          <thead>
            <tr>
              <th class="text-start">
                Full Name
              </th>
              <th class="text-start">
                Email
              </th>
              <th class="text-start">
                Created
              </th>
              <th class="text-end">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(item, index) in organizers"
              :key="'organizer-' + index"
            >
              <td>{{ item.fullName || item.full_name || '-' }}</td>
              <td>{{ item.email }}</td>
              <td>
                {{ item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-' }}
              </td>
              <td class="text-end">
                <v-menu>
                  <template #activator="{ props }">
                    <v-btn
                      :density="density"
                      icon="mdi-dots-vertical"
                      :rounded="rounded"
                      size="small"
                      v-bind="props"
                      variant="text"
                    />
                  </template>
                  <v-list density="compact">
                    <v-list-item
                      density="compact"
                      prepend-icon="mdi-pencil"
                      title="Edit"
                      @click="openEditDialog(item)"
                    />
                    <v-divider />
                    <confirmation-dialog
                      popup-content="Are you sure you want to delete this user? This action cannot be undone."
                      popup-title="Delete User"
                      @confirm="deleteUser(item.id)"
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
              </td>
            </tr>
          </tbody>
        </v-table>
        <v-alert
          v-else
          border="start"
          closable
          :density="density"
        >
          No organizers found!
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- Create Organizer Dialog -->
    <v-dialog
      v-model="addUserDialog"
      max-width="600"
      :rounded="rounded"
    >
      <v-card
        class="rounded-xl"
        :rounded="rounded"
      >
        <v-card-title>Create Organizer</v-card-title>
        <v-card-text>
          <v-form
            ref="form"
            v-model="isFormValid"
            fast-fail
          >
            <v-text-field
              v-model="user.fullName"
              class="mt-2"
              clearable
              :density="density"
              hide-details="auto"
              label="Full Name"
              required
              :rounded="rounded"
              :rules="[(v) => !!v || 'Full name is required!']"
              :variant="variant"
            />
            <v-text-field
              v-model="user.email"
              class="mt-2"
              clearable
              :density="density"
              hide-details="auto"
              label="Email"
              required
              :rounded="rounded"
              :rules="[
                (v) => !!v || 'Email is required!',
                (v) => /.+@.+\..+/.test(v) || 'Invalid email format',
              ]"
              :variant="variant"
            />
            <v-alert
              class="mt-4"
              color="info"
              :density="density"
              variant="tonal"
            >
              A password will be automatically generated for this organizer.
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :density="density"
            :rounded="rounded"
            :size="size"
            variant="text"
            @click="addUserDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :density="density"
            :rounded="rounded"
            :size="size"
            @click="handleSubmitUser"
          >
            Create
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Edit Organizer Dialog -->
    <v-dialog
      v-model="editDialog"
      max-width="600"
      :rounded="rounded"
    >
      <v-card
        class="rounded-xl"
        :rounded="rounded"
      >
        <v-card-title>Edit Organizer</v-card-title>
        <v-card-text>
          <v-form
            ref="form"
            v-model="isFormValid"
            fast-fail
          >
            <v-text-field
              v-model="user.fullName"
              class="mt-2"
              clearable
              :density="density"
              hide-details="auto"
              label="Full Name"
              required
              :rounded="rounded"
              :rules="[(v) => !!v || 'Full name is required!']"
              :variant="variant"
            />
            <v-text-field
              v-model="user.email"
              class="mt-2"
              clearable
              :density="density"
              hide-details="auto"
              label="Email"
              required
              :rounded="rounded"
              :rules="[
                (v) => !!v || 'Email is required!',
                (v) => /.+@.+\..+/.test(v) || 'Invalid email format',
              ]"
              :variant="variant"
            />
            <v-divider class="my-4" />
            <div class="text-subtitle-2 mb-2">
              Change Password (Optional)
            </div>
            <v-text-field
              v-if="showGeneratedPassword"
              v-model="user.password"
              class="mt-2"
              clearable
              :density="density"
              hide-details="auto"
              label="New Password"
              :rounded="rounded"
              :rules="[(v) => !user.password || (v && v.length >= 6) || 'Password must be at least 6 characters']"
              :variant="variant"
            />
            <v-btn
              class="mt-2"
              color="primary"
              :density="density"
              prepend-icon="mdi-recycle"
              :rounded="rounded"
              size="small"
              variant="tonal"
              @click="handleGeneratePassword"
            >
              Generate New Password
            </v-btn>
            <v-alert
              v-if="showGeneratedPassword && user.password"
              class="mt-4"
              color="success"
              :density="density"
              variant="tonal"
            >
              Generated password: {{ user.password }}
            </v-alert>
          </v-form>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            :density="density"
            :rounded="rounded"
            :size="size"
            variant="text"
            @click="editDialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :density="density"
            :rounded="rounded"
            :size="size"
            @click="handleSubmitUser"
          >
            Save
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped></style>
