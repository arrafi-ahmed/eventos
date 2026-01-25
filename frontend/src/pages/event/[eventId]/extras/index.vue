<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'

  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import Extras from '@/models/Extras'
  import ExtrasItem from '@/models/ExtrasItem'
  import { getCurrencySymbol } from '@/utils'

  definePage({
    name: 'event-extras',
    meta: {
      layout: 'default',
      title: 'Event Extras',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const store = useStore()
  const route = useRoute()
  const router = useRouter()
  const { rounded, size, density, variant } = useUiProps()

  const currentUser = computed(() => store.state.auth.currentUser)
  const targetOrganizationId = computed(() => currentUser.value.organizationId)
  const organization = computed(() => store.state.organization.organization)
  const event = computed(() => store.state.event.event)
  const extras = computed(() => store.state.event.extras)

  const newExtras = reactive({ ...new Extras() })

  function openAddExtrasDialog () {
    addExtrasDialog.value = !addExtrasDialog.value
  }

  const addExtrasDialog = ref(false)
  const addExtrasForm = ref(null)
  const isAddExtrasFormValid = ref(true)

  function openEditExtrasDialog ({ id }) {
    editExtrasDialog.value = !editExtrasDialog.value
    const foundExtra = extras.value.find(item => item.id === id)
    if (foundExtra) {
      Object.assign(newExtras, { ...foundExtra })
    }
  }

  const editExtrasDialog = ref(false)
  const editExtrasForm = ref(null)
  const isEditExtrasFormValid = ref(true)

  function addMoreExtrasItems () {
    newExtras.content = newExtras.content.concat({
      ...new ExtrasItem(),
    })
  }

  async function handleExtrasSave () {
    if (addExtrasDialog.value) {
      await addExtrasForm.value.validate()
      if (!isAddExtrasFormValid.value) return
    } else if (editExtrasDialog.value) {
      await editExtrasForm.value.validate()
      if (!isEditExtrasFormValid.value) return
    }

    newExtras.eventId = route.params.eventId

    store.dispatch('event/saveExtras', { newExtras }).then(result => {
      // newEvent = {...newEvent, ...newEventInit}
      Object.assign(newExtras, {
        ...new Extras(),
      })
      if (addExtrasDialog.value) {
        addExtrasDialog.value = !addExtrasDialog.value
      } else if (editExtrasDialog.value) {
        editExtrasDialog.value = !editExtrasDialog.value
      }
    })
  }

  async function deleteExtras ({ extrasId }) {
    await store.dispatch('event/removeExtras', {
      extrasId,
      eventId: route.params.eventId,
    })
  }

  async function fetchData () {
    await Promise.allSettled([
      store.dispatch('organization/setOrganization', targetOrganizationId.value),
      store.dispatch('event/setExtras', route.params.eventId),
      store.dispatch('event/setEvent', { eventId: route.params.eventId }),
    ])
  }

  onMounted(async () => {
    await fetchData()
  })
</script>

<template>
  <v-container class="event-extras-container">
    <!-- Header Section -->
    <PageTitle
      :subtitle="organization.name"
      title="Vouchers"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          @click="openAddExtrasDialog"
        >
          Create
        </v-btn>
      </template>

    </PageTitle>

    <v-row
      v-if="extras.length > 0"
      align="stretch"
      justify="center"
    >
      <v-col
        v-for="(extra, index) in extras"
        cols="12"
        lg="3"
        md="4"
        sm="6"
      >
        <v-card
          class="fill-height"
          rounded="lg"
        >
          <v-card-title>
            <div class="d-flex justify-space-between align-center">
              <div>{{ extra.name }}</div>
              <v-chip density="compact">
                € {{ extra.price }}
              </v-chip>
            </div>
          </v-card-title>
          <v-card-subtitle>
            {{ extra.description }}
          </v-card-subtitle>
          <v-card-text>
            <div>Contents:</div>
            <v-list density="compact">
              <v-list-item v-for="(content, contentIndex) in extra.content">
                <template #prepend>
                  <v-chip
                    density="comfortable"
                    size="small"
                  >
                    {{ content.quantity }} x
                  </v-chip>
                </template>
                <template #title>
                  &nbsp;{{ content.name }}
                </template>
              </v-list-item>
            </v-list>
          </v-card-text>
          <v-card-actions class="justify-space-between">
            <v-btn
              class="border-grey"
              prepend-icon="mdi-square-edit-outline"
              rounded="lg"
              variant="outlined"
              @click="openEditExtrasDialog({ id: extra.id })"
            >
              Edit
            </v-btn>
            <confirmation-dialog @confirm="deleteExtras({ extrasId: extra.id })">
              <template #activator="{ onClick }">
                <v-btn
                  color="error"
                  prepend-icon="mdi-close"
                  rounded="lg"
                  variant="flat"
                  @click="onClick"
                >
                  Delete
                </v-btn>
              </template>
            </confirmation-dialog>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-row v-else>
      <v-col>
        <AppNoData
          icon="mdi-ticket-outline"
          message="No vouchers found for this event. Create your first voucher to offer special deals!"
          title="No Vouchers Found"
        />
      </v-col>
    </v-row>
  </v-container>

  <v-dialog
    v-model="addExtrasDialog"
    :width="500"
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between">
        <h2>Add Voucher</h2>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          @click="addExtrasDialog = !addExtrasDialog"
        />
      </v-card-title>
      <v-card-text>
        <v-form
          ref="addExtrasForm"
          v-model="isAddExtrasFormValid"
          fast-fail
          @submit.prevent="handleExtrasSave"
        >
          <v-text-field
            v-model="newExtras.name"
            class="mt-2"
            clearable
            density="comfortable"
            hide-details="auto"
            label="Name"
            :rules="[(v) => !!v || 'Name is required!']"
            variant="outlined"
          />
          <v-textarea
            v-model="newExtras.description"
            class="mt-2 mt-md-4"
            clearable
            density="comfortable"
            hide-details="auto"
            label="Description"
            :rules="[(v) => !!v || 'Description is required!']"
            variant="outlined"
          />
          <v-text-field
            v-model="newExtras.price"
            class="mt-2 mt-md-4"
            clearable
            density="comfortable"
            hide-details="auto"
            label="Price"
            :prefix="getCurrencySymbol({ code: event?.currency || 'USD', type: 'symbol' })"
            :rules="[(v) => !!v || 'Price is required!']"
            type="number"
            variant="outlined"
          />
          <v-row
            v-for="(item, index) in newExtras.content"
            :key="index"
            no-gutters
          >
            <v-col cols="9">
              <v-text-field
                v-model="item.name"
                class="mt-2 mt-md-4"
                clearable
                density="comfortable"
                hide-details="auto"
                :label="`Item #${index + 1}`"
                :rules="[(v) => !!v || 'Item is required!']"
                variant="outlined"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-model="item.quantity"
                class="mt-2 mt-md-4 ml-2"
                density="comfortable"
                hide-details="auto"
                :label="`Quantity`"
                min="0"
                :rules="[(v) => !!v || 'Quantity is required!']"
                type="number"
                variant="outlined"
              />
            </v-col>
          </v-row>
          <v-btn
            class="mt-2"
            color="primary"
            size="small"
            @click="addMoreExtrasItems"
          >
            Add More Item
          </v-btn>

          <v-card-actions class="mt-2 mt-md-4">
            <v-spacer />
            <v-btn
              color="primary"
              type="submit"
              variant="flat"
            >
              Save
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="editExtrasDialog"
    :width="500"
  >
    <v-card>
      <v-card-title class="d-flex justify-space-between">
        <h2>Edit Voucher</h2>
        <v-btn
          icon="mdi-close"
          size="small"
          variant="text"
          @click="editExtrasDialog = !editExtrasDialog"
        />
      </v-card-title>
      <v-card-text>
        <v-form
          ref="editExtrasForm"
          v-model="isEditExtrasFormValid"
          fast-fail
          @submit.prevent="handleExtrasSave"
        >
          <v-text-field
            v-model="newExtras.name"
            class="mt-2"
            clearable
            density="comfortable"
            hide-details="auto"
            label="Name"
            :rules="[(v) => !!v || 'Name is required!']"
            variant="outlined"
          />
          <v-textarea
            v-model="newExtras.description"
            class="mt-2 mt-md-4"
            clearable
            density="comfortable"
            hide-details="auto"
            label="Description"
            :rules="[(v) => !!v || 'Description is required!']"
            variant="outlined"
          />
          <v-text-field
            v-model="newExtras.price"
            class="mt-2 mt-md-4"
            clearable
            density="comfortable"
            hide-details="auto"
            label="Price"
            :prefix="getCurrencySymbol({ code: event?.currency || 'USD', type: 'symbol' })"
            :rules="[(v) => !!v || 'Price is required!']"
            type="number"
            variant="outlined"
          />
          <v-row
            v-for="(item, index) in newExtras.content"
            :key="index"
            no-gutters
          >
            <v-col cols="9">
              <v-text-field
                v-model="item.name"
                class="mt-2 mt-md-4"
                clearable
                density="comfortable"
                hide-details="auto"
                :label="`Item #${index + 1}`"
                :rules="[(v) => !!v || 'Item is required!']"
                variant="outlined"
              />
            </v-col>
            <v-col cols="3">
              <v-text-field
                v-model="item.quantity"
                class="mt-2 mt-md-4 ml-2"
                density="comfortable"
                hide-details="auto"
                :label="`Quantity`"
                min="0"
                :rules="[(v) => !!v || 'Quantity is required!']"
                type="number"
                variant="outlined"
              />
            </v-col>
          </v-row>
          <v-btn
            class="mt-2"
            color="primary"
            size="small"
            @click="addMoreExtrasItems"
          >
            Add More Item
          </v-btn>

          <v-card-actions class="mt-2 mt-md-4">
            <v-spacer />
            <v-btn
              color="primary"
              type="submit"
              variant="flat"
            >
              Save
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.border-grey {
  border-color: #00000020;
}
</style>
