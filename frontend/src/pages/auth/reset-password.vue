<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import { isValidPass } from '@/utils/common'

  definePage({
    name: 'reset-password',
    meta: {
      layout: 'default',
      title: 'Reset Password',
      requiresNoAuth: true,
    },
  })

  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, size, variant, density } = useUiProps()

  const token = computed(() => route.query.token)
  const password = ref('')
  const confirmPassword = ref('')
  const visible = ref(false)
  const visibleConfirm = ref(false)
  const loading = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)

  onMounted(() => {
    if (!token.value) {
      store.commit('addSnackbar', { text: 'Invalid or missing reset token', color: 'error' })
      router.push({ name: 'signin' })
    }
  })

  async function handleResetPassword () {
    const { valid } = await form.value.validate()
    if (!valid) return

    loading.value = true
    try {
      await store.dispatch('auth/resetPassword', {
        token: token.value,
        password: password.value,
      })
      router.push({ name: 'signin' })
    } catch (error) {
      console.error('Reset password failed:', error)
      // Error handled by global interceptor usually, but safe to log
    } finally {
      loading.value = false
    }
  }
</script>

<template>
  <v-container class="fill-height">
    <v-row align="center" justify="center" class="fill-height">
      <v-col :cols="12" :lg="6" :md="7" :sm="8">
        <v-card :rounded="rounded" class="mx-auto pa-4 pa-md-8 my-2 my-md-5" elevation="0" max-width="700">
          <v-card-title class="text-center font-weight-bold pb-2">
            <h1>Reset Password</h1>
          </v-card-title>
          <v-card-subtitle class="text-center text-wrap pb-6">
            Please enter your new password below
          </v-card-subtitle>

          <v-card-text>
            <v-form ref="form" v-model="isFormValid" fast-fail @submit.prevent="handleResetPassword">
              <!-- Password -->
              <v-text-field
                v-model="password"
                :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'"
                class="mb-4"
                clearable
                :density="density"
                hide-details="auto"
                label="New Password"
                required
                :rounded="rounded"
                :rules="isValidPass"
                :type="visible ? 'text' : 'password'"
                :variant="variant"
                @click:append-inner="visible = !visible"
              />

              <!-- Confirm Password -->
              <v-text-field
                v-model="confirmPassword"
                :append-inner-icon="visibleConfirm ? 'mdi-eye-off' : 'mdi-eye'"
                class="mb-6"
                clearable
                :density="density"
                hide-details="auto"
                label="Confirm New Password"
                required
                :rounded="rounded"
                :rules="[
                  v => !!v || 'Please confirm your password',
                  v => v === password || 'Passwords do not match'
                ]"
                :type="visibleConfirm ? 'text' : 'password'"
                :variant="variant"
                @click:append-inner="visibleConfirm = !visibleConfirm"
              />

              <v-btn
                block
                color="primary"
                :loading="loading"
                :rounded="rounded"
                size="large"
                type="submit"
                variant="elevated"
              >
                Reset Password
              </v-btn>

              <div class="text-center mt-6">
                <v-btn
                  variant="text"
                  color="secondary"
                  :rounded="rounded"
                  @click="router.push({ name: 'signin' })"
                >
                  Back to Login
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
