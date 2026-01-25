<script setup>
  import { computed, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import { isValidEmail } from '@/utils'

  definePage({
    name: 'signin',
    meta: {
      layout: 'default',
      title: 'Signin',
      requiresNoAuth: true,
    },
  })

  const { mobile } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const store = useStore()
  const router = useRouter()

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
            <h1>Login</h1>
          </v-card-title>
          <v-card-subtitle class="text-center">
            <h2 class="font-weight-regular">
              Hi, Welcome back 👋
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
                label="Email"
                required
                :rounded="rounded"
                :rules="[
                  (v) => !!v || 'Email is required!',
                  (v) => isValidEmail(v) || 'Invalid Email',
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
                label="Password"
                required
                :rounded="rounded"
                :rules="[(v) => !!v || 'Password is required!']"
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
                  Forgot Password?
                </span>
              </div>
              <v-btn
                block
                class="clickable"
                color="primary"
                :rounded="rounded"
                type="submit"
              >
                Login
              </v-btn>
              <div class="text-center mt-2 mt-md-4">
                Not registered yet?
                <span
                  class="clickable text-secondary"
                  @click="
                    router.push({
                      name: 'register',
                    })
                  "
                >
                  Create an account
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
        <h2>Forgot Password?</h2>
      </v-card-title>
      <v-card-subtitle class="text-center text-wrap">
        Please enter the email address you'd like your password reset informations sent to
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
            label="Email"
            :rounded="rounded"
            :rules="[(v) => !!v || 'Email is required!', (v) => isValidEmail(v) || 'Invalid Email']"
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
              Request reset link
            </v-btn>
          </v-card-actions>
        </v-form>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<style></style>
