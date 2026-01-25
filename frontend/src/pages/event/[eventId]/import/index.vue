<script setup>
  import { ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'import',
    meta: {
      layout: 'default',
      title: 'Import Attendees',
      requiresOrganizer: true,
    },
  })

  const { xs } = useDisplay()
  const store = useStore()
  const route = useRoute()
  const router = useRouter()
  const { rounded, size, variant, density } = useUiProps()

  const attendeeImportDialog = ref(false)
  const guidelinesDialog = ref(false)
  const attendeeImportForm = ref(null)
  const isAttendeeImportFormValid = ref(true)
  const attendeeImportExcel = ref(null)

  async function handleAttendeeImport () {
    if (!attendeeImportExcel.value) {
      store.commit('addSnackbar', {
        text: 'Excel file required!',
        color: 'error',
      })
      return
    }
    const formData = new FormData()
    formData.append('eventId', route.params.eventId)
    formData.append('attendeeImportExcel', attendeeImportExcel.value)

    store.dispatch('registration/bulkImportAttendee', formData).then(result => {
      router.push({ name: 'event-attendees', params: { eventId: route.params.eventId } })
    })
  }
</script>

<template>
  <v-container class="import-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="store.state.event.event?.name || 'Import attendee data from Excel files'"
      title="Import"
    />

    <v-row
      align="center"
      justify="center"
    >
      <v-col>
        <v-card
          class="mx-auto my-4"
          elevation="0"
          max-width="600"
          rounded="lg"
        >
          <v-card-title class="text-center font-weight-bold">
            <v-spacer />
            <v-btn
              color="primary"
              prepend-icon="mdi-information-outline"
              variant="text"
              @click="guidelinesDialog = true"
            >
              Import Guidelines
            </v-btn>
            <v-spacer />
          </v-card-title>
          <v-card-text>
            <v-form
              ref="attendeeImportForm"
              v-model="isAttendeeImportFormValid"
              fast-fail
              @submit.prevent="handleAttendeeImport"
            >
              <v-file-upload
                v-model="attendeeImportExcel"
                accept=".xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                clearable
                density="compact"
                :hide-browse="false"
                icon="$upload"
                show-size
                title="Upload excel"
                variant="compact"
              />

              <v-btn
                block
                class="mt-2 mt-md-4"
                color="primary"
                :density="xs ? 'comfortable' : 'default'"
                rounded="xl"
                size="large"
                type="submit"
              >
                Import Now
              </v-btn>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <!-- Import Guidelines Dialog -->
  <v-dialog
    v-model="guidelinesDialog"
    :max-width="700"
    scrollable
  >
    <v-card>
      <v-card-title class="d-flex align-center">
        <v-icon class="mr-2">mdi-file-excel</v-icon>
        Excel Import Guidelines
      </v-card-title>

      <v-card-text class="pa-6">
        <!-- Main Guidelines Table -->
        <v-table class="mb-4">
          <thead>
            <tr>
              <th class="text-left font-weight-bold">Column</th>
              <th class="text-left font-weight-bold">Type</th>
              <th class="text-left font-weight-bold">Example</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-weight-medium">
                <v-chip color="error" size="small">email</v-chip>
              </td>
              <td>
                <v-chip color="error" size="small" variant="outlined">Required</v-chip>
              </td>
              <td><code>john.doe@example.com</code></td>
            </tr>
            <tr>
              <td class="font-weight-medium">
                <v-chip color="error" size="small">firstName</v-chip>
              </td>
              <td>
                <v-chip color="error" size="small" variant="outlined">Required</v-chip>
              </td>
              <td><code>John</code></td>
            </tr>
            <tr>
              <td class="font-weight-medium">
                <v-chip color="error" size="small">lastName</v-chip>
              </td>
              <td>
                <v-chip color="error" size="small" variant="outlined">Required</v-chip>
              </td>
              <td><code>Doe</code></td>
            </tr>
            <tr>
              <td class="font-weight-medium">
                <v-chip color="info" size="small">phone</v-chip>
              </td>
              <td>
                <v-chip color="info" size="small" variant="outlined">Optional</v-chip>
              </td>
              <td><code>+1-555-123-4567</code></td>
            </tr>
            <tr>
              <td class="font-weight-medium">
                <v-chip color="info" size="small">any other</v-chip>
              </td>
              <td>
                <v-chip color="info" size="small" variant="outlined">Additional</v-chip>
              </td>
              <td><code>company</code>, <code>dietaryRequirements</code></td>
            </tr>
          </tbody>
        </v-table>

        <!-- File Requirements -->
        <v-row class="mt-4">
          <v-col cols="12" md="6">
            <v-card class="pa-3" variant="outlined">
              <h4 class="text-h6 mb-2 d-flex align-center">
                <v-icon class="mr-2" size="small">mdi-file-document</v-icon>
                File Format
              </h4>
              <ul class="ma-0 pa-0" style="list-style: none;">
                <li class="mb-1">• <code>.xlsx</code>, <code>.xls</code> files</li>
                <li class="mb-1">• Headers in first row</li>
                <li class="mb-1">• At least one data row</li>
              </ul>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card class="pa-3" variant="outlined">
              <h4 class="text-h6 mb-2 d-flex align-center">
                <v-icon class="mr-2" size="small">mdi-alert-circle</v-icon>
                Common Errors
              </h4>
              <ul class="ma-0 pa-0" style="list-style: none;">
                <li class="mb-1">• Missing or invalid email</li>
                <li class="mb-1">• Duplicate emails in file</li>
                <li class="mb-0">• Invalid file format</li>
              </ul>
            </v-card>
          </v-col>
        </v-row>
      </v-card-text>

      <v-card-actions class="pa-4">
        <v-spacer />
        <v-btn
          color="primary"
          :rounded="rounded"
          variant="flat"
          :variant="variant"
          @click="guidelinesDialog = false"
        >
          Got it!
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style>
.import-instruction li {
  margin-bottom: 0.5rem;
}
</style>
