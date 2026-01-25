<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { useRoute } from 'vue-router'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatPrice } from '@/utils'

  definePage({
    name: 'event-promo-codes',
    meta: {
      layout: 'default',
      title: 'Promo Codes',
      requiresAuth: true,
      requiresOrganizer: true,
    },
  })

  const { rounded, size, density, variant } = useUiProps()
  const store = useStore()
  const route = useRoute()

  const eventId = computed(() => route.params.eventId)
  const event = computed(() => store.state.event.event)
  const promoCodes = computed(() => store.getters['promoCode/getPromoCodesByEventId'](eventId.value))

  const loading = ref(false)
  const submitting = ref(false)
  const dialog = ref(false)
  const deleteDialog = ref(false)
  const selectedPromoCode = ref(null)

  const form = ref(null)
  const isFormValid = ref(true)

  const promoData = ref({
    id: null,
    code: '',
    discountType: 'percentage',
    discountValue: 0,
    usageLimit: null,
    validFrom: null,
    validUntil: null,
    isActive: true,
  })

  const validRange = ref([])

  const headers = [
    { title: 'Code', key: 'code', align: 'start' },
    { title: 'Discount', key: 'discount' },
    { title: 'Usage', key: 'usage' },
    { title: 'Status', key: 'isActive' },
    { title: 'Actions', key: 'actions', sortable: false, align: 'end' },
  ]

  function openAddDialog () {
    promoData.value = {
      id: null,
      code: '',
      discountType: 'percentage',
      discountValue: 0,
      usageLimit: null,
      validFrom: null,
      validUntil: null,
      isActive: true,
    }
    validRange.value = []
    dialog.value = true
  }

  function openEditDialog (item) {
    promoData.value = {
      ...item,
      discountValue: item.discountType === 'fixed' ? item.discountValue / 100 : item.discountValue,
    }

    validRange.value = []
    if (item.validFrom) validRange.value.push(new Date(item.validFrom))
    if (item.validUntil) validRange.value.push(new Date(item.validUntil))

    dialog.value = true
  }

  function openDeleteDialog (item) {
    selectedPromoCode.value = item
    deleteDialog.value = true
  }

  async function handleSave () {
    await form.value.validate()
    if (!isFormValid.value) return

    submitting.value = true
    if (validRange.value && validRange.value.length === 2) {
      promoData.value.validFrom = validRange.value[0]
      promoData.value.validUntil = validRange.value[1]
    } else {
      promoData.value.validFrom = null
      promoData.value.validUntil = null
    }

    const payload = {
      ...promoData.value,
      organizationId: event.value.organizationId,
      eventId: eventId.value,
      discountValue: promoData.value.discountType === 'fixed'
        ? promoData.value.discountValue * 100
        : promoData.value.discountValue,
    }

    store
      .dispatch('promoCode/savePromoCode', payload)
      .then(() => {
        dialog.value = false
      })
      .finally(() => {
        submitting.value = false
      })
  }

  async function handleDelete (item) {
    submitting.value = true
    store
      .dispatch('promoCode/deletePromoCode', item.id)
      .finally(() => {
        submitting.value = false
      })
  }

  function formatDiscount (item) {
    if (item.discountType === 'percentage') return `${item.discountValue}%`
    if (item.discountType === 'fixed') return formatPrice(item.discountValue, event.value?.currency)
    return 'Free'
  }

  onMounted(() => {
    loading.value = true
    store.dispatch('event/setEvent', { eventId: eventId.value })
    store.dispatch('promoCode/fetchPromoCodes').finally(() => {
      loading.value = false
    })
  })
</script>

