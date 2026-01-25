import $axios from '@/plugins/axios'
/**
 * plugins/index.js
 *
 * Automatically included in `./src/main.js`
 */
import { handleRedirect, handleRemoveQueriesNRedirect } from '@/utils'
import router from '../router'
import store from '../store'
// Plugins
import vuetify from './vuetify'

function handleAuthRoutes (to, isSignedin, userRole) {
  // 1. Handle pages that require NO authentication (e.g., login, register)
  if (to.matched.some(record => record.meta.requiresNoAuth) && isSignedin) {
    return store.getters['auth/calcHome']
  }

  // 2. Handle pages that REQUIRE authentication
  if (to.matched.some(record => record.meta.requiresAuth)) {
    if (!isSignedin) {
      return { name: 'signin' }
    }

    // Check specific role requirements
    const isOrganizer = store.getters['auth/isOrganizer']
    const isAdmin = store.getters['auth/isAdmin']
    const isCashier = store.getters['auth/isCashier']
    const isStaff = store.getters['auth/isStaff']

    if (to.matched.some(record => record.meta.requiresOrganizer) && !isOrganizer) {
      return { name: 'signin' } // Or a "forbidden" page if implemented
    }

    if (to.matched.some(record => record.meta.requiresAdmin) && !isAdmin) {
      return { name: 'signin' }
    }

    if (to.matched.some(record => record.meta.requiresCashier) && !isCashier) {
      return { name: 'signin' }
    }

    if (to.matched.some(record => record.meta.requiresStaff) && !isStaff) {
      return { name: 'signin' }
    }
  }

  // 3. Fallback for undefined routes
  if (!to.name && isSignedin) {
    return store.getters['auth/calcHome']
  }

  return null
}

export function registerPlugins (app) {
  router.beforeEach((to, from, next) => {
    if (
      handleRedirect({
        param: 'backendRedirectUrl',
      })
    ) {
      return // Stop the execution of this guard, as a full page reload is happening
    }
    // save routeinfo to state
    store.commit('setRouteInfo', { to, from })

    const isSignedin = store.getters['auth/signedin']
    const currentUser = store.getters['auth/getCurrentUser']
    const redirectRoute = handleAuthRoutes(to, isSignedin, currentUser.role)
    if (redirectRoute) {
      next(redirectRoute)
    } else {
      if (
        handleRemoveQueriesNRedirect({
          params: ['apiQueryMsg'],
        })
      ) {
        // No need to call next() here, as window.location.replace will trigger a new navigation cycle
        return
      }
      next()
    }
  })

  app
    .use(vuetify)
    .use(router)
    .use(store)

  window.$axios = $axios

  store.dispatch('preferences/initializeTheme')

  store.watch(
    (state, getters) => getters['auth/signedin'],
    signedIn => {
      if (signedIn) {
        store.dispatch('preferences/syncThemeFromServer').catch(() => {})
      } else {
        store.dispatch('preferences/resetTheme')
      }
    },
  )
}
