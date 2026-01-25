<template>
  <v-card :rounded="rounded" variant="outlined">
    <v-card-title class="text-h6">Verify OTP</v-card-title>
    <v-card-text>
      <p class="mb-4">Enter the 6-digit code sent to <strong>{{ email }}</strong></p>
      <div class="otp-input-container">
        <v-text-field
          v-for="i in 6"
          :key="i"
          :ref="el => { if (el) otpInputs[i - 1] = el }"
          v-model="otpDigits[i - 1]"
          class="otp-digit"
          :density="density"
          :disabled="loading"
          maxlength="1"
          :rounded="rounded"
          hide-details
          :variant="variant"
          @input="handleOtpInput(i - 1, $event)"
          @keydown.delete="handleOtpDelete(i - 1)"
          @paste="handleOtpPaste"
        />
      </div>
      <div class="mt-4 d-flex gap-2">
        <v-btn
          :density="density"
          :disabled="loading"
          :rounded="rounded"
          :size="size"
          :variant="variant"
          @click="$emit('resend')"
        >
          Resend OTP
        </v-btn>
        <v-spacer />
        <v-btn
          :density="density"
          :disabled="loading"
          :rounded="rounded"
          :size="size"
          :variant="variant"
          @click="$emit('cancel')"
        >
          Cancel
        </v-btn>
      </div>
      <v-alert
        v-if="expiresIn"
        class="mt-4"
        density="compact"
        type="info"
        variant="tonal"
      >
        Code expires in {{ Math.floor(expiresIn / 60) }} minutes
      </v-alert>
    </v-card-text>
  </v-card>
</template>

<script setup>
  import { nextTick, ref, watch } from 'vue'
  import { useUiProps } from '@/composables/useUiProps'

  const { rounded, size, variant, density } = useUiProps()

  const props = defineProps({
    email: {
      type: String,
      required: true,
    },
    expiresIn: {
      type: Number,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
  })

  const emit = defineEmits(['verify', 'resend', 'cancel'])

  const otpDigits = ref(['', '', '', '', '', ''])
  const otpInputs = ref([])

  // Watch for complete OTP
  watch(otpDigits, newVal => {
    const code = newVal.join('')
    if (code.length === 6) {
      emit('verify', code)
    }
  }, { deep: true })

  function handleOtpInput (index, event) {
    const value = event.target.value

    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      otpDigits.value[index] = ''
      return
    }

    otpDigits.value[index] = value

    // Move to next input if digit entered
    if (value && index < 5) {
      nextTick(() => {
        if (otpInputs.value[index + 1]) {
          otpInputs.value[index + 1].focus()
        }
      })
    }
  }

  function handleOtpDelete (index) {
    // Move to previous input if backspace on empty field
    if (!otpDigits.value[index] && index > 0) {
      nextTick(() => {
        if (otpInputs.value[index - 1]) {
          otpInputs.value[index - 1].focus()
        }
      })
    }
  }

  function handleOtpPaste (event) {
    event.preventDefault()
    const pastedData = event.clipboardData.getData('text').trim()

    if (/^\d{6}$/.test(pastedData)) {
      otpDigits.value = pastedData.split('')
      // Focus last input
      nextTick(() => {
        if (otpInputs.value[5]) {
          otpInputs.value[5].focus()
        }
      })
    }
  }
</script>

<style scoped>
.otp-input-container {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin: 16px 0;
}

.otp-digit {
  width: 50px;
  text-align: center;
}

.otp-digit :deep(input) {
  text-align: center;
  font-size: 1.5rem;
  font-weight: bold;
}
</style>
