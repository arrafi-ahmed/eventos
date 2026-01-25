<script setup>
  import { onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { getOrganizationImageUrl } from '@/utils'

  definePage({
    name: 'admin-organizations',
    meta: {
      layout: 'default',
      title: 'Organizations',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { rounded, density, size } = useUiProps()

  const router = useRouter()
  const store = useStore()

  const organizations = ref([])
  const loading = ref(false)
  const totalCount = ref(0)
  const itemsPerPage = ref(10)

  const headers = [
    { title: 'Logo', key: 'logo', sortable: false, width: '100' },
    { title: 'Name', key: 'name', sortable: true },
    { title: 'Location', key: 'location', sortable: true },
    { title: 'Created', key: 'createdAt', sortable: true },
    { title: '', key: 'actions', sortable: false, width: '80' },
  ]

  function handleClickCredential (organization) {
    store.commit('appUser/setOrganization', organization)
    router.push({
      name: 'credential-generate',
      params: {
        organizationId: organization.id,
      },
    })
  }

  function deleteOrganization (organizationId) {
    store.dispatch('organization/removeOrganization', { organizationId }).then(() => {
      // Reload organizations after deletion
      loadItems({ page: 1, itemsPerPage: itemsPerPage.value })
    })
  }

  function loadItems ({ page = 1, itemsPerPage: perPage = 10 } = {}) {
    loading.value = true
    return store
      .dispatch('organization/setOrganizations', {
        page,
        itemsPerPage: perPage,
      })
      .then(({ organizations: fetchedOrganizations, total }) => {
        organizations.value = fetchedOrganizations || []
        if (total !== undefined) {
          totalCount.value = Number(total) || 0
        }
      })
      .catch(error => {
        console.error('Error loading organizations:', error)
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

  function handleRowClick (event, { item }) {
    router.push({
      name: 'organization-edit',
      params: {
        organizationId: item.id,
      },
    })
  }

  onMounted(() => {
    loadItems({ page: 1, itemsPerPage: itemsPerPage.value })
  })
</script>

<template>
  <v-container>
    <PageTitle
      :back-route="{ name: 'admin-dashboard' }"
      subtitle="Manage every organization on the platform"
      title="Organizations"
    >
      <template #actions>
        <v-row align="center">
          <v-divider
            class="mx-2"
            inset
            vertical
          />

          <v-btn
            color="primary"
            :density="density"
            prepend-icon="mdi-plus"
            :rounded="rounded"
            :size="size"
            :to="{ name: 'organization-add' }"
            :variant="variant"
          >
            Add Organization
          </v-btn>
        </v-row>
      </template>
    </PageTitle>

    <v-row justify="center">
      <v-col>
        <v-card
          elevation="2"
          :rounded="rounded"
        >
          <v-card-title class="d-flex align-center justify-space-between">
            <span>All Organizations</span>
          </v-card-title>
          <v-card-text>
            <v-data-table-server
              v-model:items-per-page="itemsPerPage"
              :density="density"
              disable-sort
              :headers="headers"
              hover
              :items="organizations"
              :items-length="totalCount"
              :loading="loading"
              @click:row="handleRowClick"
              @update:options="loadItems"
            >
              <template #item.logo="{ item }">
                <v-avatar
                  :image="getOrganizationImageUrl(item.logo)"
                  rounded="sm"
                  size="60"
                />
              </template>

              <template #item.name="{ item }">
                <div class="font-weight-medium">
                  {{ item.name }}
                </div>
              </template>

              <template #item.location="{ item }">
                <span v-if="item.location">
                  {{ item.location }}
                </span>
                <span
                  v-else
                  class="text-medium-emphasis"
                >
                  -
                </span>
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
                      :rounded="rounded"
                      size="small"
                      v-bind="props"
                      variant="text"
                      @click.stop
                    />
                  </template>
                  <v-list density="compact" :rounded="rounded">
                    <v-list-item
                      density="compact"
                      prepend-icon="mdi-lock"
                      title="Organizer"
                      @click="handleClickCredential(item)"
                    />

                    <v-list-item
                      prepend-icon="mdi-pencil"
                      title="Edit"
                      @click="
                        router.push({
                          name: 'organization-edit',
                          params: { organizationId: item.id },
                        })
                      "
                    />

                    <v-divider />

                    <confirmation-dialog @confirm="deleteOrganization(item.id)">
                      <template #activator="{ onClick }">
                        <v-list-item
                          class="text-error"
                          prepend-icon="mdi-delete"
                          title="Delete"
                          @click.stop="onClick"
                        />
                      </template>
                    </confirmation-dialog>
                  </v-list>
                </v-menu>
              </template>

              <template #no-data>
                <AppNoData
                  icon="mdi-office-building-off-outline"
                  message="No organizations have been created on the platform yet. Add one to get started!"
                  title="No Organizations"
                />
              </template>
            </v-data-table-server>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
