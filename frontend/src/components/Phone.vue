<script setup>
  import { computed, onMounted, reactive, ref, watch } from 'vue'
  import { useDisplay } from 'vuetify'
  import { useUiProps } from '@/composables/useUiProps'

  const props = defineProps({
    modelValue: { type: String, default: '' },
    inputItem: { type: Object, required: true },
    customClass: { type: String, default: '' },
    variant: { type: String, default: null },
    density: { type: String, default: null },
  })

  const uiProps = useUiProps()
  const variant = computed(() => props.variant || uiProps.variant.value)
  const density = computed(() => props.density || uiProps.density.value)
  const rounded = uiProps.rounded
  const { mobile } = useDisplay()
  const emit = defineEmits(['updatePhone', 'update:modelValue'])

  const selectedCountry = reactive({ dialCode: '' })
  const code = ref('US') // Default country code
  const phone = ref('')
  const searchQuery = ref('')
  const menu = ref(false)

  const filteredCountries = computed(() => {
    const q = searchQuery.value.toLowerCase()
    return props.inputItem.options.filter(c =>
      !q || c.name?.toLowerCase().includes(q) || c.dialCode.includes(q),
    )
  })

  function onSelect (iso) {
    const match = props.inputItem.options.find(i => i.code === iso)
    if (match) Object.assign(selectedCountry, match)
    searchQuery.value = ''
    menu.value = false
    if (phone.value) sync()
  }

  function sync () {
    const val = `${selectedCountry.dialCode}${phone.value}`
    emit('update:modelValue', val)
    emit('updatePhone', { formattedPhone: val })
  }

  onMounted(() => {
    const val = props.modelValue
    if (val) {
      const match = [...props.inputItem.options]
        .sort((a, b) => b.dialCode.length - a.dialCode.length)
        .find(opt => val.startsWith(opt.dialCode))
      if (match) {
        code.value = match.code
        Object.assign(selectedCountry, match)
        phone.value = val.slice(match.dialCode.length)
        return
      }
    }
    onSelect('US')
  })

  watch(() => props.modelValue, v => {
    const currentVal = `${selectedCountry.dialCode}${phone.value}`
    if (v && v !== currentVal) {
      const match = [...props.inputItem.options]
        .sort((a, b) => b.dialCode.length - a.dialCode.length)
        .find(opt => v.startsWith(opt.dialCode))
      if (match) {
        code.value = match.code
        Object.assign(selectedCountry, match)
        phone.value = v.slice(match.dialCode.length)
      }
    }
  })
</script>

<template>
  <v-row
    class="phone"
    no-gutters
  >
    <v-col cols="auto">
      <v-menu
        v-model="menu"
        :close-on-content-click="false"
        location="bottom start"
        transition="scale-transition"
      >
        <template #activator="{ props: menuProps }">
          <v-text-field
            v-bind="menuProps"
            :class="['dialCode', props.customClass]"
            :density="density"
            hide-details="auto"
            :model-value="selectedCountry.flag ? `${selectedCountry.flag} ${selectedCountry.dialCode}` : selectedCountry.dialCode"
            prepend-inner-icon="mdi-phone"
            readonly
            :rounded="`s-${rounded} e-0`"
            :rules="[(v) => !!v || !props.inputItem.required || 'required']"
            :variant="variant"
          />
        </template>
        <v-card :min-width="mobile ? '100%' : '300px'">
          <v-text-field
            v-model="searchQuery"
            autofocus
            class="pa-2"
            clearable
            :density="density"
            hide-details
            label="Search country..."
            prepend-inner-icon="mdi-magnify"
            variant="outlined"
          />
          <v-divider />
          <v-list
            density="compact"
            :max-height="mobile ? '300px' : '300px'"
          >
            <v-list-item
              v-for="country in filteredCountries"
              :key="country.code"
              :active="code === country.code"
              color="primary"
              @click="code = country.code; onSelect(country.code)"
            >
              <template #prepend>
                <span class="mr-3">{{ country.flag }}</span>
              </template>
              <v-list-item-title class="font-weight-bold">
                {{ country.name }} {{ country.dialCode }}
              </v-list-item-title>
              <template #append>
                <v-icon
                  v-if="code === country.code"
                  color="primary"
                >
                  mdi-check
                </v-icon>
              </template>
            </v-list-item>
            <v-list-item
              v-if="filteredCountries.length === 0"
              disabled
            >
              <v-list-item-title>No countries found</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-card>
      </v-menu>
    </v-col>
    <v-col
      class="flex-grow-1 phone-number-col"
      cols="auto"
    >
      <v-text-field
        v-model="phone"
        :class="[props.customClass]"
        clearable
        :density="density"
        hide-details="auto"
        :label="props.inputItem.text"
        :rounded="`s-0 e-${rounded}`"
        :rules="[(v) => !!v || !props.inputItem.required || 'required!']"
        :variant="variant"
        @update:model-value="sync"
      >
        <template #label>
          <span>{{ props.inputItem.text }}</span>
          <span
            v-if="props.inputItem.required"
            class="text-error"
          >*</span>
        </template>
      </v-text-field>
    </v-col>
  </v-row>
</template>

<style scoped>
.phone .dialCode .v-field__input {
  padding: 5px 0 5px 10px !important;
}

.phone .dialCode .v-field--appended {
  padding-inline-end: 2px;
}

/* Fixed width for dial code field */
.phone :deep(.dialCode .v-field) {
  min-width: 100px;
  max-width: 120px;
  width: 120px;
}

/* Mobile optimizations */
@media (max-width: 600px) {
  .phone :deep(.dialCode .v-field) {
    min-width: 80px;
    max-width: 100px;
    width: 100px;
  }

  .phone :deep(.phone-number-col .v-field) {
    min-width: 0;
    flex: 1 1 auto;
  }
}
</style>
