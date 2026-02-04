<script setup>
  import { onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { isValidImage } from '@/utils'

  definePage({
    name: 'organization-add',
    meta: {
      layout: 'default',
      title: 'Add Organization',
      titleKey: 'pages.organizer.add',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { mobile } = useDisplay()
  const router = useRouter()
  const store = useStore()
  const { t } = useI18n()
  const { rounded, density, variant, size } = useUiProps()

  const newOrganizationInit = {
    name: null,
    location: null,
    logo: null,
  }
  const newOrganization = reactive({ ...newOrganizationInit })

  const form = ref(null)
  const isFormValid = ref(true)

  function handleOrganizationLogo (file) {
    newOrganization.logo = file
  }

  async function handleAddOrganization () {
    await form.value.validate()
    if (!isFormValid.value) return

    const formData = new FormData()
    formData.append('name', newOrganization.name)
    formData.append('location', newOrganization.location)

    if (newOrganization.logo) formData.append('files', newOrganization.logo)

    await store.dispatch('organization/save', formData).then(result => {
      Object.assign(newOrganization, {
        ...newOrganizationInit,
      })
      router.push({
        name: 'admin-organizations',
      })
    })
  }
</script>

<template>
  <v-container class="organization-add-container">
    <PageTitle
      :back-route="{ name: 'dashboard-organizer' }"
      :compact="true"
      title="Add Organization"
      :title-key="'pages.organizer.add'"
    />

    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card
          class="rounded-xl"
          :rounded="rounded"
        >
          <v-card-text class="pa-6">
            <v-form
              ref="form"
              v-model="isFormValid"
              fast-fail
              @submit.prevent="handleAddOrganization"
            >
              <v-text-field
                v-model="newOrganization.name"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                label="Name"
                prepend-inner-icon="mdi-account"
                required
                :rounded="rounded"
                :rules="[(v) => !!v || 'Name is required!']"
                :variant="variant"
              />

              <v-text-field
                v-model="newOrganization.location"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                label="Location (optional)"
                prepend-inner-icon="mdi-map-marker"
                :rounded="rounded"
                :variant="variant"
              />

              <v-file-upload
                accept="image/*"
                class="mb-4"
                :density="density"
                hide-details="auto"
                label="Logo"
                prepend-icon=""
                prepend-inner-icon="mdi-camera"
                :rounded="rounded"
                :rules="[
                  (v) =>
                    (Array.isArray(v) ? v : [v]).every((file) => isValidImage(file)) ||
                    'Only jpg/jpeg/png allowed!',
                ]"
                show-size
                :variant="variant"
                @update:model-value="handleOrganizationLogo"
              />

              <div class="d-flex align-center mt-4">
                <v-spacer />
                <v-btn
                  color="primary"
                  :density="density"
                  :rounded="rounded"
                  :size="size"
                  type="submit"
                >
                  Create Organization
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.organization-add-container {
  min-height: calc(100vh - 64px);
}

@media (max-width: 768px) {
  .organization-add-container {
  }
}
</style>
