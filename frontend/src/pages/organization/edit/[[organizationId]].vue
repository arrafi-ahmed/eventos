<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import ImageManager from '@/components/ImageManager.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { getOrganizationImageUrl, isValidImage } from '@/utils'

  definePage({
    name: 'organization-edit',
    meta: {
      layout: 'default',
      title: 'Edit Organization',
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, density, variant, size } = useUiProps()

  const currentUser = computed(() => store.state.auth.currentUser)
  const targetOrganizationId = computed(() => {
    if (store.getters['auth/isAdmin']) {
      return route.params.organizationId
    }
    if (store.getters['auth/isOrganizer']) {
      return currentUser.value.organizationId
    }
    return null
  })
  const prefetchedOrganization = computed(() => store.getters['organization/getOrganizationById'](targetOrganizationId.value))
  const organization = computed(() =>
    prefetchedOrganization.value?.id ? prefetchedOrganization.value : store.state.organization.organization,
  )

  const newOrganizationInit = {
    id: null,
    name: null,
    location: null,
    logo: null,
    rmImage: null,
  }
  const newOrganization = reactive({ ...newOrganizationInit })

  const form = ref(null)
  const isFormValid = ref(true)

  function handleLogoUpdate (file) {
    newOrganization.logo = file
    if (organization.value.logo) newOrganization.rmImage = organization.value.logo
  }

  function handleLogoDelete () {
    newOrganization.logo = null
    newOrganization.rmImage = organization.value.logo
  }

  const redirectDestination = computed(() => {
    if (store.getters['auth/isAdmin']) {
      return 'admin-organizations'
    }
    if (store.getters['auth/isOrganizer']) {
      return 'dashboard-organizer'
    }
    return null
  })

  const backRoute = computed(() => {
    if (store.getters['auth/isAdmin']) {
      return { name: 'admin-organizations' }
    }
    if (store.getters['auth/isOrganizer']) {
      return { name: 'dashboard-organizer' }
    }
    return null
  })

  async function handleEditOrganization () {
    await form.value.validate()
    if (!isFormValid.value) return

    const formData = new FormData()
    formData.append('id', newOrganization.id)
    formData.append('name', newOrganization.name)
    formData.append('location', newOrganization.location ?? '')

    if (newOrganization.logo) formData.append('files', newOrganization.logo)
    if (newOrganization.rmImage) formData.append('rmImage', newOrganization.rmImage)

    await store.dispatch('organization/save', formData).then(result => {
      Object.assign(newOrganization, {
        ...newOrganizationInit,
      })
      router.push({
        name: redirectDestination.value,
      })
    })
  }

  async function fetchData () {
    if (!organization.value?.id) {
      await store.dispatch('organization/setOrganization', targetOrganizationId.value)
    }
  }

  onMounted(async () => {
    await fetchData()
    Object.assign(newOrganization, {
      ...organization.value,
    })
  })
</script>

<template>
  <v-container class="organization-edit-container">
    <!-- Header Section -->
    <PageTitle
      :back-route="backRoute"
      subtitle="Update your organization details and configuration"
      title="Edit Organization"
    />

    <v-row justify="center">
      <v-col
        cols="12"
        lg="8"
        xl="6"
      >
        <v-card
          class="form-card rounded-xl"
          elevation="4"
          :rounded="rounded"
        >
          <v-card-text class="pa-6">
            <v-form
              ref="form"
              v-model="isFormValid"
              fast-fail
              @submit.prevent="handleEditOrganization"
            >
              <v-text-field
                v-model="newOrganization.name"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                label="Organization Name"
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
                label="Location"
                prepend-inner-icon="mdi-map-marker"
                :rounded="rounded"
                :variant="variant"
              />

              <!-- Current Image Preview -->
              <ImageManager
                v-if="organization.logo && organization.logo !== 'null' && organization.logo.trim() !== ''"
                :src="getOrganizationImageUrl(organization.logo)"
                @delete="handleLogoDelete"
              />

              <!-- Upload Component -->
              <v-file-upload
                accept="image/*"
                class="mb-4"
                clearable
                density="compact"
                :rounded="rounded"
                :rules="[
                  (v) =>
                    !v ||
                    (Array.isArray(v) ? v : [v]).every((file) => isValidImage(file)) ||
                    'Only jpg/jpeg/png allowed!',
                ]"
                show-size
                title="Update Logo"
                :variant="variant"
                @update:model-value="handleLogoUpdate"
              />

              <div class="d-flex align-center mt-3 mt-md-4">
                <v-spacer />
                <v-btn
                  color="primary"
                  :density="density"
                  :rounded="rounded"
                  :size="size"
                  type="submit"
                >
                  Save
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
.v-avatar {
  border-radius: 0;
}

.v-avatar.v-avatar--density-default {
  width: calc(var(--v-avatar-height) + 80px);
}
</style>
