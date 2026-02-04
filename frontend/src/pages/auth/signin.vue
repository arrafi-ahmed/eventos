<script setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import { isValidEmail } from '@/utils'

  const { t } = useI18n()

  definePage({
    name: 'signin',
    meta: {
      layout: 'default',
      title: 'Sign In',
      titleKey: 'auth.signin.meta_title',
      requiresNoAuth: true,
    },
  })

  const { mobile } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const store = useStore()
  const router = useRouter()

  // Computed UI Pattern
  const ui = computed(() => ({
    title: t('auth.signin.title'),
    welcome_back: t('auth.signin.welcome_back'),
    email: t('auth.labels.email'),
    password: t('auth.labels.password'),
    email_required: t('auth.rules.email_required'),
    email_invalid: t('auth.rules.email_invalid'),
    password_required: t('auth.rules.password_required'),
    forgot_password: t('auth.signin.forgot_password'),
    login_btn: t('auth.signin.title'),
    not_registered: t('auth.signin.not_registered'),
    create_account: t('auth.signin.create_account'),
    forgot_dialog: {
      title: t('auth.signin.forgot_password_dialog.title'),
      subtitle: t('auth.signin.forgot_password_dialog.subtitle'),
      request_link: t('auth.signin.forgot_password_dialog.request_link'),
    },
  }))

  const email = ref(null)
  const password = ref(null)
  const calcHome = computed(() => store.getters['auth/calcHome'])

  const visible = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)

  async function signinUser () {
    await form.value.validate()
    if (!isFormValid.value) return

    store
      .dispatch('auth/signin', {
        email: email.value,
        password: password.value,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(result => {
        router.push(calcHome.value)
      })
  }

  const dialog = ref(false)
  const resetEmail = ref(null)
  const resetForm = ref(null)
  const isResetFormValid = ref(true)
  const isRemember = ref(false)

  async function handleSubmitResetPassword () {
    await resetForm.value.validate()
    if (!isResetFormValid.value) return

    store
      .dispatch('auth/requestResetPass', { resetEmail: resetEmail.value })
      .then(res => {
        dialog.value = false
      })
      .catch(error => {})
  }
</script>

<template>
  <v-container class="fill-height">
    <v-row
      align="center"
      justify="center"
    >
      <v-col
        :cols="12"
        :lg="6"
        :md="7"
        :sm="8"
      >
        <v-card
          class="mx-auto pa-4 pa-md-8 my-2 my-md-5"
          elevation="0"
          max-width="700"
          :rounded="rounded"
        >
          <v-card-title class="text-center font-weight-bold">
            <h1>{{ ui.title }}</h1>
          </v-card-title>
          <v-card-subtitle class="text-center">
            <h2 class="font-weight-regular">
              {{ ui.welcome_back }}
            </h2>
          </v-card-subtitle>
          <v-card-text>
            <v-form
              ref="form"
              v-model="isFormValid"
              fast-fail
              @submit.prevent="signinUser"
            >
              <!-- Email Address -->
              <v-text-field
                v-model="email"
                class="mt-2 mt-md-4"
                clearable
                :density="density"
                hide-details="auto"
                :label="ui.email"
                required
                :rounded="rounded"
                :rules="[
                  (v) => !!v || ui.email_required,
                  (v) => isValidEmail(v) || ui.email_invalid,
                ]"
                :variant="variant"
              />

              <!-- Password -->
              <v-text-field
                v-model="password"
                :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'"
                class="mt-2 mt-md-4"
                clearable
                :density="density"
                hide-details="auto"
                :label="ui.password"
                required
                :rounded="rounded"
                :rules="[(v) => !!v || ui.password_required]"
                :type="visible ? 'text' : 'password'"
                :variant="variant"
                @click:append-inner="visible = !visible"
              />

              <div class="d-flex align-center justify-end my-2">
                <!--                <v-checkbox-->
                <!--                  v-model="isRemember"-->
                <!--                  center-affix-->
                <!--                  color="primary"-->
                <!--                  hide-details="auto"-->
                <!--                  label="Remember me"-->
                <!--                />-->
                <span
                  class="clickable text-secondary mt-1 mt-sm-0 text-center"
                  @click="dialog = !dialog"
                >
                  {{ ui.forgot_password }}
                </span>
              </div>
              <v-btn
                block
                class="clickable"
                color="primary"
                :rounded="rounded"
                type="submit"
              >
                {{ ui.login_btn }}
              </v-btn>
              <div class="text-center mt-2 mt-md-4">
                {{ ui.not_registered }}
                <span
                  class="clickable text-secondary"
                  @click="
                    router.push({
                      name: 'register',
                    })
                  "
                >
                  {{ ui.create_account }}
                </span>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>

  <v-dialog
    v-model="dialog"
    :rounded="rounded"
    :width="450"
  >
    <v-card class="pa-5" :rounded="rounded">
      <v-card-title class="text-center">
        <h2>{{ ui.forgot_dialog.title }}</h2>
      </v-card-title>
      <v-card-subtitle class="text-center text-wrap">
        {{ ui.forgot_dialog.subtitle }}
      </v-card-subtitle>
      <v-card-text>
        <v-form
          ref="resetForm"
          v-model="isResetFormValid"
          fast-fail
          @submit.prevent="handleSubmitResetPassword"
        >
          <v-text-field
            v-model="resetEmail"
            class="mt-2"
            clearable
            :density="density"
            hide-details="auto"
            :label="ui.email"
            :rounded="rounded"
            :rules="[(v) => !!v || ui.email_required, (v) => isValidEmail(v) || ui.email_invalid]"
            :variant="variant"
          />

          <v-card-actions>
            <v-btn
              block
              class="mx-auto mt-2 mt-md-4"
              color="primary"
              :rounded="rounded"
              :size="size"
              type="submit"
              variant="elevated"
            >
              {{ ui.forgot_dialog.request_link }}
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style></style>
