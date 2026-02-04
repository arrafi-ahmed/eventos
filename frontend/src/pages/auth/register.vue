<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import { isValidEmail, isValidPass, showApiQueryMsg } from '@/utils'

  const { t } = useI18n()

  definePage({
    name: 'register',
    meta: {
      layout: 'default',
      title: 'Register',
      titleKey: 'auth.register.meta_title',
      requiresNoAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const router = useRouter()
  const store = useStore()

  // Computed UI Pattern
  const ui = computed(() => ({
    title: t('auth.register.title'),
    name: t('auth.labels.name'),
    email_address: t('auth.labels.email_address'),
    password: t('auth.labels.password'),
    confirm_password: t('auth.labels.confirm_password'),
    name_required: t('auth.rules.name_required'),
    name_too_long: t('auth.rules.name_too_long'),
    email_required: t('auth.rules.email_required'),
    email_invalid: t('auth.rules.email_invalid'),
    confirm_password_required: t('auth.rules.confirm_password_required'),
    passwords_dont_match: t('auth.rules.passwords_dont_match'),
    register_as: t('auth.register.i_want_to_register_as'),
    register_btn: t('auth.register.title'),
    already_registered: t('auth.register.already_registered'),
    role_required: t('auth.rules.role_required'),
  }))

  const calcHome = computed(() => store.getters['auth/calcHome'])
  const userInit = {
    fullName: null,
    email: null,
    password: null,
    role: 40, // Default to attendee
  }
  const user = reactive({ ...userInit })
  const roleOptions = computed(() => [
    { title: t('auth.register.roles.attendee'), value: 40 },
    { title: t('auth.register.roles.organizer'), value: 30 },
  ])
  const confirmPassword = ref(null)
  const visible = ref(false)
  const form = ref(null)
  const isFormValid = ref(true)

  async function registerUser () {
    await form.value.validate()
    if (!isFormValid.value) return

    store
      .dispatch('auth/register', {
        ...user,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      })
      .then(result => {
        router.push(calcHome.value)
      })
  }

  onMounted(() => {
    showApiQueryMsg()
  })
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
        :md="6"
        :sm="6"
      >
        <v-card
          class="mx-auto pa-4 pa-md-8 my-2 my-md-5"
          elevation="0"
          max-width="600"
          :rounded="rounded"
        >
          <v-card-title class="text-center font-weight-bold">
            <h1>{{ ui.title }}</h1>
          </v-card-title>
          <v-card-subtitle class="text-center">
            <!--            <h2 class="font-weight-regular">Hi, Welcome back 👋</h2>-->
          </v-card-subtitle>
          <v-card-text>
            <v-form
              ref="form"
              v-model="isFormValid"
              fast-fail
              @submit.prevent="registerUser"
            >
              <!-- Full Name -->
              <v-text-field
                v-model="user.fullName"
                class="mt-2 mt-md-4"
                clearable
                :density="density"
                hide-details="auto"
                :label="ui.name"
                required
                :rounded="rounded"
                :rules="[
                  (v) => !!v || ui.name_required,
                  (v) => (v && v.length <= 50) || ui.name_too_long,
                ]"
                :variant="variant"
              />

              <!-- Email Address -->
              <v-text-field
                v-model="user.email"
                class="mt-2 mt-md-4"
                clearable
                :density="density"
                hide-details="auto"
                :label="ui.email_address"
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
                v-model="user.password"
                :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'"
                class="mt-2 mt-md-4"
                clearable
                :density="density"
                hide-details="auto"
                :label="ui.password"
                required
                :rounded="rounded"
                :rules="isValidPass"
                :type="visible ? 'text' : 'password'"
                :variant="variant"
                @click:append-inner="visible = !visible"
              />
              <v-text-field
                v-model="confirmPassword"
                :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'"
                class="mt-2 mt-md-4"
                clearable
                :density="density"
                hide-details="auto"
                :label="ui.confirm_password"
                required
                :rounded="rounded"
                :rules="[
                  (v) => !!v || ui.confirm_password_required,
                  (v) => v === user.password || ui.passwords_dont_match,
                ]"
                :type="visible ? 'text' : 'password'"
                :variant="variant"
                @click:append-inner="visible = !visible"
              />

              <!-- Role Selection -->
              <div class="mt-2 mt-md-4">
                <div class="text-body-2 text-medium-emphasis mb-2">
                  {{ ui.register_as }} <span class="text-error">*</span>
                </div>
                <v-radio-group
                  v-model="user.role"
                  class="mt-0"
                  color="primary"
                  :density="density"
                  hide-details="auto"
                  :rules="[(v) => !!v || ui.role_required]"
                >
                  <v-radio
                    :label="roleOptions[0].title"
                    :value="roleOptions[0].value"
                  />
                  <v-radio
                    :label="roleOptions[1].title"
                    :value="roleOptions[1].value"
                  />
                </v-radio-group>
              </div>

              <!-- Register Button -->
              <v-btn
                block
                class="mt-2 mt-md-4"
                color="primary"
                :rounded="rounded"
                @click="registerUser"
              >
                {{ ui.register_btn }}
              </v-btn>

              <div class="mt-2 mt-md-4 text-center">
                <span
                  class="clickable text-secondary"
                  @click="router.push({ name: 'signin' })"
                >
                  {{ ui.already_registered }}
                </span>
              </div>
            </v-form>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<style></style>
