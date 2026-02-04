<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'organizer-staff',
    meta: {
      layout: 'default',
      title: 'Manage Staff',
      titleKey: 'pages.organizer.staff',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const { rounded, density, variant, size } = useUiProps()
  const { t } = useI18n()
  const staff = computed(() => (store.state.appUser.users || []).filter(u => Number(u.role) !== 20))
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
    { title: t('pages.organizer.role_cashier'), value: 50 },
    { title: t('pages.organizer.role_agent'), value: 60 },
    { title: t('pages.organizer.role_organizer'), value: 30 },
  ]

  const headers = [
    { title: t('pages.organizer.full_name'), key: 'fullName' },
    { title: t('pages.organizer.email_address'), key: 'email' },
    { title: t('pages.organizer.role_label'), key: 'role' },
    { title: t('common.actions'), key: 'actions', align: 'end', sortable: false },
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
    return roleOptions.find(r => r.value === Number.parseInt(role))?.title || t('common.unknown')
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
      :subtitle="t('pages.organizer.staff_subtitle')"
      :title="t('pages.organizer.staff')"
      :title-key="'pages.organizer.staff'"
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
          {{ t('pages.organizer.add_staff') }}
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
                    :title="t('pages.organizer.edit_staff')"
                    @click="openEditDialog(item)"
                  />
                  <v-divider />
                  <confirmation-dialog
                    :popup-content="t('pages.organizer.remove_user_confirm')"
                    @confirm="handleRemoveUser(item.id)"
                  >
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        prepend-icon="mdi-account-remove"
                        :title="t('pages.organizer.remove_user')"
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
                :message="t('pages.organizer.no_staff_msg')"
                :title="t('pages.organizer.no_staff_title')"
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
          <span class="text-h5">{{ staffForm.id ? t('common.edit') : t('common.add') }} {{ t('pages.organizer.role_agent') }}</span>
        </v-card-title>

        <v-card-text class="pa-6">
          <p class="text-body-2 text-grey-darken-1 mb-6">
            {{ staffForm.id ? t('pages.organizer.staff_update_hint') : t('pages.organizer.staff_add_hint') }}
          </p>

          <v-form ref="form" v-model="isFormValid" @submit.prevent="handleSubmit">
            <v-text-field
              v-model="staffForm.fullName"
              :density="density"
              :label="t('pages.organizer.full_name')"
              prepend-inner-icon="mdi-account"
              required
              :rounded="rounded"
              :rules="[v => !!v || t('pages.organizer.name_required')]"
              :variant="variant"
            />

            <v-text-field
              v-model="staffForm.email"
              class="mt-2"
              :density="density"
              :label="t('pages.organizer.email_address')"
              prepend-inner-icon="mdi-email"
              required
              :rounded="rounded"
              :rules="[v => !!v || t('pages.organizer.email_required'), v => /.+@.+\..+/.test(v) || t('pages.organizer.email_invalid')]"
              type="email"
              :variant="variant"
            />

            <v-text-field
              v-model="staffForm.password"
              class="mt-2"
              :density="density"
              :hint="staffForm.id ? t('pages.organizer.keep_password_hint') : t('pages.organizer.initial_password_hint')"
              label="Password"
              persistent-hint
              prepend-inner-icon="mdi-lock"
              :required="!staffForm.id"
              :rounded="rounded"
              :rules="staffForm.id ? [] : [v => !!v || t('pages.organizer.password_required'), v => v.length >= 6 || t('pages.organizer.password_min')]"
              type="password"
              :variant="variant"
            />

            <v-select
              v-model="staffForm.role"
              class="mt-4"
              :density="density"
              :items="roleOptions"
              :label="t('pages.organizer.role_label')"
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
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn
            color="primary"
            :loading="submitting"
            :rounded="rounded"
            variant="flat"
            @click="handleSubmit"
          >
            {{ staffForm.id ? t('common.update') : t('common.add') }} {{ t('pages.organizer.role_agent') }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>
