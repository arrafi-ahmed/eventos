<template>
  <div class="intent-form">
    <div class="intent-form-header">
      <span class="text-caption text-medium-emphasis">{{ t('components.support_bot.form.header') }}</span>
    </div>

    <v-form class="intent-form-content" @submit.prevent="handleSubmit">
      <template v-for="(slotConfig, slotKey) in config.slots" :key="slotKey">
        <!-- Textarea for message field -->
        <v-textarea
          v-if="slotConfig.type === 'textarea'"
          density="comfortable"
          :label="slotConfig.description"
          class="intent-form-field"
          :model-value="localFormData[slotKey]"
          :required="slotConfig.required"
          rounded="lg"
          hide-details="auto"
          rows="3"
          variant="outlined"
          @update:model-value="updateField(slotKey, $event)"
        />

        <!-- Select for fieldToUpdate -->
        <v-select
          v-else-if="slotConfig.type === 'select'"
          density="comfortable"
          :label="slotConfig.description"
          class="intent-form-field"
          :model-value="localFormData[slotKey]"
          :items="getSelectItems(slotKey)"
          :required="slotConfig.required"
          hide-details="auto"
          rounded="lg"
          variant="outlined"
          @update:model-value="updateField(slotKey, $event)"
        />

        <!-- Regular text/email input -->
        <v-text-field
          v-else
          density="comfortable"
          :label="slotConfig.description"
          :model-value="localFormData[slotKey]"
          :required="slotConfig.required"
          class="intent-form-field"
          rounded="lg"
          hide-details="auto"
          :type="slotConfig.type === 'email' ? 'email' : 'text'"
          variant="outlined"
          @update:model-value="updateField(slotKey, $event)"
        />
      </template>

      <div class="intent-form-actions">
        <v-btn
          class="text-medium-emphasis"
          size="small"
          variant="text"
          @click="$emit('cancel')"
        >
          {{ t('components.support_bot.form.cancel') }}
        </v-btn>
        <v-btn
          color="primary"
          :loading="loading"
          rounded="lg"
          size="small"
          type="submit"
        >
          {{ t('components.support_bot.form.submit') }}
        </v-btn>
      </div>
    </v-form>
  </div>
</template>

<script setup>
  import { ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
 
  const { t } = useI18n()

  const props = defineProps({
    intent: {
      type: String,
      required: true,
    },
    config: {
      type: Object,
      required: true,
    },
    modelValue: {
      type: Object,
      default: () => ({}),
    },
    loading: {
      type: Boolean,
      default: false,
    },
  })

  const emit = defineEmits(['update:modelValue', 'submit', 'cancel'])

  const localFormData = ref({ ...props.modelValue })

  // Sync from prop when it changes externally
  watch(() => props.modelValue, newVal => {
    localFormData.value = { ...newVal }
  }, { deep: true })

  // Update field and emit to parent
  function updateField (key, value) {
    localFormData.value[key] = value
    emit('update:modelValue', { ...localFormData.value })
  }

  function handleSubmit () {
    emit('submit')
  }

  function getSelectItems (slotKey) {
    if (slotKey === 'fieldToUpdate') {
      return [
        { title: t('components.support_bot.form.fields.first_name'), value: 'first_name' },
        { title: t('components.support_bot.form.fields.last_name'), value: 'last_name' },
        { title: t('components.support_bot.form.fields.email'), value: 'email' },
        { title: t('components.support_bot.form.fields.phone'), value: 'phone' },
      ]
    }
    return []
  }
</script>

<style scoped>
.intent-form {
  background-color: rgb(var(--v-theme-surface-variant));
  border-radius: 12px;
  padding: 10px 14px;
  margin-left: auto;
  border-bottom-right-radius: 4px;
  display: inline-block;
  width: 85%;
  word-wrap: break-word;
}

.intent-form-header {
  margin-bottom: 8px;
  text-align: right;
}

.intent-form-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.intent-form-field {
  margin-bottom: 0;
}

.intent-form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
  padding-top: 8px;
}
</style>
