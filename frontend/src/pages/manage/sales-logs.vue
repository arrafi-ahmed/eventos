<script setup>
  import { onMounted, ref, computed } from 'vue'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import $axios from '@/plugins/axios'
  import { formatDate, formatDateTime, formatPrice } from '@/utils'

  definePage({
    name: 'manage-sales-logs',
    meta: {
      layout: 'default',
      title: 'Cashier Sales Logs',
      titleKey: 'pages.manage.sales_logs',
      requiresOrganizer: true,
      requiresAuth: true,
    },
  })

  const { rounded, density, variant } = useUiProps()
  const { t } = useI18n()
  const store = useStore()
  
  const loading = ref(false)
  const sales = ref([])
  const searchKeyword = ref('')
  
  const headers = [
    { title: 'Date', key: 'saleDate' },
    { title: 'Order #', key: 'orderNumber' },
    { title: 'Cashier', key: 'cashierName' },
    { title: 'Ticket', key: 'ticketTitle' },
    { title: 'Price', key: 'ticketPrice', align: 'end' },
    { title: 'Qty', key: 'quantity', align: 'center' },
    { title: 'Payment', key: 'paymentMethod', align: 'center' },
    { title: 'Total', key: 'totalAmount', align: 'end' },
  ]

  async function fetchSales() {
    loading.value = true
    try {
      const response = await $axios.get('/report/cashier-sales-detailed')
      sales.value = response.data?.payload || []
    } catch (error) {
      console.error('Failed to fetch sales logs:', error)
      store.commit('addSnackbar', { text: 'Failed to load sales logs', color: 'error' })
    } finally {
      loading.value = false
    }
  }

  const filteredSales = computed(() => {
    if (!searchKeyword.value) return sales.value
    const kw = searchKeyword.value.toLowerCase()
    return sales.value.filter(s => 
      s.orderNumber.toLowerCase().includes(kw) || 
      s.cashierName.toLowerCase().includes(kw) ||
      s.ticketTitle.toLowerCase().includes(kw)
    )
  })

  onMounted(() => {
    fetchSales()
  })
</script>

<template>
  <v-container>
    <v-row justify="center">
      <v-col cols="12">
        <PageTitle
          subtitle="Detailed logs of all tickets sold by cashiers"
          title="Cashier Sales Logs"
          :title-key="'pages.manage.sales_logs'"
        />
      </v-col>
    </v-row>

    <v-card class="mt-4" elevation="2" :rounded="rounded">
      <v-card-text>
        <v-text-field
          v-model="searchKeyword"
          append-inner-icon="mdi-magnify"
          clearable
          :density="density"
          hide-details
          label="Search by Order #, Cashier, or Ticket"
          placeholder="Type to search..."
          :rounded="rounded"
          :variant="variant"
          class="mb-4"
        />

        <v-data-table
          :headers="headers"
          :items="filteredSales"
          :loading="loading"
          hover
          class="elevation-0"
        >
          <template #item.saleDate="{ item }">
            <div class="text-caption">{{ formatDateTime({ input: item.saleDate }) }}</div>
          </template>

          <template #item.orderNumber="{ item }">
            <span class="font-weight-bold">#{{ item.orderNumber }}</span>
          </template>

          <template #item.ticketPrice="{ item }">
            {{ formatPrice(item.ticketPrice, item.currency) }}
          </template>

          <template #item.paymentMethod="{ item }">
            <v-chip
              size="x-small"
              :color="item.paymentMethod === 'cash' ? 'success' : 'primary'"
              class="text-uppercase font-weight-bold"
              variant="tonal"
            >
              {{ item.paymentMethod }}
            </v-chip>
          </template>

          <template #item.totalAmount="{ item }">
            <span class="font-weight-bold text-primary">
              {{ formatPrice(item.totalAmount, item.currency) }}
            </span>
          </template>

          <template #no-data>
            <div class="py-12 text-center text-grey">
              <v-icon size="64" class="mb-4">mdi-receipt-text-outline</v-icon>
              <div class="text-h6">No sales logs found</div>
            </div>
          </template>
        </v-data-table>
      </v-card-text>
    </v-card>
  </v-container>
</template>

<style scoped>
</style>
