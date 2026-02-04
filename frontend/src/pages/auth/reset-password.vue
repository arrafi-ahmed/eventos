<script setup>
  import { ref, computed, onMounted } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute, useRouter } from 'vue-router'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import { isValidPass } from '@/utils/common'

  const { t } = useI18n()

  definePage({
    name: 'reset-password',
    meta: {
      layout: 'default',
      title: 'Reset Password',
      titleKey: 'auth.reset_password.meta_title',
      requiresNoAuth: true,
    },
  })

  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { rounded, size, variant, density } = useUiProps()

  // Computed UI Pattern
  const ui = computed(() => ({
    title: t('auth.reset_password.title'),
    subtitle: t('auth.reset_password.subtitle'),
    new_password: t('auth.labels.new_password'),
    confirm_new_password: t('auth.labels.confirm_new_password'),
    please_confirm: t('auth.rules.please_confirm_password'),
    mismatch: t('auth.rules.passwords_mismatch'),
    reset_btn: t('auth.reset_password.title'),
    back_to_login: t('auth.reset_password.back_to_login'),
    invalid_token: t('auth.reset_password.invalid_token'),
  }))

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
      store.commit('addSnackbar', { text: ui.value.invalid_token, color: 'error' })
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
            <h1>{{ ui.title }}</h1>
          </v-card-title>
          <v-card-subtitle class="text-center text-wrap pb-6">
            {{ ui.subtitle }}
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
                :label="ui.new_password"
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
                :label="ui.confirm_new_password"
                required
                :rounded="rounded"
                :rules="[
                  v => !!v || ui.please_confirm,
                  v => v === password || ui.mismatch
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
                {{ ui.reset_btn }}
              </v-btn>

              <div class="text-center mt-6">
                <v-btn
                  variant="text"
                  color="secondary"
                  :rounded="rounded"
                  @click="router.push({ name: 'signin' })"
                >
                  {{ ui.back_to_login }}
                </v-btn>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style></style>
