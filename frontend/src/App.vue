<script setup>
  import { computed, onMounted, watch } from 'vue'
  import { useRoute } from 'vue-router'
  import { useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import ProgressLoader from '@/components/ProgressLoader.vue'
  import { appInfo } from '@/utils'

  const route = useRoute()
  const store = useStore()
  const theme = useTheme()

  const snackbars = computed(() => store.state.snackbars)
  const currentTheme = computed(() => store.getters['preferences/currentTheme'])
  const appearanceSettings = computed(() => store.state.systemSettings?.settings?.appearance || {
    defaultTheme: 'dark',
    lightColors: {},
    lightVariables: {},
    darkColors: {},
    darkVariables: {},
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
    if (typeof theme.change === 'function') {
      theme.change(normalized)
    } else {
      theme.global.name.value = normalized
    }
    document.documentElement.dataset.theme = normalized
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) {
      meta.setAttribute('content', THEME_COLORS[normalized])
    }
  }

  const { t, locale } = useI18n()
  
  // Watch for route or locale changes to update document title
  watch(
    [() => route.path, () => locale.value],
    () => {
      const metaTitle = route.meta.title
      // If we have a titleKey in meta, use it, otherwise fallback to title, or app name
      const titleText = route.meta.titleKey 
        ? t(route.meta.titleKey) 
        : (metaTitle ? (t(metaTitle, metaTitle)) : appInfo.name)
        
      document.title = (titleText !== appInfo.name) 
        ? `${titleText} | ${appInfo.name}` 
        : appInfo.name
    },
    { immediate: true }
  )

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
        if (layoutData) {
          store.commit('systemSettings/setSettings', layoutData)
          if (layoutData.homepageBanners) {
            store.commit('homepage/setActiveBanners', layoutData.homepageBanners)
          }
        }
      }).catch(err => console.error('Error fetching data:', err))
    } catch (error) {
      console.error('Error initializing app:', error)
    }
  })


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
