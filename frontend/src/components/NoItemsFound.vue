<script setup>
  const props = defineProps({
    title: {
      type: String,
      default: 'No items found',
    },
    message: {
      type: String,
      default: 'No items available at the moment.',
    },
  })
</script>

<template>
  <v-alert
    border="start"
    closable
    density="compact"
    type="info"
  >
    <div class="font-weight-medium">
      {{ title }}
    </div>
    <div class="text-caption">
      {{ message }}
    </div>
  </v-alert>
</template>
