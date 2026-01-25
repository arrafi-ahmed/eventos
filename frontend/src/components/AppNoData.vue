<script setup>
  import { useUiProps } from '@/composables/useUiProps'

  const props = defineProps({
    icon: {
      type: String,
      default: 'mdi-information-outline',
    },
    title: {
      type: String,
      default: 'No items found',
    },
    message: {
      type: String,
      default: 'There are no items to display at the moment.',
    },
  })

  const { rounded } = useUiProps()
</script>

<template>
  <div class="text-center py-10 px-4">
    <v-icon
      color="grey-lighten-1"
      :icon="icon"
      size="80"
    />
    <h3 class="text-h6 font-weight-bold grey--text text--darken-2 mt-4">
      {{ title }}
    </h3>
    <p class="text-body-2 text-medium-emphasis mt-2 mx-auto" style="max-width: 400px;">
      {{ message }}
    </p>
    <div v-if="$slots.actions" class="mt-6">
      <slot name="actions" />
    </div>
  </div>
</template>

<style scoped>
.text-medium-emphasis {
  opacity: 0.7;
}
</style>
