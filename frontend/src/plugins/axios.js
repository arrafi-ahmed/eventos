import axios from 'axios'
import router from '@/router'
import store from '@/store'
import { HTTP_STATUS } from '@/utils'

const $axios = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

// List of public routes that don't require authentication
const publicRoutes = new Set([
  '/event/getEventBySlug',
  '/event/getEvent',
  '/event/getAllEvents',
  '/organization/getOrganization',
  '/registration/initRegistration',
  '/registration/save',
  '/registration/getRegistrationByEmail',
  '/stripe/create-payment-intent',
  '/stripe/confirm-payment',
  '/stripe/get-registration-from-payment',
  '/ticket/getTicketsByEventId',
  '/ticket/getTicketById',
  '/extras/purchaseExtras',
  '/extras/getExtrasByEventId',
  '/extras/getExtrasByIds',
  '/sponsorship-package/getPackagesByEventId',
  '/product/getEventProducts',
  '/info',
])

$axios.interceptors.request.use(config => {
  store.commit('setProgress', true)

  // Check if this is a public route
  const isPublicRoute = publicRoutes.has(config.url)

  // Only add Authorization header for non-public routes
  if (!isPublicRoute) {
    const token = store.getters['auth/getToken']
    if (token) {
      config.headers['Authorization'] = token
    }
  }

  return config
})

$axios.interceptors.response.use(
  response => {
    store.commit('setProgress', false)

    const suppressToast = response.config.suppressToast === true || response.config.headers?.['X-Suppress-Toast'] === 'true'

    if (!suppressToast && response.data?.msg) {
      const action = response.status <= 299 ? 'success' : 'error'
      store.commit('addSnackbar', {
        text: response.data.msg,
        color: action,
      })
    }
    return response
  },
  err => {
    store.commit('setProgress', false)
    const suppressToast = err.config?.suppressToast === true || err.config?.headers?.['X-Suppress-Toast'] === 'true'

    if (err.response?.status === HTTP_STATUS.TOKEN_EXPIRED) {
      // Show the error message
      if (err.response?.data?.msg && !suppressToast) {
        store.commit('addSnackbar', {
          text: err.response?.data?.msg,
          color: 'error',
        })
      }
      // Auto-logout the user and redirect
      store.dispatch('auth/signout').then(() => {
        // Redirect to signin page using Vue Router
        if (router.currentRoute.value.name !== 'signin') {
          router.push({ name: 'signin' })
        }
      })

      return Promise.resolve()
    }
    // Handle other errors normally
    if (err.response?.data?.msg && !suppressToast) {
      store.commit('addSnackbar', {
        text: err.response?.data?.msg,
        color: 'error',
      })
    }
    return Promise.reject(err)
  },
)

export default $axios
