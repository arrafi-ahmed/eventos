<script setup>
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
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
  const { t } = useI18n()
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
    value => !!getFirstFile(value) || t('pages.organizer.id_required'),
    value => {
      const file = getFirstFile(value)
      return !file || allowedDocumentTypes.has(file.type) || t('pages.organizer.id_format_error')
    },
    value => {
      const file = getFirstFile(value)
      return !file || file.size <= maxDocumentSize || t('pages.organizer.id_size_error')
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
        text: t('pages.organizer.id_upload_fail'),
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
          :subtitle="t('pages.organizer.verify_subtitle')"
          :title="t('pages.organizer.verify_title')"
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
                      {{ t('pages.organizer.status_label') }}: {{
                        verificationStatus === 'pending' ? t('pages.organizer.pending_review') : verificationStatus === 'approved' ?
                          t('pages.organizer.approved') : t('pages.organizer.rejected')
                      }}
                    </div>
                    <div v-if="verificationStatus === 'rejected' && currentUser?.rejection_reason" class="text-body-2">
                      {{ t('pages.organizer.rejection_reason_label') }}: {{ currentUser.rejection_reason }}
                    </div>
                  </div>
                  <v-btn
                    v-if="currentUser?.id_document"
                    icon="mdi-eye"
                    variant="text"
                    @click="window.open(getDocumentUrl(currentUser.id_document), '_blank')"
                  >
                    <v-tooltip activator="parent">{{ t('pages.organizer.view_document') }}</v-tooltip>
                  </v-btn>
                </div>
              </v-alert>

              <!-- Instructions -->
              <v-alert
                class="mb-6"
                color="info"
                variant="tonal"
              >
                <div class="text-body-1 font-weight-bold mb-2">{{ t('pages.organizer.upload_requirements') }}</div>
                <ul class="text-body-2">
                  <li>{{ t('pages.organizer.id_req_1') }}</li>
                  <li>{{ t('pages.organizer.id_req_2') }}</li>
                  <li>{{ t('pages.organizer.id_req_3') }}</li>
                  <li>{{ t('pages.organizer.id_req_4') }}</li>
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
                :title="t('pages.organizer.upload_id')"
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
                  {{ hasExistingDocument ? t('pages.organizer.update_id') : t('pages.organizer.upload_id') }}
                </v-btn>
                <v-btn
                  :rounded="rounded"
                  :size="size"
                  :to="{ name: 'dashboard-organizer' }"
                  :variant="variant"
                >
                  {{ t('common.cancel') }}
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
