<script setup>
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useUiProps } from '@/composables/useUiProps'
import { currencies } from '@/utils/currency-list'

const props = defineProps({
  modelValue: { type: String, default: 'USD' },
  label: { type: String, default: 'Currency' },
  required: { type: Boolean, default: true },
  customClass: { type: String, default: '' },
})

const emit = defineEmits(['update:modelValue'])

const uiProps = useUiProps()
const variant = uiProps.variant
const density = uiProps.density
const rounded = uiProps.rounded
const { mobile } = useDisplay()

const searchQuery = ref('')
const menu = ref(false)

const filteredCurrencies = computed(() => {
  const q = searchQuery.value.toLowerCase()
  return currencies.filter(c =>
    !q || 
    c.name.toLowerCase().includes(q) || 
    c.code.toLowerCase().includes(q) ||
    c.symbol.toLowerCase().includes(q)
  )
})

const selectedCurrency = computed(() => {
  return currencies.find(c => c.code === props.modelValue) || currencies[0]
})

function onSelect(code) {
  emit('update:modelValue', code)
  searchQuery.value = ''
  menu.value = false
}
</script>

<template>
  <v-menu
    v-model="menu"
    :close-on-content-click="false"
    location="bottom start"
    transition="scale-transition"
  >
    <template #activator="{ props: menuProps }">
      <v-text-field
        v-bind="menuProps"
        :class="['mb-2 mb-md-4', customClass]"
        :density="density"
        hide-details="auto"
        :label="label"
        :model-value="`${selectedCurrency.flag} ${selectedCurrency.code} ${selectedCurrency.symbol ? '(' + selectedCurrency.symbol + ')' : ''}`"
        prepend-inner-icon="mdi-cash-multiple"
        readonly
        :rounded="rounded"
        :rules="[(v) => !!v || !required || 'Currency is required!']"
        :variant="variant"
      >
        <template #label>
          <span>{{ label }}</span>
          <span v-if="required" class="text-error">*</span>
        </template>
      </v-text-field>
    </template>

    <v-card :min-width="mobile ? '100%' : '350px'" elevation="4" :rounded="rounded">
      <v-text-field
        v-model="searchQuery"
        autofocus
        class="pa-2"
        clearable
        :density="density"
        hide-details
        label="Search currency..."
        prepend-inner-icon="mdi-magnify"
        :rounded="rounded"
        variant="outlined"
      />
      <v-divider />
      <v-list
        class="currency-list"
        density="compact"
        max-height="300px"
      >
        <v-list-item
          v-for="currency in filteredCurrencies"
          :key="currency.code"
          :active="modelValue === currency.code"
          color="primary"
          @click="onSelect(currency.code)"
        >
          <template #prepend>
            <span class="mr-3">{{ currency.flag }}</span>
          </template>
          <v-list-item-title class="font-weight-bold">
            {{ currency.code }}
          </v-list-item-title>
          <v-list-item-subtitle>
            {{ currency.name }} {{ currency.symbol ? '(' + currency.symbol + ')' : '' }}
          </v-list-item-subtitle>
          <template #append>
            <v-icon v-if="modelValue === currency.code" color="primary">mdi-check</v-icon>
          </template>
        </v-list-item>
        
        <v-list-item v-if="filteredCurrencies.length === 0" disabled>
          <v-list-item-title class="text-center py-4 text-medium-emphasis">
            No currencies found
          </v-list-item-title>
        </v-list-item>
      </v-list>
    </v-card>
  </v-menu>
</template>

<style scoped>
.currency-list {
  overflow-y: auto;
}
</style>
