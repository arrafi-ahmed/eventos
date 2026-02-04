<template>
  <div class="quick-intent-buttons">
    <v-btn
      v-for="intentKey in SUPPORT_INTENTS"
      :key="intentKey"
      class="intent-button"
      :density="density"
      :rounded="rounded"
      :size="size"
      :variant="variant"
      @click="$emit('select', intentKey)"
    >
      {{ t('components.support_bot.intents.' + intentKey) }}
    </v-btn>
  </div>
</template>

<script setup>
  import { useI18n } from 'vue-i18n'
  import { useUiProps } from '@/composables/useUiProps'
  import { INTENT_CONFIG, SUPPORT_INTENTS } from '@/utils/supportIntents'

  const { t } = useI18n()
  const { rounded, size, variant, density } = useUiProps()

  defineEmits(['select'])
</script>

<style scoped>
.quick-intent-buttons {
  margin-top: 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.intent-button {
  text-transform: none;
  white-space: normal;
  height: auto;
  min-height: 48px;
  padding: 8px 16px;
  flex: 0 1 auto;
  min-width: fit-content;
}
</style>
