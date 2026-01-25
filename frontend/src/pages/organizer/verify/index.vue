<script setup>
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { getApiPublicImageUrl } from '@/utils'

  definePage({
    name: 'organizer-verify',
    meta: {
      layout: 'default',
      title: 'Identity Verification',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const store = useStore()
  const router = useRouter()

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const idDocumentFiles = ref([])
  const uploading = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)

  const hasExistingDocument = computed(() => !!currentUser.value?.id_document)
  const verificationStatus = computed(() => currentUser.value?.verification_status || 'pending')

  const allowedDocumentTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'])
  const maxDocumentSize = 10 * 1024 * 1024 // 10MB

  const documentRules = [
    value => !!getFirstFile(value) || 'ID document is required',
    value => {
      const file = getFirstFile(value)
      return !file || allowedDocumentTypes.has(file.type) || 'Please upload a JPG, PNG, or PDF file'
    },
    value => {
      const file = getFirstFile(value)
      return !file || file.size <= maxDocumentSize || 'File size must be less than 10MB'
    },
  ]

  const selectedDocument = computed(() => getFirstFile(idDocumentFiles.value))

  function getFirstFile (value) {
    if (!value) return null
    if (Array.isArray(value)) return value[0] || null
    return value
  }

  async function uploadIdDocument () {
    await form.value.validate()
    if (!isFormValid.value || !selectedDocument.value) return

    uploading.value = true
    try {
      const formData = new FormData()
      formData.append('files', selectedDocument.value)

      const response = await $axios.post('/organizer/upload-id', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      })

      // Update current user in store
      store.commit('auth/setCurrentUser', {
        ...currentUser.value,
        id_document: response.data?.payload?.id_document,
        verification_status: 'pending',
      })

      idDocumentFiles.value = []
      router.push({ name: 'dashboard-organizer' })
    } catch (error) {
      console.error('Error uploading ID:', error)
      store.commit('addSnackbar', {
        text: 'Failed to upload ID document. Please try again.',
        color: 'error',
      })
    } finally {
      uploading.value = false
    }
  }

  function getDocumentUrl (filename) {
    if (!filename) return null
    return getApiPublicImageUrl(filename, 'id-document')
  }
</script>

<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="8" offset-md="2">
        <PageTitle
          subtitle="Upload your government-issued ID for verification"
          title="Identity Verification"
        />

        <v-card class="mt-6">
          <v-card-text>
            <v-form
              ref="form"
              v-model="isFormValid"
              @submit.prevent="uploadIdDocument"
            >
              <!-- Current Status -->
              <v-alert
                v-if="hasExistingDocument"
                class="mb-6"
                :color="verificationStatus === 'pending' ? 'warning' : verificationStatus === 'approved' ? 'success' : 'error'"
                variant="tonal"
              >
                <div class="d-flex align-center justify-space-between">
                  <div>
                    <div class="font-weight-bold mb-1">
                      Status: {{
                        verificationStatus === 'pending' ? 'Pending Review' : verificationStatus === 'approved' ?
                          'Approved' : 'Rejected'
                      }}
                    </div>
                    <div v-if="verificationStatus === 'rejected' && currentUser?.rejection_reason" class="text-body-2">
                      Rejection Reason: {{ currentUser.rejection_reason }}
                    </div>
                  </div>
                  <v-btn
                    v-if="currentUser?.id_document"
                    icon="mdi-eye"
                    variant="text"
                    @click="window.open(getDocumentUrl(currentUser.id_document), '_blank')"
                  >
                    <v-tooltip activator="parent">View Current Document</v-tooltip>
                  </v-btn>
                </div>
              </v-alert>

              <!-- Instructions -->
              <v-alert
                class="mb-6"
                color="info"
                variant="tonal"
              >
                <div class="text-body-1 font-weight-bold mb-2">Upload Requirements:</div>
                <ul class="text-body-2">
                  <li>Government-issued ID (Driver's License, Passport, National ID, etc.)</li>
                  <li>File formats: JPG, PNG, or PDF</li>
                  <li>Maximum file size: 10MB</li>
                  <li>Document must be clear and readable</li>
                </ul>
              </v-alert>

              <!-- File Upload -->
              <v-file-upload
                v-model="idDocumentFiles"
                accept="image/jpeg,image/jpg,image/png,application/pdf"
                clearable
                density="compact"
                icon="$upload"
                :rounded="rounded"
                :rules="documentRules"
                show-size
                title="Upload ID Document"
                variant="compact"
              />

              <!-- Submit Button -->
              <div class="mt-6 d-flex gap-3">
                <v-btn
                  color="primary"
                  :disabled="uploading || !selectedDocument"
                  :loading="uploading"
                  prepend-icon="mdi-upload"
                  :rounded="rounded"
                  :size="size"
                  type="submit"
                  :variant="variant"
                >
                  {{ hasExistingDocument ? 'Update ID Document' : 'Upload ID Document' }}
                </v-btn>
                <v-btn
                  :rounded="rounded"
                  :size="size"
                  :to="{ name: 'dashboard-organizer' }"
                  :variant="variant"
                >
                  Cancel
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
.gap-3 {
  gap: 12px;
}
</style>
