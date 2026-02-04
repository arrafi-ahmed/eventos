<script setup>
  import { onMounted, ref, computed } from 'vue'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import ColorPicker from '@/components/ColorPicker.vue'
  import ConfirmationDialog from '@/components/ConfirmationDialog.vue'
  import PageTitle from '@/components/PageTitle.vue'
  import CurrencySelector from '@/components/CurrencySelector.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatDateTime, getApiPublicImageUrl, getClientPublicImageUrl } from '@/utils'

  const { t } = useI18n()

  definePage({
    name: 'settings-admin',
    meta: {
      layout: 'default',
      title: 'Settings',
      titleKey: 'pages.admin.settings',
      requiresAdmin: true,
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const store = useStore()
  const { rounded, variant, density, size } = useUiProps()

  // Computed UI Pattern
  const ui = computed(() => ({
    title: t('settings.title'),
    subtitle: t('settings.subtitle'),
    homepage_banners: {
      title: t('settings.sections.homepage_banners.title'),
      subtitle: t('settings.sections.homepage_banners.subtitle'),
      no_banners: t('settings.sections.homepage_banners.no_banners'),
      create_first: t('settings.sections.homepage_banners.create_first'),
      add_btn: t('settings.sections.homepage_banners.add_btn'),
      count: (count) => t('settings.sections.homepage_banners.count', { count }),
      active: t('settings.sections.homepage_banners.status.active'),
      inactive: t('settings.sections.homepage_banners.status.inactive'),
      edit: t('settings.sections.homepage_banners.actions.edit'),
      delete: t('settings.sections.homepage_banners.actions.delete'),
      delete_confirm: (index) => t('settings.sections.homepage_banners.delete_confirm', { index }),
      delete_title: t('settings.sections.homepage_banners.delete_title'),
    },
    header: {
      title: t('settings.sections.header.title'),
      subtitle: t('settings.sections.header.subtitle'),
      logos: t('settings.sections.header.logos'),
      light_logo: t('settings.sections.header.light_logo'),
      dark_logo: t('settings.sections.header.dark_logo'),
      upload_light: t('settings.sections.header.upload_light'),
      upload_dark: t('settings.sections.header.upload_dark'),
      desktop_width: t('settings.sections.header.desktop_width'),
      mobile_width: t('settings.sections.header.mobile_width'),
      view: t('settings.sections.header.view'),
      no_logos_hint: t('settings.sections.header.no_logos_hint'),
      logo_position: t('settings.sections.header.logo_position'),
      menu_position: t('settings.sections.header.menu_position'),
      save_btn: t('settings.sections.header.save_btn'),
      options: {
        left: t('common.positions.left'),
        center: t('common.positions.center'),
        right: t('common.positions.right'),
      },
      views: {
        desktop: t('common.views.desktop'),
        mobile: t('common.views.mobile'),
      },
    },
    footer: {
      title: t('settings.sections.footer.title'),
      subtitle: t('settings.sections.footer.subtitle'),
      style: t('settings.sections.footer.style'),
      copyright: t('settings.sections.footer.copyright'),
      company_info: t('settings.sections.footer.company_info'),
      company_name: t('settings.sections.footer.company_name'),
      address: t('settings.sections.footer.address'),
      email: t('settings.sections.footer.email'),
      phone: t('settings.sections.footer.phone'),
      quick_links: t('settings.sections.footer.quick_links'),
      link_title: t('settings.sections.footer.link_title'),
      route_name: t('settings.sections.footer.route_name'),
      social_links: t('settings.sections.footer.social_links'),
      facebook: t('settings.sections.footer.facebook'),
      instagram: t('settings.sections.footer.instagram'),
      tiktok: t('settings.sections.footer.tiktok'),
      save_btn: t('settings.sections.footer.save_btn'),
      styles: {
        oneline: t('common.footer_styles.oneline'),
        expanded: t('common.footer_styles.expanded'),
      },
    },
    appearance: {
      title: t('settings.sections.appearance.title'),
      subtitle: t('settings.sections.appearance.subtitle'),
      default_theme: t('settings.sections.appearance.default_theme'),
      colors: t('settings.sections.appearance.tabs.colors'),
      advanced: t('settings.sections.appearance.tabs.advanced'),
      light: t('settings.sections.appearance.tabs.light'),
      dark: t('settings.sections.appearance.tabs.dark'),
      parse_btn: t('settings.sections.appearance.parse_btn'),
      save_btn: t('settings.sections.appearance.save_btn'),
      themes: {
        light: t('common.themes.light'),
        dark: t('common.themes.dark'),
      },
    },
    localization: {
      title: t('settings.sections.localization.title'),
      subtitle: t('settings.sections.localization.subtitle'),
      language: t('settings.sections.localization.language'),
      currency: t('settings.sections.localization.currency'),
      save_btn: t('settings.sections.localization.save_btn'),
    },
    organizer_banner: {
      title: t('settings.sections.organizer_banner.title'),
      subtitle: t('settings.sections.organizer_banner.subtitle'),
      enable: t('settings.sections.organizer_banner.enable'),
      enable_hint: t('settings.sections.organizer_banner.enable_hint'),
      icon: t('settings.sections.organizer_banner.icon'),
      icon_hint: t('settings.sections.organizer_banner.icon_hint'),
      title_label: t('settings.sections.organizer_banner.banner_title'),
      desc_label: t('settings.sections.organizer_banner.banner_desc'),
      cta_text: t('settings.sections.organizer_banner.cta_text'),
      cta_url: t('settings.sections.organizer_banner.cta_url'),
      save_btn: t('settings.sections.organizer_banner.save_btn'),
    },
  }))

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

  // Unified fetch for system settings
  async function fetchSystemSettings() {
    try {
        loading.value = true
        await store.dispatch('systemSettings/fetchSettings')
        const settings = store.state.systemSettings.settings
        
        // Populate Footer
        footerSettings.value = {
            style: settings.footer?.style || 'expanded',
            companyName: settings.footer?.companyName || '',
            companyAddress: settings.footer?.companyAddress || '',
            companyEmail: settings.footer?.companyEmail || '',
            companyPhone: settings.footer?.companyPhone || '',
            quickLinks: Array.isArray(settings.footer?.quickLinks) ? [...settings.footer.quickLinks] : [],
            socialLinks: {
                facebook: settings.footer?.socialLinks?.facebook || '',
                instagram: settings.footer?.socialLinks?.instagram || '',
                tiktok: settings.footer?.socialLinks?.tiktok || '',
            },
            copyrightText: settings.footer?.copyrightText || '',
        }

        // Populate Header
        headerSettings.value = {
            logoImage: settings.header?.logoImage || null,
            logoImageDark: settings.header?.logoImageDark || null,
            logoPosition: settings.header?.logoPosition || 'left',
            menuPosition: settings.header?.menuPosition || 'right',
            logoWidthLeft: settings.header?.logoWidthLeft || 300,
            logoWidthMobile: settings.header?.logoWidthMobile || 120,
        }
        logoPreview.value = settings.header?.logoImage ? getApiPublicImageUrl(settings.header.logoImage, 'header-logo') : null
        logoPreviewDark.value = settings.header?.logoImageDark ? getApiPublicImageUrl(settings.header.logoImageDark, 'header-logo') : null
        logoFile.value = null
        logoFileDark.value = null

        // Populate Appearance
        appearanceSettings.value = {
            defaultTheme: settings.appearance?.defaultTheme || 'dark',
            lightColors: settings.appearance?.lightColors || {},
            lightVariables: settings.appearance?.lightVariables || {},
            darkColors: settings.appearance?.darkColors || {},
            darkVariables: settings.appearance?.darkVariables || {},
        }
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

        // Populate Organizer Banner
        organizerBannerSettings.value = {
            isEnabled: settings.organizer_dashboard_banner?.isEnabled !== false, // Default to true if missing? or false? logic says !== false so true by default? Check old logic: !== false.
            icon: settings.organizer_dashboard_banner?.icon,
            title: settings.organizer_dashboard_banner?.title,
            description: settings.organizer_dashboard_banner?.description,
            ctaButtonText: settings.organizer_dashboard_banner?.ctaButtonText,
            ctaButtonUrl: settings.organizer_dashboard_banner?.ctaButtonUrl,
        }

        // Populate Localization
        localizationSettings.value = {
            defaultCurrency: settings.localization?.defaultCurrency || 'USD',
            defaultLanguage: settings.localization?.defaultLanguage || 'en',
        }

    } catch (error) {
        console.error('Error fetching system settings:', error)
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
      await store.dispatch('systemSettings/updateSettings', {
        section: 'footer',
        data: payload
      })
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

      await store.dispatch('systemSettings/updateSettings', {
        section: 'header',
        data
      })
      await fetchSystemSettings()
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

  async function saveAppearanceSettings () {
    try {
      appearanceLoading.value = true
      await store.dispatch('systemSettings/updateSettings', {
        section: 'appearance',
        data: {
            defaultTheme: appearanceSettings.value.defaultTheme,
            lightColors: appearanceSettings.value.lightColors,
            lightVariables: appearanceSettings.value.lightVariables,
            darkColors: appearanceSettings.value.darkColors,
            darkVariables: appearanceSettings.value.darkVariables,
        }
      })
      await fetchSystemSettings()
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

  // Localization settings
  const localizationLoading = ref(false)
  const localizationSettings = ref({
    defaultCurrency: 'USD',
    defaultLanguage: 'en',
  })

  const languageOptions = computed(() => [
    { title: t('common.languages.en'), value: 'en' },
    { title: t('common.languages.fr'), value: 'fr' },
  ])


  async function saveLocalizationSettings () {
    try {
      localizationLoading.value = true
      await store.dispatch('systemSettings/updateSettings', {
        section: 'localization',
        data: {
            defaultCurrency: localizationSettings.value.defaultCurrency,
            defaultLanguage: localizationSettings.value.defaultLanguage,
        }
      })
      await fetchSystemSettings()
    } catch (error) {
      console.error('Error saving localization settings:', error)
    } finally {
      localizationLoading.value = false
    }
  }

  async function saveOrganizerBannerSettings () {
    try {
      organizerBannerLoading.value = true

      // If disabled, only update isEnabled flag
      if (!organizerBannerSettings.value.isEnabled) {
        await store.dispatch('systemSettings/updateSettings', {
            section: 'organizer_dashboard_banner',
            data: { isEnabled: false }
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

      await store.dispatch('systemSettings/updateSettings', {
        section: 'organizer_dashboard_banner',
        data: {
            isEnabled: true,
            icon,
            title,
            description: organizerBannerSettings.value.description?.trim() || null,
            ctaButtonText,
            ctaButtonUrl,
        }
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
    fetchSystemSettings()
  })
</script>

<template>
  <v-container class="settings-container">
    <PageTitle
      :show-back-button="true"
      :subtitle="ui.subtitle"
      :title="ui.title"
      :title-key="'pages.admin.settings'"
    />

    <v-row align="center" justify="center">
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
              <span class="text-h6">{{ ui.homepage_banners.title }}</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ ui.homepage_banners.subtitle }}
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
                <p class="text-h6 text-grey mb-2">{{ ui.homepage_banners.no_banners }}</p>
                <p class="text-body-2 text-grey mb-4">{{ ui.homepage_banners.create_first }}</p>
                <v-btn
                  color="primary"
                  prepend-icon="mdi-plus"
                  :rounded="rounded"
                  :size="size"
                  @click="openCreateDialog"
                >
                  {{ ui.homepage_banners.add_btn }}
                </v-btn>
              </div>

              <div v-else>
                <div class="d-flex align-center justify-space-between mb-4">
                  <div class="text-body-1 font-weight-medium">
                    {{ ui.homepage_banners.count(banners.length) }}
                  </div>
                  <v-btn
                    color="primary"
                    prepend-icon="mdi-plus"
                    :rounded="rounded"
                    :size="size"
                    @click="openCreateDialog"
                  >
                    {{ ui.homepage_banners.add_btn }}
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
                            {{ isBannerActive(banner) ? ui.homepage_banners.active : ui.homepage_banners.inactive }}
                          </v-chip>
                        </div>
                      </v-img>

                      <v-card-text class="pa-4">
                        <div class="d-flex align-center justify-space-between">
                          <div class="text-h6">
                            {{ ui.homepage_banners.count(index + 1) }}
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
                          {{ ui.homepage_banners.edit }}
                        </v-btn>
                        <v-spacer />
                        <confirmation-dialog
                          :popup-content="ui.homepage_banners.delete_confirm(index + 1)"
                          :popup-title="ui.homepage_banners.delete_title"
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
                              {{ ui.homepage_banners.delete }}
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
              <span class="text-h6">{{ ui.header.title }}</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ ui.header.subtitle }}
              </div>

              <v-form>
                <!-- Logo Upload -->
                <v-card
                  class="mb-4"
                  :rounded="rounded"
                  variant="outlined"
                >
                  <v-card-title class="text-subtitle-1">
                    {{ ui.header.logos }}
                  </v-card-title>
                  <v-card-text>
                    <v-row>
                      <v-col cols="12" md="6">
                        <div class="text-caption mb-1">{{ ui.header.light_logo }}</div>
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
                        <div class="text-caption mb-1">{{ ui.header.dark_logo }}</div>
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
                          { title: ui.header.views.desktop, value: 'desktop' },
                          { title: ui.header.views.mobile, value: 'mobile' }
                        ]"
                        :label="ui.header.view"
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
                          {{ ui.header.no_logos_hint }}
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
                    { title: ui.header.options.left, value: 'left' },
                    { title: ui.header.options.center, value: 'center' },
                    { title: ui.header.options.right, value: 'right' }
                  ]"
                  :label="ui.header.logo_position"
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
                    { title: ui.header.options.left, value: 'left' },
                    { title: ui.header.options.center, value: 'center' },
                    { title: ui.header.options.right, value: 'right' }
                  ]"
                  :label="ui.header.menu_position"
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
                  {{ ui.header.save_btn }}
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Customize Footer Section -->
          <!-- Customize Footer Hidden -->
          <v-expansion-panel v-if="false">
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-format-page-break</v-icon>
              <span class="text-h6">{{ ui.footer.title }}</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ ui.footer.subtitle }}
              </div>

              <v-form>
                <!-- Footer Style -->
                <v-select
                  v-model="footerSettings.style"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :items="[
                    { title: ui.footer.styles.oneline, value: 'oneline' },
                    { title: ui.footer.styles.expanded, value: 'expanded' }
                  ]"
                  :label="ui.footer.style"
                  :rounded="rounded"
                  :variant="variant"
                />

                <!-- Copyright Text (available for both styles) -->
                <v-text-field
                  v-model="footerSettings.copyrightText"
                  class="mb-4"
                  :density="density"
                  hide-details="auto"
                  :label="ui.footer.copyright"
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
                      {{ ui.footer.company_info }}
                    </v-card-title>
                    <v-card-text>
                      <v-text-field
                        v-model="footerSettings.companyName"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        :label="ui.footer.company_name"
                        :rounded="rounded"
                        :variant="variant"
                      />
                      <v-textarea
                        v-model="footerSettings.companyAddress"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        :label="ui.footer.address"
                        :rounded="rounded"
                        rows="2"
                        :variant="variant"
                      />
                      <v-text-field
                        v-model="footerSettings.companyEmail"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        :label="ui.footer.email"
                        :rounded="rounded"
                        type="email"
                        :variant="variant"
                      />
                      <v-text-field
                        v-model="footerSettings.companyPhone"
                        class="mb-4"
                        :density="density"
                        hide-details="auto"
                        :label="ui.footer.phone"
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
                      {{ ui.footer.quick_links }}
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
                      {{ ui.footer.social_links }}
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
                  {{ ui.footer.save_btn }}
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Appearance Section -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-palette</v-icon>
              <span class="text-h6">{{ ui.appearance.title }}</span>
            </v-expansion-panel-title>
              <v-expansion-panel-text>
                <div class="text-body-2 text-medium-emphasis mb-4">
                  {{ ui.appearance.subtitle }}
                </div>

              <v-form>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="appearanceSettings.defaultTheme"
                      :density="density"
                      hide-details="auto"
                      :items="[
                        { title: ui.appearance.themes.dark, value: 'dark' },
                        { title: ui.appearance.themes.light, value: 'light' }
                      ]"
                      :label="ui.appearance.default_theme"
                      :rounded="rounded"
                      :variant="variant"
                    />
                  </v-col>
                </v-row>

                <!-- Mode Tabs (Colors, Advanced) -->
                <v-tabs
                  v-model="selectedModeTab"
                  class="mb-4"
                  :density="density"
                >
                  <v-tab value="colors">
                    {{ ui.appearance.colors }}
                  </v-tab>
                  <v-tab value="advanced">
                    {{ ui.appearance.advanced }}
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
                        {{ ui.appearance.light }}
                      </v-tab>
                      <v-tab value="dark">
                        {{ ui.appearance.dark }}
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
                              {{ ui.appearance.parse_btn }}
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
                              {{ ui.appearance.parse_btn }}
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
                  {{ ui.appearance.save_btn }}
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Localization Settings Section -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-translate</v-icon>
              <span class="text-h6">{{ ui.localization.title }}</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ ui.localization.subtitle }}
              </div>

              <v-form>
                <v-row>
                  <v-col cols="12" md="6">
                    <v-select
                      v-model="localizationSettings.defaultLanguage"
                      :density="density"
                      hide-details="auto"
                      :items="languageOptions"
                      :label="ui.localization.language"
                      :rounded="rounded"
                      :variant="variant"
                    />
                  </v-col>
                  <v-col cols="12" md="6">
                    <CurrencySelector
                      v-model="localizationSettings.defaultCurrency"
                      :density="density"
                      :label="ui.localization.currency"
                      :rounded="rounded"
                      :variant="variant"
                    />
                  </v-col>
                </v-row>

                <v-btn
                  class="mt-4"
                  color="primary"
                  :loading="localizationLoading"
                  prepend-icon="mdi-content-save"
                  :rounded="rounded"
                  :size="size"
                  @click="saveLocalizationSettings"
                >
                  {{ ui.localization.save_btn }}
                </v-btn>
              </v-form>
            </v-expansion-panel-text>
          </v-expansion-panel>

          <!-- Organizer Dashboard Banner Section -->
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon class="me-2">mdi-view-dashboard</v-icon>
              <span class="text-h6">{{ ui.organizer_banner.title }}</span>
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2 text-medium-emphasis mb-4">
                {{ ui.organizer_banner.subtitle }}
              </div>

              <v-form>
                <!-- Enable/Disable Toggle -->
                <v-switch
                  v-model="organizerBannerSettings.isEnabled"
                  class="mb-4"
                  color="primary"
                  :density="density"
                  :hint="ui.organizer_banner.enable_hint"
                  inset
                  :label="ui.organizer_banner.enable"
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
                    :hint="ui.organizer_banner.icon_hint"
                    :label="ui.organizer_banner.icon"
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
                    :label="ui.organizer_banner.title_label"
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
                    :label="ui.organizer_banner.desc_label"
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
                    :label="ui.organizer_banner.cta_text"
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
                    :hint="ui.organizer_banner.cta_url_hint"
                    :label="ui.organizer_banner.cta_url"
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
                  {{ ui.organizer_banner.save_btn }}
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
  }
}
</style>
