<script setup>
  import { computed, onMounted, reactive, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useUiProps } from '@/composables/useUiProps'
  import { isValidEmail, isValidPass, showApiQueryMsg } from '@/utils'

  definePage({
    name: 'register',
    meta: {
      layout: 'default',
      title: 'Register',
      requiresNoAuth: true,
    },
  })

  const { xs } = useDisplay()
  const { rounded, size, variant, density } = useUiProps()
  const router = useRouter()
  const store = useStore()
  const calcHome = computed(() => store.getters['auth/calcHome'])
  const userInit = {
    fullName: null,
    email: null,
    password: null,
    role: 40, // Default to attendee
  }
  const user = reactive({ ...userInit })
  const roleOptions = [
    { title: 'Attendee', value: 40 },
    { title: 'Organizer', value: 30 },
  ]
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
            <h1>Register</h1>
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
                label="Name"
                required
                :rounded="rounded"
                :rules="[
                  (v) => !!v || 'Name is required!',
                  (v) => (v && v.length <= 50) || 'Must not exceed 50 characters',
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
                label="Email Address"
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
                v-model="user.password"
                :append-inner-icon="visible ? 'mdi-eye-off' : 'mdi-eye'"
                class="mt-2 mt-md-4"
                clearable
                :density="density"
                hide-details="auto"
                label="Password"
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
                label="Confirm Password"
                required
                :rounded="rounded"
                :rules="[
                  (v) => !!v || 'Confirm Password is required!',
                  (v) => v === user.password || 'Confirm password didn\'t match!',
                ]"
                :type="visible ? 'text' : 'password'"
                :variant="variant"
                @click:append-inner="visible = !visible"
              />

              <!-- Role Selection -->
              <div class="mt-2 mt-md-4">
                <div class="text-body-2 text-medium-emphasis mb-2">
                  I want to register as <span class="text-error">*</span>
                </div>
                <v-radio-group
                  v-model="user.role"
                  class="mt-0"
                  color="primary"
                  :density="density"
                  hide-details="auto"
                  :rules="[(v) => !!v || 'Role is required!']"
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
                Register
              </v-btn>

              <div class="mt-2 mt-md-4 text-center">
                <span
                  class="clickable text-secondary"
                  @click="router.push({ name: 'signin' })"
                >
                  Already registered?
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
