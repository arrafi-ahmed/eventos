<script setup>
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { apiCall, isValidEmail } from '@/utils'

  const { t } = useI18n()

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

  // Computed UI Pattern
  const ui = computed(() => ({
    title: t('profile.title'),
    subtitle: t('profile.subtitle'),
    edit_organization: t('profile.edit_organization'),
    update_profile: {
      title: t('profile.sections.update_profile.title'),
      full_name: t('profile.labels.full_name'),
      email: t('profile.labels.email'),
      password_hint: t('profile.sections.update_profile.password_hint'),
      current_password: t('profile.labels.current_password'),
      new_password: t('profile.labels.new_password'),
      confirm_new_password: t('profile.labels.confirm_new_password'),
      save_btn: t('profile.sections.update_profile.save_btn'),
      no_changes: t('profile.sections.update_profile.no_changes'),
      mismatch: t('profile.sections.update_profile.mismatch'),
    },
    appearance: {
      title: t('profile.sections.appearance.title'),
      hint: t('profile.sections.appearance.hint'),
      dark_mode: t('profile.sections.appearance.dark_mode'),
      dark_mode_desc: t('profile.sections.appearance.dark_mode_desc'),
    },
    delete_account: {
      title: t('profile.sections.delete_account.title'),
      hint: t('profile.sections.delete_account.hint'),
      confirm_label: (email) => t('profile.sections.delete_account.confirm_label', { email }),
      confirm_required: t('profile.sections.delete_account.confirm_required'),
      password_required: t('profile.sections.delete_account.password_required'),
      delete_btn: t('profile.sections.delete_account.delete_btn'),
      popup_title: t('profile.sections.delete_account.popup_title'),
      popup_content: t('profile.sections.delete_account.popup_content'),
      confirm_email_hint: t('profile.sections.delete_account.confirm_email_hint'),
    },
    rules: {
      name_required: t('profile.rules.name_required'),
      email_required: t('auth.rules.email_required'),
      email_invalid: t('auth.rules.email_invalid'),
    },
  }))

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

  const emailRules = [
    v => !!String(v ?? '').trim() || ui.value.rules.email_required,
    v => isValidEmail(v) || ui.value.rules.email_invalid,
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
      store.commit('addSnackbar', { text: ui.value.update_profile.mismatch, color: 'error' })
      return
    }

    const payload = buildUpdatePayload()
    if (Object.keys(payload).length === 0) {
      store.commit('addSnackbar', { text: ui.value.update_profile.no_changes, color: 'info' })
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
      store.commit('addSnackbar', { text: ui.value.delete_account.confirm_email_hint, color: 'error' })
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
      :subtitle="ui.subtitle"
      :title="ui.title"
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
          {{ ui.edit_organization }}
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
                {{ ui.update_profile.title }}
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
                  :label="ui.update_profile.full_name"
                  :rounded="rounded"
                  :rules="[(v) => !!v || ui.rules.name_required]"
                  :variant="variant"
                />

                <v-text-field
                  v-model="profileForm.email"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :label="ui.update_profile.email"
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
                  {{ ui.update_profile.password_hint }}
                </v-alert>

                <v-text-field
                  v-model="profileForm.currentPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :label="ui.update_profile.current_password"
                  :rounded="rounded"
                  :type="'password'"
                  :variant="variant"
                />

                <v-text-field
                  v-model="profileForm.newPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :label="ui.update_profile.new_password"
                  :rounded="rounded"
                  :type="'password'"
                  :variant="variant"
                />

                <v-text-field
                  v-model="profileForm.confirmPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :label="ui.update_profile.confirm_new_password"
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
                  {{ ui.update_profile.save_btn }}
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <v-expansion-panel value="appearance">
            <v-expansion-panel-title>
              <div class="text-subtitle-1 font-weight-medium">
                {{ ui.appearance.title }}
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-alert
                class="mb-4"
                color="primary"
                density="compact"
                variant="tonal"
              >
                {{ ui.appearance.hint }}
              </v-alert>
              <div class="d-flex align-center justify-space-between">
                <div>
                  <div class="text-body-1 font-weight-medium">
                    {{ ui.appearance.dark_mode }}
                  </div>
                  <div class="text-caption text-medium-emphasis">
                    {{ ui.appearance.dark_mode_desc }}
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
                {{ ui.delete_account.title }}
              </div>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <v-alert
                class="mb-4"
                color="error"
                density="compact"
                variant="tonal"
              >
                {{ ui.delete_account.hint }}
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
                  :label="ui.delete_account.confirm_label(currentUser?.email || '')"
                  :rounded="rounded"
                  :rules="[(v) => !!v || ui.delete_account.confirm_required]"
                  :variant="variant"
                />

                <v-text-field
                  v-model="deleteForm.currentPassword"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :label="ui.update_profile.current_password"
                  :rounded="rounded"
                  :rules="[(v) => !!v || ui.delete_account.password_required]"
                  :type="'password'"
                  :variant="variant"
                />

                <ConfirmationDialog
                  :popup-content="ui.delete_account.popup_content"
                  :popup-title="ui.delete_account.popup_title"
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
                      {{ ui.delete_account.delete_btn }}
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
