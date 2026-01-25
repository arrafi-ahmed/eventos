<script setup>
  import { ref } from 'vue'
  import { useUiProps } from '@/composables/useUiProps'

  const { density, rounded, variant } = useUiProps()

  const props = defineProps({
    modelValue: {
      type: String,
      default: '#000000',
    },
    label: {
      type: String,
      required: true,
    },
    pickerKey: {
      type: String,
      required: true,
    },
  })

  const emit = defineEmits(['update:modelValue'])

  const isPickerOpen = ref(false)

  function updateColor (value) {
    const colorValue = typeof value === 'string' ? value : (value?.hex || '#000000')
    emit('update:modelValue', colorValue)
  }

  function formatLabel (key) {
    return key.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }
</script>

<template>
  <div class="d-flex align-center gap-2">
    <v-menu
      v-model="isPickerOpen"
      :close-on-content-click="false"
      location="bottom start"
    >
      <template #activator="{ props: menuProps }">
        <v-text-field
          class="flex-grow-0"
          :density="density"
          hide-details="auto"
          label=""
          :model-value="modelValue"
          readonly
          :rounded="rounded"
          single-line
          style="max-width: 48px;"
          v-bind="menuProps"
          variant="solo-filled"
          @click="isPickerOpen = true"
        >
          <template #prepend-inner>
            <div
              class="color-preview cursor-pointer"
              :style="{ backgroundColor: modelValue || '#000000' }"
            />
          </template>
        </v-text-field>
      </template>
      <v-color-picker
        mode="hex"
        :model-value="modelValue || '#000000'"
        @update:model-value="updateColor"
      />
    </v-menu>
    <v-text-field
      class="flex-grow-1"
      :density="density"
      hide-details="auto"
      :label="`${formatLabel(label)} (Hex)`"
      :model-value="modelValue"
      placeholder="#FFFFFF"
      :rounded="rounded"
      :variant="variant"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<style scoped>
.color-preview {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid rgba(0, 0, 0, 0.2);
  flex-shrink: 0;
}

.cursor-pointer {
  cursor: pointer;
}

.gap-2 {
  gap: 8px;
}
</style>