<template>
  <v-container>
    <PageTitle
      :subtitle="`Manage promotional discounts for ${event?.name || 'Loading...'}`"
      title="Promo Codes"
    >
      <template #actions>
        <v-btn
          color="primary"
          :density="density"
          prepend-icon="mdi-plus"
          :rounded="rounded"
          :size="size"
          variant="flat"
          @click="openAddDialog"
        >
          Add Code
        </v-btn>
      </template>
    </PageTitle>

    <v-row justify="center">
      <v-col cols="12">
        <v-card
          class="mt-6 rounded-xl"
          elevation="1"
          :rounded="rounded"
        >
          <v-data-table
            class="elevation-0"
            :headers="headers"
            :items="promoCodes"
            :loading="loading"
          >
            <template #[`item.code`]="{ item }">
              <span class="font-weight-bold mono">{{ item.code }}</span>
            </template>

            <template #[`item.discount`]="{ item }">
              <v-chip :color="item.discountType === 'fixed' ? 'primary' : 'secondary'" size="small">
                {{ formatDiscount(item) }}
              </v-chip>
            </template>

            <template #[`item.usage`]="{ item }">
              {{ item.usageCount }} / {{ item.usageLimit || '∞' }}
            </template>

            <template #[`item.isActive`]="{ item }">
              <v-chip :color="item.isActive ? 'success' : 'grey'" size="small" variant="tonal">
                {{ item.isActive ? 'Active' : 'Inactive' }}
              </v-chip>
            </template>

            <template #[`item.actions`]="{ item }">
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
                    title="Edit"
                    @click="openEditDialog(item)"
                  />
                  <v-divider />
                  <confirmation-dialog
                    popup-content="Are you sure you want to delete this promo code? This action cannot be undone."
                    @confirm="handleDelete(item)"
                  >
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
                icon="mdi-ticket-percent-outline"
                message="No promo codes created for this event yet. Create one to offer discounts to your attendees!"
                title="No Promo Codes"
              />
            </template>
          </v-data-table>
        </v-card>

        <!-- Add/Edit Dialog -->
        <v-dialog v-model="dialog" max-width="600">
          <v-card :rounded="rounded">
            <v-card-title>{{ promoData.id ? 'Edit' : 'Add' }} Promo Code</v-card-title>
            <v-card-text>
              <v-form ref="form" v-model="isFormValid" @submit.prevent="handleSave">
                <v-row>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model="promoData.code"
                      :density="density"
                      hide-details="auto"
                      label="Promo Code"
                      placeholder="e.g. EARLYBIRD20"
                      :rounded="rounded"
                      :rules="[v => !!v || 'Code is required']"
                      :variant="variant"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-select
                      v-model="promoData.discountType"
                      :density="density"
                      hide-details="auto"
                      :items="[
                        { title: 'Percentage (%)', value: 'percentage' },
                        { title: 'Fixed Amount', value: 'fixed' },
                        { title: 'Free', value: 'free' }
                      ]"
                      label="Discount Type"
                      :rounded="rounded"
                      :variant="variant"
                    />
                  </v-col>
                  <v-col v-if="promoData.discountType !== 'free'" cols="12" sm="6">
                    <v-text-field
                      v-model.number="promoData.discountValue"
                      :density="density"
                      hide-details="auto"
                      label="Discount Value"
                      :prefix="promoData.discountType === 'fixed' ? '$' : ''"
                      :rounded="rounded"
                      :rules="[v => !!v || 'Value is required']"
                      :suffix="promoData.discountType === 'percentage' ? '%' : ''"
                      type="number"
                      :variant="variant"
                    />
                  </v-col>
                  <v-col cols="12" sm="6">
                    <v-text-field
                      v-model.number="promoData.usageLimit"
                      :density="density"
                      hide-details="auto"
                      label="Usage Limit (Optional)"
                      placeholder="Leave empty for unlimited"
                      :rounded="rounded"
                      type="number"
                      :variant="variant"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-date-input
                      v-model="validRange"
                      :density="density"
                      hide-details="auto"
                      label="Validity Period"
                      multiple="range"
                      prepend-icon=""
                      prepend-inner-icon="mdi-calendar-range"
                      :rounded="rounded"
                      :variant="variant"
                    />
                  </v-col>
                  <v-col cols="12">
                    <v-switch
                      v-model="promoData.isActive"
                      color="primary"
                      hide-details="auto"
                      label="Is Active"
                    />
                  </v-col>
                </v-row>
              </v-form>
            </v-card-text>
            <v-card-actions>
              <v-spacer />
              <v-btn :rounded="rounded" variant="text" @click="dialog = false">Cancel</v-btn>
              <v-btn
                color="primary"
                :loading="submitting"
                :rounded="rounded"
                variant="flat"
                @click="handleSave"
              >
                Save
              </v-btn>
            </v-card-actions>
          </v-card>
        </v-dialog>

      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.mono {
  font-family: monospace;
  font-size: 1.1em;
  letter-spacing: 1px;
}
</style>
