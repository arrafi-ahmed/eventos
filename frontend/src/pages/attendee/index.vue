<script setup>
  import { computed, ref, watch } from 'vue'
  import { useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { apiCall } from '@/utils'

  definePage({
    name: 'profile',
    meta: {
      layout: 'default',
      requiresAuth: true,
      title: 'Profile',
    },
  })

  const store = useStore()
  const router = useRouter()
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const { rounded, variant, density, size } = useUiProps()

  const updateFormRef = ref(null)
  const isUpdateValid = ref(true)
  const isUpdating = ref(false)
  const profileForm = ref({
    fullName: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const deleteFormRef = ref(null)
  const isDeleteValid = ref(true)
  const deleteForm = ref({
    confirmation: '',
    currentPassword: '',
  })
  const isDeleting = ref(false)
  const isSavingTheme = ref(false)
  const expandedPanels = ref(['update-profile'])

  const currentTheme = computed(() => store.getters['preferences/currentTheme'])
  const isDarkTheme = computed(() => currentTheme.value === 'dark')
  const vuetifyTheme = useTheme()

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailRules = [
    v => !!String(v ?? '').trim() || 'Email is required',
    v => emailPattern.test(String(v ?? '').trim()) || 'Invalid email',
  ]

  watch(
    currentUser,
    user => {
      profileForm.value.fullName = user?.fullName || ''
      profileForm.value.email = user?.email || ''
    },
    { immediate: true },
  )

  function buildUpdatePayload () {
    const payload = {}
    if (profileForm.value.fullName && profileForm.value.fullName !== currentUser.value?.fullName) {
      payload.fullName = profileForm.value.fullName.trim()
    }
    if (profileForm.value.email && profileForm.value.email !== currentUser.value?.email) {
      payload.email = profileForm.value.email.trim()
    }
    if (profileForm.value.newPassword) {
      payload.newPassword = profileForm.value.newPassword
    }
    if ((payload.email || payload.newPassword) && profileForm.value.currentPassword) {
      payload.currentPassword = profileForm.value.currentPassword
    }
    return payload
  }

  async function handleUpdateProfile () {
    await updateFormRef.value?.validate()
    if (!isUpdateValid.value) return

    if (profileForm.value.newPassword && profileForm.value.newPassword !== profileForm.value.confirmPassword) {
      store.commit('addSnackbar', { text: 'New passwords do not match.', color: 'error' })
      return
    }

    const payload = buildUpdatePayload()
    if (Object.keys(payload).length === 0) {
      store.commit('addSnackbar', { text: 'No changes detected.', color: 'info' })
      return
    }

    isUpdating.value = true
    try {
      await apiCall.put('/profile', payload)
      await store.dispatch('auth/refreshCurrentUser')
      profileForm.value.currentPassword = ''
      profileForm.value.newPassword = ''
      profileForm.value.confirmPassword = ''
    } catch {
    // errors handled globally
    } finally {
      isUpdating.value = false
    }
  }

  async function handleDeleteProfile () {
    await deleteFormRef.value?.validate()
    if (!isDeleteValid.value) return

    if (deleteForm.value.confirmation !== currentUser.value?.email) {
      store.commit('addSnackbar', { text: 'Please type your email to confirm deletion.', color: 'error' })
      return
    }

    isDeleting.value = true
    try {
      await apiCall.delete('/profile', {
        data: {
          currentPassword: deleteForm.value.currentPassword,
        },
      })
      await store.dispatch('auth/signout')
      router.push({ name: 'homepage' })
    } catch {
    // handled globally
    } finally {
      isDeleting.value = false
    }
  }

  async function handleThemeToggle (value) {
    isSavingTheme.value = true
    try {
      const targetTheme = value ? 'dark' : 'light'
      vuetifyTheme.global.name.value = targetTheme
      await store.dispatch('preferences/saveTheme', targetTheme)
    } finally {
      isSavingTheme.value = false
    }
  }
</script>

<template>
  <v-container class="settings-container">
    <PageTitle
      :show-back-button="true"
      subtitle="Manage your profile, theme, and account access"
      title="Profile"
      @click:back="router.back()"
    >
      <template
        v-if="store.getters['auth/isOrganizer']"
        #actions
      >
        <v-btn
          color="secondary"
          :density="density"
          prepend-icon="mdi-office-building-cog"
          :rounded="rounded"
          :size="size"
          variant="tonal"
          @click="router.push({ name: 'organization-edit' })"
        >
          Edit Organization
        </v-btn>
      </template>
    </PageTitle>

    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
      >
        <v-expansion-panels
          v-model="expandedPanels"
          class="rounded-xl"
          :rounded="rounded"
          variant="popout"
        >
          <v-expansion-panel value="update-profile">
            <v-expansion-panel-title>
              <div class="text-subtitle-1 font-weight-medium">
                Update Profile
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-form
                ref="updateFormRef"
                v-model="isUpdateValid"
                @submit.prevent="handleUpdateProfile"
              >
                <v-text-field
                  v-model="profileForm.fullName"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  label="Full Name"
                  :rounded="rounded"
                  :rules="[(v) => !!v || 'Full name is required']"
                  :variant="variant"
                />

                <v-text-field
                  v-model="profileForm.email"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  label="Email"
                  :rounded="rounded"
                  :rules="emailRules"
                  :variant="variant"
                />

                <v-alert
                  class="mb-4"
                  color="info"
                  density="compact"
                  variant="tonal"
                >
                  Changing your email or password requires your current password.
                </v-alert>

                <v-text-field
                  v-model="profileForm.currentPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  label="Current Password"
                  :rounded="rounded"
                  :type="'password'"
                  :variant="variant"
                />

                <v-text-field
                  v-model="profileForm.newPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  label="New Password"
                  :rounded="rounded"
                  :type="'password'"
                  :variant="variant"
                />

                <v-text-field
                  v-model="profileForm.confirmPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  label="Confirm New Password"
                  :rounded="rounded"
                  :type="'password'"
                  :variant="variant"
                />

                <v-btn
                  block
                  class="mt-2"
                  color="primary"
                  :density="density"
                  :loading="isUpdating"
                  :rounded="rounded"
                  :size="size"
                  type="submit"
                >
                  Save Changes
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel value="appearance">
            <v-expansion-panel-title>
              <div class="text-subtitle-1 font-weight-medium">
                Appearance
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-alert
                class="mb-4"
                color="primary"
                density="compact"
                variant="tonal"
              >
                Theme changes apply instantly and are saved to your account.
              </v-alert>
              <div class="d-flex align-center justify-space-between">
                <div>
                  <div class="text-body-1 font-weight-medium">
                    Dark mode
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    Toggle between light and dark experience
                  </div>
                </div>
                <v-switch
                  color="primary"
                  :disabled="isSavingTheme"
                  hide-details
                  inset
                  :model-value="isDarkTheme"
                  @update:model-value="handleThemeToggle"
                />
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel value="delete-profile">
            <v-expansion-panel-title>
              <div class="text-subtitle-1 font-weight-medium text-error">
                Delete Profile
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-alert
                class="mb-4"
                color="error"
                density="compact"
                variant="tonal"
              >
                This action is permanent. All data associated with your account will be removed if possible.
              </v-alert>

              <v-form
                ref="deleteFormRef"
                v-model="isDeleteValid"
                @submit.prevent="handleDeleteProfile"
              >
                <v-text-field
                  v-model="deleteForm.confirmation"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :label="`Type your email (${currentUser?.email || ''}) to confirm`"
                  :rounded="rounded"
                  :rules="[(v) => !!v || 'Confirmation is required']"
                  :variant="variant"
                />

                <v-text-field
                  v-model="deleteForm.currentPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  label="Current Password"
                  :rounded="rounded"
                  :rules="[(v) => !!v || 'Current password is required']"
                  :type="'password'"
                  :variant="variant"
                />

                <ConfirmationDialog
                  popup-content="Are you absolutely sure? This action cannot be undone."
                  popup-title="Delete Account"
                  @confirm="handleDeleteProfile"
                >
                  <template #activator="{ onClick }">
                    <v-btn
                      block
                      class="mt-2"
                      color="error"
                      :density="density"
                      :loading="isDeleting"
                      :rounded="rounded"
                      :size="size"
                      @click="onClick"
                    >
                      Delete Account
                    </v-btn>
                  </template>
                </ConfirmationDialog>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>
  </v-container>
</template>
