<script setup>
  import { computed, onMounted, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import ProgressLoader from '@/components/ProgressLoader.vue'
  import { appInfo } from '@/utils'

  const route = useRoute()
  const store = useStore()
  const theme = useTheme()

  const snackbars = computed(() => store.state.snackbars)
  const currentTheme = computed(() => store.getters['preferences/currentTheme'])
  const appearanceSettings = computed(() => store.state.appearanceSettings?.settings || {
    defaultTheme: 'dark',
    lightColors: {},
    darkColors: {},
  })

  const THEME_COLORS = {
    light: '#F8FAFC',
    dark: '#1F1F1F',
  }

  // Handle Vuetify's update
  function setSnackbars (val) {
    store.commit('setSnackbars', val)
  }

  function applyTheme (value) {
    const normalized = value === 'light' ? 'light' : 'dark'
    theme.global.name.value = normalized
    document.documentElement.dataset.theme = normalized
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', THEME_COLORS[normalized])
    }
  }

  watch(route, to => {
    document.title = (to.meta.title && to.meta.title + ' | ' + appInfo.name) || appInfo.name
  })

  // Initialize cart from localStorage on app mount
  // Also load layout/design data (footer, banners) on first load
  onMounted(() => {
    try {
      store.dispatch('checkout/initializeFromStorage')
      
      const promises = [
        store.dispatch('layout/fetchAllLayoutData')
      ]
      
      if (store.getters['auth/signedin']) {
        promises.push(store.dispatch('auth/refreshCurrentUser'))
      }
      
      Promise.all(promises).then(([layoutData]) => {
        // Update individual store modules for backward compatibility
        if (layoutData.footer) {
          store.commit('footerSettings/setSettings', layoutData.footer)
        }
        if (layoutData.header) {
          store.commit('headerSettings/setSettings', layoutData.header)
        }
        if (layoutData.appearance) {
          store.commit('appearanceSettings/setSettings', layoutData.appearance)
        }
        if (layoutData.organizerDashboardBanner) {
          store.commit('organizerDashboardBanner/setSettings', layoutData.organizerDashboardBanner)
        }
        if (layoutData.homepageBanners) {
          store.commit('homepage/setActiveBanners', layoutData.homepageBanners)
        }
      }).catch(err => console.error('Error fetching data:', err))
    } catch (error) {
      console.error('Error initializing app:', error)
    }
  })

  // Clear checkout when changing events (using slug-based routing)
  watch(
    () => route.params.slug,
    (newSlug) => {
      const cartSlug = store.state.checkout.cartEventSlug
      // If we have items in the cart for a DIFFERENT event, clear it
      if (newSlug && cartSlug && newSlug !== cartSlug) {
        store.dispatch('checkout/clearCheckout')
      }
    },
  )

  // Watch for appearance settings changes and update theme colors and variables
  watch(
    appearanceSettings,
    settings => {
      if (settings.lightColors && Object.keys(settings.lightColors).length > 0) {
        Object.assign(theme.themes.value.light.colors, settings.lightColors)
      }
      if (settings.darkColors && Object.keys(settings.darkColors).length > 0) {
        Object.assign(theme.themes.value.dark.colors, settings.darkColors)
      }
      // Update variables
      if (settings.lightVariables && Object.keys(settings.lightVariables).length > 0) {
        if (!theme.themes.value.light.variables) {
          theme.themes.value.light.variables = {}
        }
        Object.assign(theme.themes.value.light.variables, settings.lightVariables)
      }
      if (settings.darkVariables && Object.keys(settings.darkVariables).length > 0) {
        if (!theme.themes.value.dark.variables) {
          theme.themes.value.dark.variables = {}
        }
        Object.assign(theme.themes.value.dark.variables, settings.darkVariables)
      }
    },
    { deep: true, immediate: true },
  )

  watch(
    currentTheme,
    value => {
      applyTheme(value)
    },
    { immediate: true },
  )
</script>
<template>
  <progress-loader />
  <v-snackbar-queue
    closable
    location="bottom start"
    :model-value="snackbars"
    :timeout="4000"
    timer
    @update:model-value="setSnackbars"
  />
  <router-view />
</template>
<style>
.clickable {
  cursor: pointer;
}
</style>
