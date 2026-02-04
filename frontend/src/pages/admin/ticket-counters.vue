<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { useI18n } from 'vue-i18n'
  import { TicketCounter } from '@/models/TicketCounter'

  definePage({
    name: 'admin-ticket-counters',
    meta: {
      layout: 'default',
      title: 'Ticket Counters',
      titleKey: 'organizer.counters.title',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { t } = useI18n()
  const { rounded, density, size, variant } = useUiProps()
  const store = useStore()

  // Computed UI Pattern
  const ui = computed(() => ({
    titleKey: 'organizer.counters.title',
    title: t('pages.organizer.counters.title'),
    subtitle: t('pages.organizer.counters.subtitle'),
    add_counter: t('pages.organizer.counters.add'),
    edit_counter: t('pages.organizer.counters.edit'),
    no_data_title: t('pages.organizer.counters.no_data_title'), // Added to organizer.json shortly
    no_data_msg: t('pages.organizer.counters.no_data'),
    form: {
      name: t('pages.organizer.counters.form.name'),
      status: t('pages.organizer.counters.form.status')
    },
    table: {
      name: t('pages.organizer.counters.table.name'),
      status: t('pages.organizer.counters.table.status'),
      created: t('pages.organizer.counters.table.created'),
      actions: t('pages.organizer.counters.table.actions')
    },
    common: {
      save: t('common.save'),
      cancel: t('common.cancel'),
      edit: t('common.edit'),
      delete: t('common.delete'),
      active: t('common.active'),
      inactive: t('common.inactive'),
      confirm_delete: t('common.confirm_delete_msg') // Need to check if these exist in common.json
    }
  }))

  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const organizationId = computed(() => currentUser.value?.organizationId)

  const ticketCounters = ref([])
  const loading = ref(false)

  const dialog = ref(false)
  const dialogEdit = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)

  const counterInit = {
    id: null,
    name: '',
    status: true,
  }
  const counter = reactive({ ...counterInit })

  const headers = computed(() => [
    { title: ui.value.table.name, key: 'name', sortable: true },
    { title: ui.value.table.status, key: 'isActive', sortable: true },
    { title: ui.value.table.created, key: 'createdAt', sortable: true },
    { title: ui.value.table.actions, key: 'actions', sortable: false, align: 'end' },
  ])

  function openAddDialog () {
    Object.assign(counter, counterInit)
    dialog.value = true
  }

  function openEditDialog (item) {
    Object.assign(counter, {
      ...item,
      status: item.isActive,
    })
    dialog.value = true
    dialogEdit.value = true
  }

  async function handleSave () {
    await form.value.validate()
    if (!isFormValid.value) return

    const payload = new TicketCounter({
      ...counter,
      organizationId: organizationId.value,
    }).toJSON()

    store.dispatch('ticketCounter/save', payload).then(() => {
      dialog.value = false
      loadItems()
    })
  }

  function deleteCounter (id) {
    store.dispatch('ticketCounter/deleteTicketCounter', { id }).then(() => {
      loadItems()
    })
  }

  function loadItems () {
    loading.value = true
    store
      .dispatch('ticketCounter/setTicketCounters', {
        organizationId: organizationId.value,
      })
      .then(data => {
        ticketCounters.value = data || []
      })
      .finally(() => {
        loading.value = false
      })
  }

  function formatDate (dateString) {
    if (!dateString) return '-'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  onMounted(() => {
    loadItems()
  })
</script>

<template>
  <v-container>
    <PageTitle
      :back-route="{ name: 'dashboard-organizer' }"
      :subtitle="ui.subtitle"
      :title="ui.title"
      :title-key="ui.titleKey"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          :variant="variant"
          @click="openAddDialog"
        >
          {{ ui.add_counter }}
        </v-btn>
      </template>
    </PageTitle>

    <v-row justify="center">
      <v-col cols="12">
        <v-card elevation="2" :rounded="rounded">
          <v-data-table
            :density="density"
            :headers="headers"
            hover
            :items="ticketCounters"
            :loading="loading"
          >
            <template #item.name="{ item }">
              <div class="font-weight-medium">
                {{ item.name }}
              </div>
            </template>

            <template #item.isActive="{ item }">
              <v-chip
                :color="item.isActive ? 'success' : 'error'"
                :density="density"
                label
                size="small"
              >
                {{ item.isActive ? ui.common.active : ui.common.inactive }}
              </v-chip>
            </template>

            <template #item.createdAt="{ item }">
              {{ formatDate(item.createdAt) }}
            </template>

            <template #item.actions="{ item }">
              <v-menu transition="scale-transition">
                <template #activator="{ props }">
                  <v-btn
                    :density="density"
                    icon="mdi-dots-vertical"
                    variant="text"
                    v-bind="props"
                    @click.stop
                  />
                </template>
                <v-list density="compact" :rounded="rounded">
                  <v-list-item
                    prepend-icon="mdi-pencil"
                    :title="ui.common.edit"
                    @click="openEditDialog(item)"
                  />
                  <v-divider />
                  <confirmation-dialog
                    :popup-content="ui.common.confirm_delete"
                    @confirm="deleteCounter(item.id)"
                  >
                    <template #activator="{ onClick }">
                      <v-list-item
                        class="text-error"
                        prepend-icon="mdi-delete"
                        :title="ui.common.delete"
                        @click.stop="onClick"
                      />
                    </template>
                  </confirmation-dialog>
                </v-list>
              </v-menu>
            </template>

            <template #no-data>
              <AppNoData
                icon="mdi-store-off"
                :message="ui.no_data_msg"
                :title="ui.no_data_title"
              />
            </template>
          </v-data-table>
        </v-card>
      </v-col>
    </v-row>

    <!-- Add/Edit Dialog -->
    <v-dialog v-model="dialog" max-width="500px">
      <v-card :rounded="rounded">
        <v-card-title class="pa-6 pb-0">
          <span class="text-h5">{{ dialogEdit ? ui.common.edit : ui.common.add }} {{ ui.title }}</span>
        </v-card-title>

        <v-card-text class="pa-6">
          <v-form ref="form" v-model="isFormValid" @submit.prevent="handleSave">
            <v-text-field
              v-model="counter.name"
              :density="density"
              :label="ui.form.name"
              prepend-inner-icon="mdi-store"
              required
              :rounded="rounded"
              :rules="[v => !!v || t('rules.required')]"
              :variant="variant"
            />

            <v-switch
              v-model="counter.status"
              class="mt-4"
              color="primary"
              inset
              :label="ui.form.status"
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
            {{ ui.common.cancel }}
          </v-btn>
          <v-btn
            color="primary"
            :rounded="rounded"
            variant="flat"
            @click="handleSave"
          >
            {{ ui.common.save }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.gap-2 {
  gap: 8px;
}
</style>
