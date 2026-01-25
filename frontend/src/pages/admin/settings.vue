<script setup>
  import { onMounted, ref } from 'vue'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import ColorPicker from '@/components/ColorPicker.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatDateTime, getApiPublicImageUrl, getClientPublicImageUrl } from '@/utils'

  definePage({
    name: 'settings-admin',
    meta: {
      layout: 'default',
      title: 'Settings',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const store = useStore()
  const { rounded, variant, density, size } = useUiProps()

  const banners = ref([])
  const loading = ref(false)
  const dialog = ref(false)
  const editMode = ref(false)
  const selectedBanner = ref(null)
  const bannerToDelete = ref(null)
  const formData = ref({
    image: null,
    link: '',
    dateRange: [],
    displayOrder: 0,
    isActive: true,
  })
  const imagePreview = ref(null)

  // Footer settings
  const footerLoading = ref(false)
  const footerSettings = ref({
    style: 'expanded',
    companyName: '',
    companyAddress: '',
    companyEmail: '',
    companyPhone: '',
    quickLinks: [],
    socialLinks: {
      facebook: '',
      instagram: '',
      tiktok: '',
    },
    copyrightText: '',
  })
  const newQuickLink = ref({ title: '', routeName: '' })

  // Header settings
  const headerLoading = ref(false)
  const headerSettings = ref({
    logoImage: null,
    logoImageDark: null,
    logoPosition: 'left',
    menuPosition: 'right',
    logoWidthLeft: 300,
    logoWidthMobile: 120,
  })
  const logoWidthView = ref('desktop') // 'desktop' or 'mobile'
  const logoFile = ref(null)
  const logoPreview = ref(null)
  const logoFileDark = ref(null)
  const logoPreviewDark = ref(null)

  // Appearance settings
  const appearanceLoading = ref(false)
  const appearanceSettings = ref({
    defaultTheme: 'dark',
    lightColors: {},
    lightVariables: {},
    darkColors: {},
    darkVariables: {},
  })
  const selectedThemeTab = ref('light') // For switching between light/dark color editing
  const selectedModeTab = ref('colors') // For switching between colors/advanced
  const advancedJson = ref({
    light: '',
    dark: '',
  })
  const jsonError = ref({
    light: null,
    dark: null,
  })

  // Organizer dashboard banner settings
  const organizerBannerLoading = ref(false)
  const organizerBannerSettings = ref({
    isEnabled: false,
    icon: null,
    title: null,
    description: null,
    ctaButtonText: null,
    ctaButtonUrl: null,
  })

  const expandedPanels = ref([0]) // First panel opened by default

  // Fetch banners
  async function fetchBanners () {
    try {
      loading.value = true
      await store.dispatch('homepage/fetchBanners')
      banners.value = store.state.homepage?.banners || []
    } catch (error) {
      console.error('Error fetching banners:', error)
    } finally {
      loading.value = false
    }
  }

  // Open create dialog
  function openCreateDialog () {
    editMode.value = false
    selectedBanner.value = null
    formData.value = {
      image: null,
      link: '',
      dateRange: [],
      displayOrder: banners.value.length,
      isActive: true,
    }
    imagePreview.value = null
    dialog.value = true
  }

  // Open edit dialog
  function openEditDialog (banner) {
    editMode.value = true
    selectedBanner.value = banner
    const dateRange = []
    if (banner.startDate) {
      // Parse date string as local date (YYYY-MM-DD format)
      const [year, month, day] = banner.startDate.split('-').map(Number)
      const start = new Date(year, month - 1, day)
      dateRange.push(start)
    }
    if (banner.endDate) {
      // Parse date string as local date (YYYY-MM-DD format)
      const [year, month, day] = banner.endDate.split('-').map(Number)
      const end = new Date(year, month - 1, day)
      dateRange.push(end)
    }
    formData.value = {
      image: null,
      link: banner.link || '',
      dateRange: dateRange,
      displayOrder: banner.displayOrder || 0,
      isActive: banner.isActive !== false,
    }
    imagePreview.value = banner.imageUrl ? getApiPublicImageUrl(banner.imageUrl, 'homepage-banner') : null
    dialog.value = true
  }

  // Handle image selection
  function handleImageSelect (files) {
    const file = Array.isArray(files) ? files[0] : files
    if (file) {
      formData.value.image = file
      const reader = new FileReader()
      reader.addEventListener('load', e => {
        imagePreview.value = e.target.result
      })
      reader.readAsDataURL(file)
    } else {
      formData.value.image = null
      if (!editMode.value) {
        imagePreview.value = null
      }
    }
  }

  // Save banner
  async function saveBanner () {
    if (!formData.value.dateRange || !Array.isArray(formData.value.dateRange) || formData.value.dateRange.length < 2) {
      return
    }

    // Get first and last date from the array (in case v-date-input selects all dates in range)
    const sortedDates = [...formData.value.dateRange].sort((a, b) => {
      const dateA = new Date(a)
      const dateB = new Date(b)
      return dateA - dateB
    })
    const startDate = sortedDates[0]
    const endDate = sortedDates.at(-1)

    if (new Date(startDate) >= new Date(endDate)) {
      return
    }

    if (!editMode.value && !formData.value.image) {
      return
    }

    try {
      loading.value = true
      const data = new FormData()
      if (formData.value.image) {
        data.append('files', formData.value.image)
      }
      data.append('link', formData.value.link || '')
      // Format dates as YYYY-MM-DD in local timezone (avoid timezone shift)
      const startDateStr = formatDateLocal(startDate)
      const endDateStr = formatDateLocal(endDate)
      data.append('startDate', startDateStr)
      data.append('endDate', endDateStr)
      data.append('displayOrder', formData.value.displayOrder)
      data.append('isActive', formData.value.isActive ? 'true' : 'false')

      await (editMode.value
        ? store.dispatch('homepage/updateBanner', {
          id: selectedBanner.value.id,
          formData: data,
        })
        : store.dispatch('homepage/createBanner', data))

      dialog.value = false
      await fetchBanners()
      // Refresh unified layout cache
      await store.dispatch('layout/fetchAllLayoutData')
    } catch (error) {
      console.error('Error saving banner:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // Delete banner
  function confirmDelete (banner) {
    bannerToDelete.value = banner
  }

  async function deleteBanner () {
    if (!bannerToDelete.value) return

    try {
      loading.value = true
      await store.dispatch('homepage/deleteBanner', bannerToDelete.value.id)
      await fetchBanners()
      // Refresh unified layout cache
      await store.dispatch('layout/fetchAllLayoutData')
    } catch (error) {
      console.error('Error deleting banner:', error)
    } finally {
      loading.value = false
      bannerToDelete.value = null
    }
  }

  // Toggle active status
  async function toggleActive (banner) {
    try {
      const data = new FormData()
      data.append('isActive', (!banner.isActive).toString())
      await store.dispatch('homepage/updateBanner', {
        id: banner.id,
        formData: data,
      })
      await fetchBanners()
      // Refresh unified layout cache
      await store.dispatch('layout/fetchAllLayoutData')
    } catch (error) {
      console.error('Error updating banner:', error)
      throw error
    }
  }

  // Format date to YYYY-MM-DD in local timezone (avoid timezone shift)
  function formatDateLocal (date) {
    if (!date) return null
    const d = date instanceof Date ? date : new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Get image URL
  function getBannerImageUrl (imageUrl) {
    return getApiPublicImageUrl(imageUrl, 'homepage-banner')
  }

  // Check if banner is currently active (based on switch only)
  function isBannerActive (banner) {
    return banner.isActive === true || banner.isActive === 'true'
  }

  function formatDate (date) {
    return formatDateTime({ input: date })
  }

  // Footer settings functions
  async function fetchFooterSettings () {
    try {
      footerLoading.value = true
      await store.dispatch('footerSettings/fetchSettings')
      const settings = store.state.footerSettings.settings
      footerSettings.value = {
        style: settings.style || 'expanded',
        companyName: settings.companyName || '',
        companyAddress: settings.companyAddress || '',
        companyEmail: settings.companyEmail || '',
        companyPhone: settings.companyPhone || '',
        quickLinks: Array.isArray(settings.quickLinks) ? [...settings.quickLinks] : [],
        socialLinks: {
          facebook: settings.socialLinks?.facebook || '',
          instagram: settings.socialLinks?.instagram || '',
          tiktok: settings.socialLinks?.tiktok || '',
        },
        copyrightText: settings.copyrightText || '',
      }
    } catch (error) {
      console.error('Error fetching footer settings:', error)
    } finally {
      footerLoading.value = false
    }
  }

  async function saveFooterSettings () {
    try {
      footerLoading.value = true
      // Always send all fields, even if empty (convert empty strings to null)
      const payload = {
        style: footerSettings.value.style,
        companyName: footerSettings.value.companyName?.trim() || null,
        companyAddress: footerSettings.value.companyAddress?.trim() || null,
        companyEmail: footerSettings.value.companyEmail?.trim() || null,
        companyPhone: footerSettings.value.companyPhone?.trim() || null,
        quickLinks: footerSettings.value.quickLinks.filter(link => link.title && link.routeName),
        socialLinks: {
          facebook: footerSettings.value.socialLinks.facebook?.trim() || null,
          instagram: footerSettings.value.socialLinks.instagram?.trim() || null,
          tiktok: footerSettings.value.socialLinks.tiktok?.trim() || null,
        },
        copyrightText: footerSettings.value.copyrightText?.trim() || null,
      }
      await store.dispatch('footerSettings/updateSettings', payload)
      // Refresh unified layout cache
      await store.dispatch('layout/fetchAllLayoutData')
    } catch (error) {
      console.error('Error saving footer settings:', error)
      throw error
    } finally {
      footerLoading.value = false
    }
  }

  function addQuickLink () {
    if (newQuickLink.value.title && newQuickLink.value.routeName) {
      footerSettings.value.quickLinks.push({
        title: newQuickLink.value.title,
        routeName: newQuickLink.value.routeName,
      })
      newQuickLink.value = { title: '', routeName: '' }
    }
  }

  function removeQuickLink (index) {
    footerSettings.value.quickLinks.splice(index, 1)
  }

  // Header settings functions
  async function fetchHeaderSettings () {
    try {
      headerLoading.value = true
      await store.dispatch('headerSettings/fetchSettings')
      const settings = store.state.headerSettings.settings
      headerSettings.value = {
        logoImage: settings.logoImage || null,
        logoImageDark: settings.logoImageDark || null,
        logoPosition: settings.logoPosition || 'left',
        menuPosition: settings.menuPosition || 'right',
        logoWidthLeft: settings.logoWidthLeft || 300,
        logoWidthMobile: settings.logoWidthMobile || 120,
      }
      // Set logo previews if logos exist
      logoPreview.value = settings.logoImage ? getApiPublicImageUrl(settings.logoImage, 'header-logo') : null
      logoPreviewDark.value = settings.logoImageDark ? getApiPublicImageUrl(settings.logoImageDark, 'header-logo') : null
      // Clear file inputs
      logoFile.value = null
      logoFileDark.value = null
    } catch (error) {
      console.error('Error fetching header settings:', error)
    } finally {
      headerLoading.value = false
    }
  }

  async function saveHeaderSettings () {
    try {
      headerLoading.value = true
      const data = new FormData()
      if (logoFile.value && logoFile.value instanceof File) {
        data.append('logoImage', logoFile.value)
      }
      if (logoFileDark.value && logoFileDark.value instanceof File) {
        data.append('logoImageDark', logoFileDark.value)
      }
      data.append('logoPosition', headerSettings.value.logoPosition)
      data.append('menuPosition', headerSettings.value.menuPosition)
      data.append('logoWidthLeft', headerSettings.value.logoWidthLeft)
      data.append('logoWidthMobile', headerSettings.value.logoWidthMobile)

      await store.dispatch('headerSettings/updateSettings', data)
      await fetchHeaderSettings()
      // Refresh unified layout cache
      await store.dispatch('layout/fetchAllLayoutData')
    } catch (error) {
      console.error('Error saving header settings:', error)
    } finally {
      headerLoading.value = false
    }
  }

  function handleLogoSelect (files) {
    const file = Array.isArray(files) ? files[0] : files
    if (file && file instanceof File) {
      logoFile.value = file
      const reader = new FileReader()
      reader.addEventListener('load', e => {
        logoPreview.value = e.target.result
      })
      reader.readAsDataURL(file)
    } else {
      logoFile.value = null
      if (!headerSettings.value.logoImage) {
        logoPreview.value = null
      }
    }
  }

  function handleLogoDarkSelect (files) {
    const file = Array.isArray(files) ? files[0] : files
    if (file && file instanceof File) {
      logoFileDark.value = file
      const reader = new FileReader()
      reader.addEventListener('load', e => {
        logoPreviewDark.value = e.target.result
      })
      reader.readAsDataURL(file)
    } else {
      logoFileDark.value = null
      if (!headerSettings.value.logoImageDark) {
        logoPreviewDark.value = null
      }
    }
  }

  // Appearance settings functions
  async function fetchAppearanceSettings () {
    try {
      appearanceLoading.value = true
      await store.dispatch('appearanceSettings/fetchSettings')
      const settings = store.state.appearanceSettings.settings
      appearanceSettings.value = {
        defaultTheme: settings.defaultTheme || 'dark',
        lightColors: settings.lightColors || {},
        lightVariables: settings.lightVariables || {},
        darkColors: settings.darkColors || {},
        darkVariables: settings.darkVariables || {},
      }
      // Initialize advanced JSON
      advancedJson.value = {
        light: JSON.stringify({
          colors: appearanceSettings.value.lightColors,
          variables: appearanceSettings.value.lightVariables,
        }, null, 2),
        dark: JSON.stringify({
          colors: appearanceSettings.value.darkColors,
          variables: appearanceSettings.value.darkVariables,
        }, null, 2),
      }
    } catch (error) {
      console.error('Error fetching appearance settings:', error)
    } finally {
      appearanceLoading.value = false
    }
  }

  async function saveAppearanceSettings () {
    try {
      appearanceLoading.value = true
      await store.dispatch('appearanceSettings/updateSettings', {
        defaultTheme: appearanceSettings.value.defaultTheme,
        lightColors: appearanceSettings.value.lightColors,
        lightVariables: appearanceSettings.value.lightVariables,
        darkColors: appearanceSettings.value.darkColors,
        darkVariables: appearanceSettings.value.darkVariables,
      })
      await fetchAppearanceSettings()
      // Reload page to apply theme changes
      window.location.reload()
    } catch (error) {
      console.error('Error saving appearance settings:', error)
    } finally {
      appearanceLoading.value = false
    }
  }

  // Parse JSON from advanced tab and merge with settings
  // Allows both JSON and JavaScript object literal syntax (unquoted keys)
  function parseAdvancedJson (theme) {
    const jsonText = advancedJson.value[theme]
    if (!jsonText || !jsonText.trim()) {
      jsonError.value[theme] = null
      return
    }

    try {
      let parsed
      // Try JSON.parse first
      try {
        parsed = JSON.parse(jsonText)
      } catch {
        // If JSON.parse fails, try to parse as JavaScript object literal
        // This allows unquoted keys like { colors: {...}, variables: {...} }
        try {
          // Wrap in parentheses to make it a valid expression
          parsed = new Function('return (' + jsonText + ')')()
        } catch {
          throw new Error('Invalid JSON or JavaScript object syntax')
        }
      }

      if (typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new TypeError('Input must be an object')
      }

      // Merge colors and variables
      if (parsed.colors && typeof parsed.colors === 'object' && !Array.isArray(parsed.colors)) {
        if (theme === 'light') {
          appearanceSettings.value.lightColors = { ...appearanceSettings.value.lightColors, ...parsed.colors }
        } else {
          appearanceSettings.value.darkColors = { ...appearanceSettings.value.darkColors, ...parsed.colors }
        }
      }

      if (parsed.variables && typeof parsed.variables === 'object' && !Array.isArray(parsed.variables)) {
        if (theme === 'light') {
          appearanceSettings.value.lightVariables = { ...appearanceSettings.value.lightVariables, ...parsed.variables }
        } else {
          appearanceSettings.value.darkVariables = { ...appearanceSettings.value.darkVariables, ...parsed.variables }
        }
      }

      // Preserve original JSON structure and key order
      // Update the parsed object with merged values while preserving key order
      if (parsed.colors) {
        parsed.colors = theme === 'light' ? appearanceSettings.value.lightColors : appearanceSettings.value.darkColors
      }
      if (parsed.variables) {
        parsed.variables = theme === 'light' ? appearanceSettings.value.lightVariables : appearanceSettings.value.darkVariables
      }

      // Stringify with preserved structure and key order
      // JavaScript preserves insertion order, so the original order is maintained
      if (theme === 'light') {
        advancedJson.value.light = JSON.stringify(parsed, null, 2)
      } else {
        advancedJson.value.dark = JSON.stringify(parsed, null, 2)
      }

      jsonError.value[theme] = null
    } catch (error) {
      jsonError.value[theme] = error.message || 'Invalid JSON'
    }
  }

  // Color keys for both themes (sorted by usage importance)
  // Text Colors: Colors starting with "on-" control text color on their corresponding backgrounds
  // Most Important: on-surface (default text), on-background (text on background), on-primary (text on buttons)
  const colorKeys = [
    // Primary brand colors (most frequently used)
    'primary',
    'on-primary', // Text color on primary buttons/backgrounds
    'secondary',
    'on-secondary', // Text color on secondary buttons/backgrounds
    'accent',
    'on-accent', // Text color on accent elements
    'tertiary',
    'on-tertiary', // Text color on tertiary elements

    // Status colors (for alerts, badges, etc.)
    'success',
    'on-success', // Text color on success messages/badges
    'error',
    'on-error', // Text color on error messages/badges
    'warning',
    'on-warning', // Text color on warning messages/badges
    'info',
    'on-info', // Text color on info messages/badges

    // Background and surface colors
    'background',
    'on-background', // Text color on background (important for general text)
    'surface',
    'on-surface', // Default text color on surfaces (MOST IMPORTANT for general text)
    'surface-variant',
    'on-surface-variant', // Text color on variant surfaces
    'surface-bright',

    // Border/outline colors
    'outline',
    'outline-variant',

    // Special gradient text colors
    'on-gradient-light', // Text color on gradient backgrounds for light theme
    'on-gradient-dark', // Text color on gradient backgrounds for dark theme
  ]

  // Organizer dashboard banner functions
  async function fetchOrganizerBannerSettings () {
    try {
      organizerBannerLoading.value = true
      await store.dispatch('organizerDashboardBanner/fetchSettings')
      const settings = store.state.organizerDashboardBanner.settings
      organizerBannerSettings.value = {
        isEnabled: settings.isEnabled !== false,
        icon: settings.icon,
        title: settings.title,
        description: settings.description,
        ctaButtonText: settings.ctaButtonText,
        ctaButtonUrl: settings.ctaButtonUrl,
      }
    } catch (error) {
      console.error('Error fetching organizer dashboard banner settings:', error)
    } finally {
      organizerBannerLoading.value = false
    }
  }

  async function saveOrganizerBannerSettings () {
    try {
      organizerBannerLoading.value = true

      // If disabled, only update isEnabled flag
      if (!organizerBannerSettings.value.isEnabled) {
        await store.dispatch('organizerDashboardBanner/updateSettings', {
          isEnabled: false,
        })
        // Refresh unified layout cache
        await store.dispatch('layout/fetchAllLayoutData')
        return
      }

      // If enabled, validate required fields and save all
      const icon = organizerBannerSettings.value.icon?.trim()
      const title = organizerBannerSettings.value.title?.trim()
      const ctaButtonText = organizerBannerSettings.value.ctaButtonText?.trim()
      const ctaButtonUrl = organizerBannerSettings.value.ctaButtonUrl?.trim()

      if (!icon || !title || !ctaButtonText || !ctaButtonUrl) {
        throw new Error('All fields are required when banner is enabled')
      }

      await store.dispatch('organizerDashboardBanner/updateSettings', {
        isEnabled: true,
        icon,
        title,
        description: organizerBannerSettings.value.description?.trim() || null,
        ctaButtonText,
        ctaButtonUrl,
      })
      // Refresh unified layout cache
      await store.dispatch('layout/fetchAllLayoutData')
    } catch (error) {
      console.error('Error saving organizer dashboard banner settings:', error)
      throw error
    } finally {
      organizerBannerLoading.value = false
    }
  }

  onMounted(() => {
    fetchBanners()
    fetchFooterSettings()
    fetchHeaderSettings()
    fetchAppearanceSettings()
    fetchOrganizerBannerSettings()
  })
</script>

<template>
  <v-container class="settings-container">
    <PageTitle
      :show-back-button="true"
      subtitle="Manage system settings and configurations"
      title="Settings"
    />

    <v-row>
      <v-col
        cols="12"
        lg="10"
        xl="8"
      >
        <v-expansion-panels
          v-model="expandedPanels"
          class="settings-panels rounded-xl"
          :rounded="rounded"
          variant="popout"
        >
          <!-- Customize Homepage Section -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-home</v-icon>
              <span class="text-h6">Customize Homepage</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                Manage rotating banners displayed on the homepage
              </div>

              <!-- Banners List -->
              <div v-if="loading && banners.length === 0" class="text-center pa-8">
                <v-progress-circular
                  color="primary"
                  indeterminate
                />
              </div>

              <div v-else-if="banners.length === 0" class="text-center pa-8">
                <v-icon
                  class="mb-4"
                  color="grey-lighten-1"
                  size="64"
                >
                  mdi-image-off
                </v-icon>
                <p class="text-h6 text-grey mb-2">No banners yet</p>
                <p class="text-body-2 text-grey mb-4">Create your first homepage banner</p>
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  :rounded="rounded"
                  :size="size"
                  @click="openCreateDialog"
                >
                  Add Banner
                </v-btn>
              </div>

              <div v-else>
                <div class="d-flex align-center justify-space-between mb-4">
                  <div class="text-body-1 font-weight-medium">
                    Banners ({{ banners.length }})
                  </div>
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-plus"
                    :rounded="rounded"
                    :size="size"
                    @click="openCreateDialog"
                  >
                    Add Banner
                  </v-btn>
                </div>

                <v-row>
                  <v-col
                    v-for="(banner, index) in banners"
                    :key="banner.id"
                    cols="12"
                    lg="4"
                    md="6"
                  >
                    <v-card
                      class="banner-card rounded-xl"
                      elevation="2"
                      :rounded="rounded"
                    >
                      <v-img
                        cover
                        height="200"
                        :src="getBannerImageUrl(banner.imageUrl)"
                      >
                        <div class="banner-overlay">
                          <v-chip
                            :color="isBannerActive(banner) ? 'success' : 'grey'"
                            size="small"
                            variant="flat"
                          >
                            {{ isBannerActive(banner) ? 'Active' : 'Inactive' }}
                          </v-chip>
                        </div>
                      </v-img>

                      <v-card-text class="pa-4">
                        <div class="d-flex align-center justify-space-between">
                          <div class="text-h6">
                            Banner #{{ index + 1 }}
                          </div>
                          <v-switch
                            color="success"
                            :density="density"
                            hide-details
                            :model-value="banner.isActive"
                            @update:model-value="toggleActive(banner)"
                          />
                        </div>
                      </v-card-text>

                      <v-card-actions class="px-4 pb-4">
                        <v-btn
                          color="primary"
                          :density="density"
                          prepend-icon="mdi-pencil"
                          :rounded="rounded"
                          :size="size"
                          variant="text"
                          @click="openEditDialog(banner)"
                        >
                          Edit
                        </v-btn>
                        <v-spacer />
                        <confirmation-dialog
                          :popup-content="`Are you sure you want to delete Banner #${index + 1}? This action cannot be undone.`"
                          popup-title="Delete Banner"
                          @confirm="deleteBanner"
                        >
                          <template #activator="{ onClick }">
                            <v-btn
                              color="error"
                              :density="density"
                              prepend-icon="mdi-delete"
                              :rounded="rounded"
                              :size="size"
                              variant="text"
                              @click="confirmDelete(banner); onClick()"
                            >
                              Delete
                            </v-btn>
                          </template>
                        </confirmation-dialog>
                      </v-card-actions>
                    </v-card>
                  </v-col>
                </v-row>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Customize Header Section -->
          <!-- Customize Header Hidden -->
          <v-expansion-panel v-if="false">
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-view-dashboard-variant</v-icon>
              <span class="text-h6">Customize Header</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                Configure header logo, alignment, and menu position
              </div>

              <v-form>
                <!-- Logo Upload -->
                <v-card
                  class="mb-4"
                  :rounded="rounded"
                  variant="outlined"
                >
                  <v-card-title class="text-subtitle-1">
                    Logos
                  </v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols="12" md="6">
                        <div class="text-caption mb-1">Light Theme Logo</div>
                        <v-file-upload
                          v-model="logoFile"
                          accept="image/*"
                          clearable
                          density="compact"
                          hide-details="auto"
                          :rounded="rounded"
                          show-size
                          title="Upload Light Logo"
                          :variant="variant"
                          @update:model-value="handleLogoSelect"
                        />
                        <!-- Light Logo Preview -->
                        <div class="mt-4">
                          <v-img
                            v-if="logoPreview"
                            class="mt-2 mx-auto"
                            contain
                            :src="logoPreview"
                            style="border: 1px solid rgba(0,0,0,0.12); border-radius: 4px; background-color: #f8fafc;"
                            :width="logoWidthView === 'desktop' ? headerSettings.logoWidthLeft : headerSettings.logoWidthMobile"
                          />
                        </div>
                      </v-col>
                      <v-col cols="12" md="6">
                        <div class="text-caption mb-1">Dark Theme Logo</div>
                        <v-file-upload
                          v-model="logoFileDark"
                          accept="image/*"
                          clearable
                          density="compact"
                          hide-details="auto"
                          :rounded="rounded"
                          show-size
                          title="Upload Dark Logo"
                          :variant="variant"
                          @update:model-value="handleLogoDarkSelect"
                        />
                        <!-- Dark Logo Preview -->
                        <div class="mt-4">
                          <v-img
                            v-if="logoPreviewDark"
                            class="mt-2 mx-auto"
                            contain
                            :src="logoPreviewDark"
                            style="border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; background-color: #0f172a;"
                            :width="logoWidthView === 'desktop' ? headerSettings.logoWidthLeft : headerSettings.logoWidthMobile"
                          />
                        </div>
                      </v-col>
                    </v-row>

                    <!-- Logo Width Controls -->
                    <div class="mt-4">
                      <!-- View Selector -->
                      <v-select
                        v-model="logoWidthView"
                        class="mb-3"
                        :density="density"
                        hide-details="auto"
                        :items="[
                          { title: 'Desktop', value: 'desktop' },
                          { title: 'Mobile', value: 'mobile' }
                        ]"
                        label="View"
                        max-width="100"
                        :rounded="rounded"
                        variant="plain"
                      />

                      <!-- Desktop Width Slider -->
                      <div v-if="logoWidthView === 'desktop'">
                        <div class="d-flex justify-space-between align-center mb-2">
                          <span class="text-body-2 font-weight-medium">Desktop Width</span>
                          <span class="text-body-2 text-medium-emphasis">{{ headerSettings.logoWidthLeft }}px</span>
                        </div>
                        <v-slider
                          v-model="headerSettings.logoWidthLeft"
                          color="primary"
                          hide-details="auto"
                          :max="500"
                          :min="50"
                          :step="10"
                          thumb-label
                        />
                      </div>

                      <!-- Mobile Width Slider -->
                      <div v-else>
                        <div class="d-flex justify-space-between align-center mb-2">
                          <span class="text-body-2 font-weight-medium">Mobile Width</span>
                          <span class="text-body-2 text-medium-emphasis">{{ headerSettings.logoWidthMobile }}px</span>
                        </div>
                        <v-slider
                          v-model="headerSettings.logoWidthMobile"
                          color="primary"
                          hide-details="auto"
                          :max="300"
                          :min="50"
                          :step="10"
                          thumb-label
                        />
                      </div>
                    </div>

                    <div v-if="!logoPreview && !logoPreviewDark && !logoFile && !logoFileDark" class="mt-2 text-center pa-4 bg-grey-lighten-4 rounded">
                        <v-icon
                          class="mb-2"
                          color="grey"
                          size="48"
                        >
                          mdi-text
                        </v-icon>
                        <p class="text-body-2 text-grey">
                          No logos uploaded. App name will be displayed as text.
                        </p>
                    </div>
                  </v-card-text>
                </v-card>

                <!-- Logo Position -->
                <v-select
                  v-model="headerSettings.logoPosition"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :items="[
                    { title: 'Left', value: 'left' },
                    { title: 'Center', value: 'center' },
                    { title: 'Right', value: 'right' }
                  ]"
                  label="Logo Position"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Menu Position -->
                <v-select
                  v-model="headerSettings.menuPosition"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :items="[
                    { title: 'Left', value: 'left' },
                    { title: 'Center', value: 'center' },
                    { title: 'Right', value: 'right' }
                  ]"
                  label="Menu Position"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Save Button -->
                <v-btn
                  color="primary"
                  :loading="headerLoading"
                  prepend-icon="mdi-content-save"
                  :rounded="rounded"
                  :size="size"
                  @click="saveHeaderSettings"
                >
                  Save Header Settings
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Customize Footer Section -->
          <!-- Customize Footer Hidden -->
          <v-expansion-panel v-if="false">
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-format-page-break</v-icon>
              <span class="text-h6">Customize Footer</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                Configure footer style and content
              </div>

              <v-form>
                <!-- Footer Style -->
                <v-select
                  v-model="footerSettings.style"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :items="[
                    { title: 'One Line (Simple)', value: 'oneline' },
                    { title: 'Expanded (Full Sections)', value: 'expanded' }
                  ]"
                  label="Footer Style"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Copyright Text (available for both styles) -->
                <v-text-field
                  v-model="footerSettings.copyrightText"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  label="Copyright Text (Optional)"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Expanded Footer Options (only show if style is expanded) -->
                <template v-if="footerSettings.style === 'expanded'">
                  <!-- Company Information -->
                  <v-card
                    class="mb-4"
                    :rounded="rounded"
                    variant="outlined"
                  >
                    <v-card-title class="text-subtitle-1">
                      Company Information
                    </v-card-title>
                    <v-card-text>
                      <v-text-field
                        v-model="footerSettings.companyName"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        label="Company Name"
                        :rounded="rounded"
                        :variant="variant"
                      />
                      <v-textarea
                        v-model="footerSettings.companyAddress"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        label="Address"
                        :rounded="rounded"
                        rows="2"
                        :variant="variant"
                      />
                      <v-text-field
                        v-model="footerSettings.companyEmail"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        label="Email"
                        :rounded="rounded"
                        type="email"
                        :variant="variant"
                      />
                      <v-text-field
                        v-model="footerSettings.companyPhone"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        label="Phone"
                        :rounded="rounded"
                        :variant="variant"
                      />
                    </v-card-text>
                  </v-card>

                  <!-- Quick Links -->
                  <v-card
                    class="mb-4"
                    :rounded="rounded"
                    variant="outlined"
                  >
                    <v-card-title class="text-subtitle-1">
                      Quick Links
                    </v-card-title>
                    <v-card-text>
                      <div
                        v-for="(link, index) in footerSettings.quickLinks"
                        :key="index"
                        class="d-flex align-center mb-2"
                      >
                        <v-text-field
                          class="me-2"
                          :density="density"
                          hide-details
                          label="Title"
                          :model-value="link.title"
                          :rounded="rounded"
                          :variant="variant"
                          @update:model-value="link.title = $event"
                        />
                        <v-text-field
                          class="me-2"
                          :density="density"
                          hide-details
                          label="Route Name"
                          :model-value="link.routeName"
                          :rounded="rounded"
                          :variant="variant"
                          @update:model-value="link.routeName = $event"
                        />
                        <v-btn
                          color="error"
                          icon="mdi-delete"
                          :size="size"
                          variant="text"
                          @click="removeQuickLink(index)"
                        />
                      </div>
                      <div class="d-flex align-center mb-2">
                        <v-text-field
                          v-model="newQuickLink.title"
                          class="me-2"
                          :density="density"
                          hide-details
                          label="Title"
                          :rounded="rounded"
                          :variant="variant"
                        />
                        <v-text-field
                          v-model="newQuickLink.routeName"
                          class="me-2"
                          :density="density"
                          hide-details
                          label="Route Name"
                          :rounded="rounded"
                          :variant="variant"
                        />
                        <v-btn
                          color="primary"
                          icon="mdi-plus"
                          :size="size"
                          @click="addQuickLink"
                        />
                      </div>
                    </v-card-text>
                  </v-card>

                  <!-- Social Media Links -->
                  <v-card
                    class="mb-4"
                    :rounded="rounded"
                    variant="outlined"
                  >
                    <v-card-title class="text-subtitle-1">
                      Social Media Links
                    </v-card-title>
                    <v-card-text>
                      <v-text-field
                        v-model="footerSettings.socialLinks.facebook"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        label="Facebook URL"
                        :rounded="rounded"
                        :variant="variant"
                      />
                      <v-text-field
                        v-model="footerSettings.socialLinks.instagram"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        label="Instagram URL"
                        :rounded="rounded"
                        :variant="variant"
                      />
                      <v-text-field
                        v-model="footerSettings.socialLinks.tiktok"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        label="TikTok URL"
                        :rounded="rounded"
                        :variant="variant"
                      />
                    </v-card-text>
                  </v-card>
                </template>

                <!-- Save Button -->
                <v-btn
                  color="primary"
                  :loading="footerLoading"
                  prepend-icon="mdi-content-save"
                  :rounded="rounded"
                  :size="size"
                  @click="saveFooterSettings"
                >
                  Save Footer Settings
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Appearance Section -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-palette</v-icon>
              <span class="text-h6">Appearance</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                Configure theme and color scheme for light and dark modes
              </div>

              <v-form>
                <!-- Default Theme -->
                <v-select
                  v-model="appearanceSettings.defaultTheme"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :items="[
                    { title: 'Dark', value: 'dark' },
                    { title: 'Light', value: 'light' }
                  ]"
                  label="Default Theme"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Mode Tabs (Colors, Advanced) -->
                <v-tabs
                  v-model="selectedModeTab"
                  class="mb-4"
                  :density="density"
                >
                  <v-tab value="colors">
                    Colors
                  </v-tab>
                  <v-tab value="advanced">
                    Advanced (JSON)
                  </v-tab>
                </v-tabs>

                <v-window v-model="selectedModeTab">
                  <!-- Colors Mode -->
                  <v-window-item value="colors">
                    <!-- Theme Color Tabs -->
                    <v-tabs
                      v-model="selectedThemeTab"
                      class="mb-4"
                      :density="density"
                    >
                      <v-tab value="light">
                        Light Theme
                      </v-tab>
                      <v-tab value="dark">
                        Dark Theme
                      </v-tab>
                    </v-tabs>

                    <v-window v-model="selectedThemeTab">
                      <!-- Light Theme Colors -->
                      <v-window-item value="light">
                        <v-card
                          class="mt-4"
                          :rounded="rounded"
                          variant="outlined"
                        >
                          <v-card-text>
                            <v-row>
                              <v-col
                                v-for="colorKey in colorKeys"
                                :key="colorKey"
                                cols="12"
                                md="4"
                                sm="6"
                              >
                                <ColorPicker
                                  :key="`light-${colorKey}`"
                                  :label="colorKey"
                                  :model-value="appearanceSettings.lightColors[colorKey]"
                                  :picker-key="`light-${colorKey}`"
                                  @update:model-value="appearanceSettings.lightColors[colorKey] = $event"
                                />
                              </v-col>
                            </v-row>
                          </v-card-text>
                        </v-card>
                      </v-window-item>

                      <!-- Dark Theme Colors -->
                      <v-window-item value="dark">
                        <v-card
                          class="mt-4"
                          :rounded="rounded"
                          variant="outlined"
                        >
                          <v-card-text>
                            <v-row>
                              <v-col
                                v-for="colorKey in colorKeys"
                                :key="colorKey"
                                cols="12"
                                md="4"
                                sm="6"
                              >
                                <ColorPicker
                                  :key="`dark-${colorKey}`"
                                  :label="colorKey"
                                  :model-value="appearanceSettings.darkColors[colorKey]"
                                  :picker-key="`dark-${colorKey}`"
                                  @update:model-value="appearanceSettings.darkColors[colorKey] = $event"
                                />
                              </v-col>
                            </v-row>
                          </v-card-text>
                        </v-card>
                      </v-window-item>
                    </v-window>
                  </v-window-item>

                  <!-- Advanced Mode (JSON) -->
                  <v-window-item value="advanced">
                    <!-- Theme Tabs for Advanced -->
                    <v-tabs
                      v-model="selectedThemeTab"
                      class="mb-4"
                      :density="density"
                    >
                      <v-tab value="light">
                        Light Theme JSON
                      </v-tab>
                      <v-tab value="dark">
                        Dark Theme JSON
                      </v-tab>
                    </v-tabs>

                    <v-window v-model="selectedThemeTab">
                      <!-- Light Theme JSON -->
                      <v-window-item value="light">
                        <v-card
                          class="mt-4"
                          :rounded="rounded"
                          variant="outlined"
                        >
                          <v-card-text>
                            <v-textarea
                              v-model="advancedJson.light"
                              :density="density"
                              :error="!!jsonError.light"
                              :error-messages="jsonError.light"
                              hide-details="auto"
                              label="Light Theme JSON"
                              :rounded="rounded"
                              rows="15"
                              :variant="variant"
                            />
                            <v-btn
                              class="mt-4"
                              color="primary"
                              :density="density"
                              prepend-icon="mdi-check"
                              :rounded="rounded"
                              :size="size"
                              @click="parseAdvancedJson('light')"
                            >
                              Parse & Apply JSON
                            </v-btn>
                          </v-card-text>
                        </v-card>
                      </v-window-item>

                      <!-- Dark Theme JSON -->
                      <v-window-item value="dark">
                        <v-card
                          class="mt-4"
                          :rounded="rounded"
                          variant="outlined"
                        >
                          <v-card-text>
                            <v-textarea
                              v-model="advancedJson.dark"
                              :density="density"
                              :error="!!jsonError.dark"
                              :error-messages="jsonError.dark"
                              hide-details="auto"
                              label="Dark Theme JSON"
                              :rounded="rounded"
                              rows="15"
                              :variant="variant"
                            />
                            <v-btn
                              class="mt-4"
                              color="primary"
                              :density="density"
                              prepend-icon="mdi-check"
                              :rounded="rounded"
                              :size="size"
                              @click="parseAdvancedJson('dark')"
                            >
                              Parse & Apply JSON
                            </v-btn>
                          </v-card-text>
                        </v-card>
                      </v-window-item>
                    </v-window>
                  </v-window-item>
                </v-window>

                <!-- Save Button -->
                <v-btn
                  class="mt-4"
                  color="primary"
                  :loading="appearanceLoading"
                  prepend-icon="mdi-content-save"
                  :rounded="rounded"
                  :size="size"
                  @click="saveAppearanceSettings"
                >
                  Save Appearance Settings
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Organizer Dashboard Banner Section -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-view-dashboard</v-icon>
              <span class="text-h6">Organizer Dashboard Banner</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                Customize the promotional banner displayed on the organizer dashboard
              </div>

              <v-form>
                <!-- Enable/Disable Toggle -->
                <v-switch
                  v-model="organizerBannerSettings.isEnabled"
                  class="mb-4"
                  color="primary"
                  :density="density"
                  hint="Show or hide the banner on organizer dashboard"
                  inset
                  label="Enable Banner"
                  persistent-hint
                />

                <!-- Input fields only show when enabled -->
                <template v-if="organizerBannerSettings.isEnabled">
                  <!-- Icon -->
                  <v-text-field
                    v-model="organizerBannerSettings.icon"
                    class="mb-4"
                    :density="density"
                    hide-details="auto"
                    hint="Material Design icon name (e.g., mdi-printer, mdi-star)"
                    label="Icon *"
                    persistent-hint
                    prepend-inner-icon="mdi-palette"
                    required
                    :rounded="rounded"
                    :variant="variant"
                  />

                  <!-- Title -->
                  <v-text-field
                    v-model="organizerBannerSettings.title"
                    class="mb-4"
                    :density="density"
                    hide-details="auto"
                    label="Title *"
                    required
                    :rounded="rounded"
                    :variant="variant"
                  />

                  <!-- Description -->
                  <v-textarea
                    v-model="organizerBannerSettings.description"
                    class="mb-4"
                    :density="density"
                    hide-details="auto"
                    label="Description"
                    :rounded="rounded"
                    rows="2"
                    :variant="variant"
                  />

                  <!-- CTA Button Text -->
                  <v-text-field
                    v-model="organizerBannerSettings.ctaButtonText"
                    class="mb-4"
                    :density="density"
                    hide-details="auto"
                    label="CTA Button Text *"
                    required
                    :rounded="rounded"
                    :variant="variant"
                  />

                  <!-- CTA Button URL -->
                  <v-text-field
                    v-model="organizerBannerSettings.ctaButtonUrl"
                    class="mb-4"
                    :density="density"
                    hide-details="auto"
                    hint="Must start with http:// or https://"
                    label="CTA Button URL *"
                    persistent-hint
                    prepend-inner-icon="mdi-link"
                    required
                    :rounded="rounded"
                    :variant="variant"
                  />
                </template>

                <!-- Save Button -->
                <v-btn
                  color="primary"
                  :loading="organizerBannerLoading"
                  prepend-icon="mdi-content-save"
                  :rounded="rounded"
                  :size="size"
                  @click="saveOrganizerBannerSettings"
                >
                  Save Banner Settings
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>
      </v-col>
    </v-row>

    <!-- Create/Edit Dialog -->
    <v-dialog
      v-model="dialog"
      max-width="600"
      persistent
    >
      <v-card :rounded="rounded">
        <v-card-title>
          {{ editMode ? 'Edit Banner' : 'Create Banner' }}
        </v-card-title>
        <v-card-text>
          <v-form>

            <!-- Link -->
            <v-text-field
              v-model="formData.link"
              class="mb-4"
              clearable
              :density="density"
              hide-details="auto"
              label="Link (Optional)"
              placeholder="https://example.com"
              prepend-inner-icon="mdi-link"
              :rounded="rounded"
              :variant="variant"
            />

            <!-- Date Range -->
            <v-date-input
              v-model="formData.dateRange"
              class="mb-4"
              color="primary"
              :density="density"
              hide-details="auto"
              label="Date Range *"
              multiple="range"
              prepend-icon=""
              prepend-inner-icon="mdi-calendar-range"
              :rounded="rounded"
              show-adjacent-months
              :variant="variant"
            />

            <!-- Display Order -->
            <v-text-field
              v-model.number="formData.displayOrder"
              class="mb-4"
              :density="density"
              hide-details="auto"
              hint="Lower numbers appear first"
              label="Display Order"
              persistent-hint
              prepend-inner-icon="mdi-sort-numeric-ascending"
              :rounded="rounded"
              type="number"
              :variant="variant"
            />

            <!-- Active Status -->
            <v-switch
              v-model="formData.isActive"
              class="mb-4"
              color="success"
              :density="density"
              hint="Enable or disable this banner"
              inset
              label="Active"
              persistent-hint
            />

            <!-- Image Upload -->
            <div class="mb-4">
              <v-file-upload
                v-model="formData.image"
                accept="image/*"
                clearable
                :density="density"
                hide-details="auto"
                icon="$upload"
                :rounded="rounded"
                show-size
                :title="editMode ? 'Banner Image (Leave empty to keep current)' : 'Banner Image *'"
                :variant="variant"
                @update:model-value="handleImageSelect"
              />
              <v-img
                v-if="imagePreview"
                class="mt-2"
                cover
                max-height="200"
                :src="imagePreview"
              />
            </div>
          </v-form>
        </v-card-text>
        <v-card-actions class="pa-6 pt-0">
          <v-spacer />
          <v-btn
            color="secondary"
            :density="density"
            :rounded="rounded"
            :size="size"
            variant="outlined"
            @click="dialog = false"
          >
            Cancel
          </v-btn>
          <v-btn
            color="primary"
            :density="density"
            :loading="loading"
            :rounded="rounded"
            :size="size"
            variant="flat"
            @click="saveBanner"
          >
            {{ editMode ? 'Update' : 'Create' }}
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
.settings-container {
  min-height: calc(100vh - 64px);
  padding: 24px;
}

.settings-panels {
  border-radius: 16px;
}

.banner-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.banner-card {
  transition: filter 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}

.banner-card:hover {
  filter: drop-shadow(0 0 6px rgb(var(--v-theme-tertiary)));
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
  border-color: rgba(var(--v-theme-tertiary), 0.3) !important;
}

.banner-overlay {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 1;
}

/* Responsive Design */
@media (max-width: 768px) {
  .settings-container {
    padding: 16px;
  }
}
</style>
