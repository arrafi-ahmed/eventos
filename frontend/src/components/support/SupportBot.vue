<template>
  <v-card class="support-bot" elevation="2" :rounded="rounded">
    <!-- Messages -->
    <v-card-text ref="messagesContainer" class="messages-container">
      <!-- Loading state while initializing -->
      <div v-if="isInitializing" class="text-center text-medium-emphasis py-8">
        <v-progress-circular indeterminate size="24" />
        <p class="mt-2">{{ t('components.support_bot.loading') }}</p>
      </div>

      <!-- Empty state -->
      <div v-else-if="messages.length === 0" class="text-center text-medium-emphasis py-8">
        <p class="mb-4">{{ t('components.support_bot.welcome') }}</p>
        <div class="intent-buttons-container">
          <div class="d-flex justify-space-between align-center mb-3">
            <span class="text-body-2 text-medium-emphasis">{{ t('components.support_bot.choose_option') }}</span>
          </div>
          <QuickIntentButtons
            @select="handleSelectIntent"
          />
        </div>
      </div>

      <!-- Messages -->
      <div v-else class="messages-list">
        <ChatMessage
          v-for="(msg, index) in messages"
          :key="index"
          :message="msg"
        />
      </div>

      <!-- Typing indicator -->
      <div v-if="isLoading && !isInitializing" class="typing-indicator">
        <div class="typing-dots">
          <span />
          <span />
          <span />
        </div>
      </div>

      <!-- Intent Form (inside messages container for natural flow) -->
      <div v-if="currentIntent && currentIntent !== 'show_buttons' && !otpData" class="form-inline" style="text-align: right;">
        <IntentForm
          v-model="formData"
          :config="currentIntentConfig"
          :intent="currentIntent"
          :loading="isLoading"
          @cancel="resetIntent"
          @submit="submitIntentForm"
        />
      </div>

      <!-- OTP Verification (inside messages container) -->
      <div v-if="otpData" class="form-inline">
        <OTPVerification
          :email="otpData.otpSentTo"
          :expires-in="otpData.expiresIn"
          :loading="isLoading"
          @cancel="resetIntent"
          @resend="resendOTP"
          @verify="verifyOTP"
        />
      </div>

      <!-- Quick Intent Buttons (only shown via "more" button when chat has started) -->
      <div v-if="showIntentButtons && messages.length > 0" class="intent-buttons-container mb-4">
        <div class="d-flex justify-space-between align-center mb-3">
          <span class="text-body-2 text-medium-emphasis">{{ t('components.support_bot.choose_option') }}</span>
          <v-btn
            :density="density"
            icon="mdi-close"
            size="small"
            variant="text"
            @click="showIntentButtons = false"
          />
        </div>
        <QuickIntentButtons @select="handleSelectIntent" />
      </div>
    </v-card-text>

    <!-- Quick Intent Buttons (shown when low confidence) -->
    <v-card-text v-if="currentIntent === 'show_buttons'">
      <div class="d-flex justify-space-between align-center mb-3">
        <span class="text-body-2 text-medium-emphasis">{{ t('components.support_bot.need_help') }}</span>
        <v-btn
          :density="density"
          icon="mdi-close"
          size="small"
          variant="text"
          @click="currentIntent = null"
        />
      </div>
      <QuickIntentButtons @select="handleSelectIntent" />
    </v-card-text>

    <!-- Input -->
    <v-card-actions v-if="!currentIntent || currentIntent === 'show_buttons'" class="input-container">
      <!-- Only show "more" button when chat has started (has messages) -->
      <v-btn
        v-if="messages.length > 0"
        class="mr-2"
        :density="density"
        icon="mdi-dots-horizontal"
        :rounded="rounded"
        :size="size"
        :variant="variant"
        @click="showIntentButtons = !showIntentButtons"
      />
      <v-text-field
        v-model="inputText"
        class="flex-grow-1"
        :density="density"
        :disabled="isLoading"
        hide-details
        :placeholder="t('components.support_bot.input_placeholder')"
        :rounded="rounded"
        :variant="variant"
        @keyup.enter="handleSend"
      >
        <template #append>
          <v-btn
            :density="density"
            :disabled="!inputText.trim() || isLoading"
            icon="mdi-send"
            :rounded="rounded"
            :size="size"
            :variant="variant"
            @click="handleSend"
          />
        </template>
      </v-text-field>
    </v-card-actions>
  </v-card>
</template>

<script setup>
  import { nextTick, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useSupportBot } from '@/composables/useSupportBot'
  import { useUiProps } from '@/composables/useUiProps'
  import ChatMessage from './ChatMessage.vue'
  import IntentForm from './IntentForm.vue'
  import OTPVerification from './OTPVerification.vue'
  import QuickIntentButtons from './QuickIntentButtons.vue'

  const { t } = useI18n()
  const { rounded, size, variant, density } = useUiProps()

  const {
    messages,
    currentIntent,
    isLoading,
    isInitializing,
    formData,
    otpData,
    currentIntentConfig,
    sendMessage,
    selectIntent,
    submitIntentForm,
    verifyOTP,
    resendOTP,
    resetIntent,
  } = useSupportBot()

  const inputText = ref('')
  const messagesContainer = ref(null)
  const showIntentButtons = ref(false)

  function handleSend () {
    if (!inputText.value.trim()) return
    sendMessage(inputText.value)
    inputText.value = ''
  // Don't hide intent buttons automatically - let user toggle with button
  }

  function handleSelectIntent (intentKey) {
    selectIntent(intentKey)
    // Hide intent buttons when an intent is selected (to show the form)
    showIntentButtons.value = false
  }

  // Auto-scroll to bottom when new message added
  watch(messages, () => {
    nextTick(() => {
      scrollToBottom()
    })
  }, { deep: true })

  // Auto-scroll when typing indicator appears
  watch(isLoading, newVal => {
    if (newVal) {
      nextTick(() => {
        scrollToBottom()
      })
    }
  })

  // Auto-scroll when initialization completes
  watch(isInitializing, newVal => {
    if (!newVal && messages.value.length > 0) {
      nextTick(() => {
        scrollToBottom()
      })
    }
  })

  function scrollToBottom () {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  }
</script>

<style scoped>
.support-bot {
  max-width: 800px;
  margin: 0 auto;
  height: 700px;
  display: flex;
  flex-direction: column;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding: 20px;
  scrollbar-width: thin;
  scrollbar-color: rgba(0, 0, 0, 0.2) transparent;
}

.messages-container::-webkit-scrollbar {
  width: 8px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background-color: rgba(0, 0, 0, 0.3);
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.intent-buttons-container {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.typing-indicator {
  display: flex;
  align-items: center;
  padding: 12px 0;
  margin-top: 8px;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-primary));
  animation: typing 1.4s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.7;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.input-container {
  padding: 16px 20px;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.form-inline {
  margin-top: 16px;
  margin-bottom: 0;
}

@media (max-width: 600px) {
  .support-bot {
    height: calc(100vh - 120px);
  }

  .messages-container {
    padding: 16px;
  }

  .input-container {
    padding: 12px 16px;
  }
}
</style>
