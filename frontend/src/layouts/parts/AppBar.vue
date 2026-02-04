<script setup>
  import { computed, onMounted, onUnmounted, ref } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay, useTheme } from 'vuetify'
  import { useStore } from 'vuex'
  import { useI18n } from 'vue-i18n'
  import Logo from '@/components/Logo.vue'
  import UserAvatar from '@/components/UserAvatar.vue'
  import { getApiPublicImageUrl, getClientPublicImageUrl, getToLink } from '@/utils'

  const store = useStore()
  const router = useRouter()
  const route = useRoute()
  const { locale, t } = useI18n()

  const signedin = computed(() => store.getters['auth/signedin'])
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const calcHome = computed(() => store.getters['auth/calcHome'])

  const isRequiresNoAuth = computed(() =>
    route.matched?.some(record => record.meta?.requiresNoAuth),
  )

  const isAdmin = computed(() => store.getters['auth/isAdmin'])
  const isOrganizer = computed(() => store.getters['auth/isOrganizer'])
  const isCashier = computed(() => store.getters['auth/isCashier'])
  const isStaff = computed(() => store.getters['auth/isStaff'])

  // Get header settings from layout store
  const headerSettings = computed(() => store.getters['layout/header'] || {
    logoImage: null,
    logoImageDark: null,
    logoPosition: 'left',
    menuPosition: 'right',
    logoWidthLeft: 300,
    logoWidthMobile: 120,
  })

  // Get current theme
  const theme = useTheme()
  const isDark = computed(() => theme.global.name.value === 'dark')

  // Get loading state from store
  const headerSettingsLoading = computed(() => store.getters['layout/isLoading'])

  // Computed logo position (use settings or fallback to prop)
  const computedLogoPosition = computed(() => headerSettings.value.logoPosition || posLogo || 'left')
  const computedMenuPosition = computed(() => headerSettings.value.menuPosition || posMenu || 'right')

  // Computed logo width - responsive: mobile or desktop
  const { xs } = useDisplay()
  const computedLogoWidth = computed(() => {
    if (xs.value) {
      return headerSettings.value.logoWidthMobile || 120
    }
    return headerSettings.value.logoWidthLeft || 300
  })

  // Get logo image URL (chooses based on theme)
  const logoImageUrl = computed(() => {
    // If dark theme, try logoImageDark first, then fallback to logoImage
    const logo = isDark.value
      ? (headerSettings.value.logoImageDark || headerSettings.value.logoImage)
      : headerSettings.value.logoImage

    if (logo) {
      return getApiPublicImageUrl(logo, 'header-logo')
    }
    return null // No logo, will show app name text
  })

  // Only show text logo if not loading AND no logo image
  // This prevents showing text logo while loading from database
  const shouldShowTextLogo = computed(() => {
    return !headerSettingsLoading.value && !logoImageUrl.value
  })

  const menuItemsAdmin = computed(() => [
    {
      title: t('menu.dashboard'),
      to: { name: 'admin-dashboard' },
      icon: 'mdi-view-dashboard',
    },
    {
      title: t('menu.organizer_review'),
      to: { name: 'admin-review' },
      icon: 'mdi-account-check',
    },
    {
      title: t('menu.settings'),
      to: { name: 'settings-admin' },
      icon: 'mdi-cog',
    },
    {
      title: t('menu.export_data'),
      to: { name: 'export-data-admin' },
      icon: 'mdi-download',
    },
  ])

  const menuItemsOrganizer = computed(() => [
    {
      title: t('menu.dashboard'),
      to: { name: 'dashboard-organizer' },
      icon: 'mdi-view-dashboard',
    },
    {
      title: t('menu.add_event'),
      to: { name: 'event-add' },
      icon: 'mdi-plus',
    },
    {
      title: t('menu.ticket_counters'),
      to: { name: 'admin-ticket-counters' },
      icon: 'mdi-ticket-confirmation-outline',
    },
    {
      title: t('menu.manage_staff'),
      to: { name: 'organizer-staff' },
      icon: 'mdi-account-group',
    },
    {
      title: t('menu.cashier_sales'),
      to: { name: 'manage-sales-logs' },
      icon: 'mdi-receipt-text-outline',
    },
    {
      title: t('menu.session_history'),
      to: { name: 'counter-sessions' },
      icon: 'mdi-history',
    },
  ])

  const menuItemsCashier = computed(() => [
    {
      title: t('menu.pos_sales'),
      to: { name: 'counter-shift-start' },
      icon: 'mdi-cash-register',
    },
    {
      title: t('menu.session_history'),
      to: { name: 'counter-sessions' },
      icon: 'mdi-history',
    },
  ])

  const menuItemsStaff = computed(() => [
    {
      title: t('menu.scanner'),
      to: { name: 'staff-checkin' },
      icon: 'mdi-account-check-outline',
    },
  ])

  const menuItemsAttendee = computed(() => [
    {
      title: t('menu.my_orders'),
      to: { name: 'recent-orders' },
      icon: 'mdi-ticket-confirmation',
    },
  ])

  const menuItemsCommon = computed(() => [
    {
      title: t('menu.profile'),
      to: { name: 'profile' },
      icon: 'mdi-account',
    },
    {
      title: t('menu.support'),
      to: { name: 'support' },
      icon: 'mdi-robot',
    },
  ])

  const menuItems = computed(() => {
    if (!signedin.value) {
      return []
    }

    let items = []
    if (isAdmin.value) {
      items = items.concat(menuItemsAdmin.value)
    } else if (isOrganizer.value) {
      items = items.concat(menuItemsOrganizer.value)
    } else if (isCashier.value) {
      items = items.concat(menuItemsCashier.value)
    } else if (isStaff.value) {
      items = items.concat(menuItemsStaff.value)
    } else {
      // Attendees and other roles
      items = items.concat(menuItemsAttendee.value)
    }

    return items.concat(menuItemsCommon.value)
  })

  const drawer = ref(false)
  const isScrolled = ref(false)

  function handleScroll () {
    const currentScroll = window.scrollY
    if (currentScroll > 80) {
      isScrolled.value = true
    } else if (currentScroll < 20) {
      isScrolled.value = false
    }
  }

  onMounted(() => {
    window.addEventListener('scroll', handleScroll)
  })

  onUnmounted(() => {
    window.removeEventListener('scroll', handleScroll)
  })

  // Props for back button functionality and positioning (can override settings)
  const {
    showBackButton,
    backButtonText,
    backRoute,
    posLogo,
    posMenu,
  } = defineProps({
    showBackButton: {
      type: Boolean,
      default: false,
    },
    backButtonText: {
      type: String,
      default: 'Back',
    },
    backRoute: {
      type: [String, Object],
      default: null,
    },
    posLogo: {
      type: String,
      default: null, // null means use settings
      validator: value => !value || ['left', 'center', 'right'].includes(value),
    },
    posMenu: {
      type: String,
      default: null, // null means use settings
      validator: value => !value || ['left', 'center', 'right'].includes(value),
    },
  })

  // Determine if we should show back button based on route
  const shouldShowBackButton = computed(() => {
    // Show back button for purchase flow pages
    const purchaseFlowRoutes = [
      'tickets',
      'tickets-slug',
      'checkout',
      'checkout-slug',
      'attendee-form',
      'attendee-form-slug',
      'event-register-success',
      'event-register-success-slug',
      'success',
    ]
    return showBackButton || purchaseFlowRoutes.includes(route.name)
  })

  // Get back button text based on route
  const getBackButtonText = computed(() => {
    if (backButtonText) return backButtonText

    // Default back button text based on route
    switch (route.name) {
      case 'tickets':
      case 'tickets-slug': {
        return t('menu.back_to_landing')
      }
      case 'checkout':
      case 'checkout-slug': {
        return t('menu.back_to_tickets')
      }
      case 'attendee-form':
      case 'attendee-form-slug': {
        return t('menu.back_to_tickets')
      }
      case 'event-register-success':
      case 'event-register-success-slug':
      case 'success': {
        return t('menu.back_to_event')
      }
      default: {
        return t('menu.back')
      }
    }
  })

  function handleLogoClick () {
    router.push({ name: 'homepage' })
  }

  const getFirstName = computed(() => (currentUser.value?.fullName || '').split(' ')[0] || '')
  const getGreetings = computed(() => {
    const h = new Date().getHours()
    if (h < 12) return t('menu.good_morning')
    if (h < 18) return t('menu.good_afternoon')
    return t('menu.good_evening')
  })

  // Computed UI Pattern
  const ui = computed(() => ({
    welcome: t('menu.welcome'),
    discover_events: t('menu.discover_events'),
    signin: t('menu.signin'),
    signout: t('menu.signout'),
  }))

  function goBack () {
    if (backRoute) {
      if (typeof backRoute === 'string') {
        router.push(backRoute)
      } else {
        router.push(backRoute)
      }
    } else {
      // Route-based navigation for purchase flow
      switch (route.name) {
        case 'tickets-slug': {
          router.push({ name: 'event-landing-slug', params: { slug: route.params.slug } })
          break
        }
        case 'checkout-slug': {
          router.push({ name: 'tickets-slug', params: { slug: route.params.slug } })
          break
        }
        case 'attendee-form-slug': {
          router.push({ name: 'tickets-slug', params: { slug: route.params.slug } })
          break
        }
        case 'event-register-success-slug': {
          router.push({ name: 'event-landing-slug', params: { slug: route.params.slug } })
          break
        }
        case 'success': {
          router.push({ name: 'landing' })
          break
        }
        default: {
          router.back()
        }
      }
    }
  }

  const changeLanguage = (lang) => {
    locale.value = lang
    localStorage.setItem('user-locale', lang)
  }
</script>

<template>
  <v-app-bar
    :class="['px-4 px-md-10', { 'app-bar-scrolled': isScrolled }]"
    color="transparent"
    density="default"
    flat
    :height="xs ? 64 : (isScrolled ? 64 : 80)"
    :order="1"
  >
    <div class="app-bar-content">
      <!-- Left Section -->
      <div class="app-bar-section app-bar-left">
        <Logo
          v-if="computedLogoPosition === 'left' && (!headerSettingsLoading || logoImageUrl)"
          :container-class="`rounded-lg ${isScrolled ? 'bg-transparent' : ''}`"
          :img-src="logoImageUrl"
          :style="{ opacity: 1, cursor: 'pointer' }"
          :title="shouldShowTextLogo"
          :width="logoImageUrl ? computedLogoWidth : undefined"
          @click="handleLogoClick"
        />
        <!-- Skeleton placeholder while loading (only if no logo will be shown) -->
        <div
          v-if="computedLogoPosition === 'left' && headerSettingsLoading && !logoImageUrl"
          class="d-flex align-center"
          :style="{ width: `${computedLogoWidth}px`, height: '40px' }"
        >
          <v-skeleton-loader
            height="40"
            type="image"
            :width="computedLogoWidth"
          />
        </div>
        <v-btn
          v-if="computedMenuPosition === 'left'"
          class="d-flex align-center"
          icon="mdi-menu"
          variant="text"
          @click="drawer = !drawer"
        />
      </div>

      <!-- Center Section -->
      <div class="app-bar-section app-bar-center">
        <Logo
          v-if="computedLogoPosition === 'center' && (!headerSettingsLoading || logoImageUrl)"
          :container-class="`rounded-lg ${isScrolled ? 'bg-transparent' : ''}`"
          :img-src="logoImageUrl"
          :style="{ opacity: 1, cursor: 'pointer' }"
          :title="shouldShowTextLogo"
          :width="logoImageUrl ? computedLogoWidth : undefined"
          @click="handleLogoClick"
        />
        <!-- Skeleton placeholder while loading (only if no logo will be shown) -->
        <div
          v-if="computedLogoPosition === 'center' && headerSettingsLoading && !logoImageUrl"
          class="d-flex align-center"
          :style="{ width: `${computedLogoWidth}px`, height: '40px' }"
        >
          <v-skeleton-loader
            height="40"
            type="image"
            :width="computedLogoWidth"
          />
        </div>
        <v-btn
          v-if="computedMenuPosition === 'center'"
          class="d-flex align-center"
          icon="mdi-menu"
          variant="text"
          @click="drawer = !drawer"
        />
      </div>

      <!-- Right Section -->
      <div class="app-bar-section app-bar-right">

        <Logo
          v-if="computedLogoPosition === 'right' && (!headerSettingsLoading || logoImageUrl)"
          :container-class="`rounded-lg ${isScrolled ? 'bg-transparent' : ''}`"
          :img-src="logoImageUrl"
          :style="{ opacity: 1, cursor: 'pointer' }"
          :title="shouldShowTextLogo"
          :width="logoImageUrl ? computedLogoWidth : undefined"
          @click="handleLogoClick"
        />
        <!-- Skeleton placeholder while loading (only if no logo will be shown) -->
        <div
          v-if="computedLogoPosition === 'right' && headerSettingsLoading && !logoImageUrl"
          class="d-flex align-center"
          :style="{ width: `${computedLogoWidth}px`, height: '40px' }"
        >
          <v-skeleton-loader
            height="40"
            type="image"
            :width="computedLogoWidth"
          />
        </div>
        <v-btn
          v-if="computedMenuPosition === 'right'"
          class="d-flex align-center"
          icon="mdi-menu"
          variant="text"
          @click="drawer = !drawer"
        />
      </div>
    </div>
  </v-app-bar>

  <!-- Navigation Drawer -->
  <v-navigation-drawer
    v-model="drawer"
    location="end"
    temporary
    :width="280"
  >
    <v-list nav>
      <v-divider class="mb-2" />

      <v-list-item v-if="signedin" class="user-greeting-card py-4 rounded-xl mb-4">
        <div class="d-flex justify-start align-center">
          <UserAvatar
            class="elevation-2 border-gradient"
            :clickable="false"
            :img-src="currentUser?.avatar"
            size="48"
          />
          <div class="ml-4">
            <div class="text-caption text-medium-emphasis mb-n1">{{ getGreetings }}</div>
            <div class="text-h6 font-weight-bold">{{ getFirstName }}</div>
          </div>
        </div>
      </v-list-item>

      <!-- Welcome card for logged-out users -->
      <v-list-item v-else class="user-greeting-card py-5 rounded-xl mb-4">
        <div class="d-flex justify-start align-center">
          <v-avatar class="elevation-2" color="primary-lighten-4" size="52">
            <v-icon color="primary" size="32">mdi-auto-fix</v-icon>
          </v-avatar>
          <div class="ml-4">
            <div class="text-h6 font-weight-bold mb-n1">{{ ui.welcome }}</div>
            <div class="text-caption text-medium-emphasis">{{ ui.discover_events }}</div>
          </div>
        </div>
      </v-list-item>
      <v-list-item
        v-for="(item, index) in menuItems"
        :key="index"
        :prepend-icon="item.icon"
        rounded
        :to="getToLink(item)"
      >
        <v-list-item-title class="nav-item-text">{{ item.title }}</v-list-item-title>
      </v-list-item>
      <v-divider class="my-4" />

      <v-list-item
        prepend-icon="mdi-translate"
        rounded
      >
        <v-list-item-title class="nav-item-text">{{ t('menu.language') }}</v-list-item-title>
        <template #append>
          <v-menu location="start" offset-x>
            <template #activator="{ props }">
              <v-btn
                class="text-uppercase font-weight-bold"
                color="primary"
                density="comfortable"
                size="small"
                v-bind="props"
                variant="tonal"
              >
                {{ locale }}
              </v-btn>
            </template>
            <v-list density="compact" rounded="lg">
              <v-list-item @click="changeLanguage('en')">
                <template #prepend>🇺🇸</template>
                <v-list-item-title class="ml-2">English</v-list-item-title>
              </v-list-item>
              <v-list-item @click="changeLanguage('fr')">
                <template #prepend>🇫🇷</template>
                <v-list-item-title class="ml-2">Français</v-list-item-title>
              </v-list-item>
            </v-list>
          </v-menu>
        </template>
      </v-list-item>
    </v-list>
    <template #append>
      <div class="ma-5">

        <v-btn
          v-if="signedin"
          block
          color="primary"
          prepend-icon="mdi-exit-to-app"
          rounded="xl"
          :to="{ name: 'signout' }"
        >
          {{ ui.signout }}
        </v-btn>
        <v-btn
          v-else
          block
          color="primary"
          prepend-icon="mdi-exit-to-app"
          rounded="xl"
          :to="{ name: 'signin' }"
        >
          {{ ui.signin }}
        </v-btn>
      </div>
    </template>
  </v-navigation-drawer>
</template>

<style scoped>
.v-app-bar {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1) !important;
}

.app-bar-scrolled {
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  background-color: rgba(var(--v-theme-surface), 0.7) !important;
  border-bottom: 1px solid rgba(var(--v-border-color), 0.08) !important;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.05) !important;
}

.user-greeting-card {
  background: linear-gradient(135deg, rgba(var(--v-theme-primary), 0.05), rgba(var(--v-theme-accent), 0.05));
  border: 1px solid rgba(var(--v-theme-primary), 0.1);
}

.border-gradient {
  background: white;
  padding: 2px;
  position: relative;
}

.nav-item-text {
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  font-weight: 500;
  letter-spacing: 0.01em;
}

/* Override v-app-bar default layout */
:deep(.v-toolbar__content) {
  padding: 0 !important;
  width: 100%;
  display: flex !important;
  justify-content: flex-start !important;
}

/* App bar content wrapper */
.app-bar-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  gap: 16px;
  flex: 1;
}

/* Each section takes equal space for proper alignment */
.app-bar-section {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

/* Left section - align items to start */
.app-bar-left {
  justify-content: flex-start;
}

/* Center section - align items to center */
.app-bar-center {
  justify-content: center;
}

/* Right section - align items to end */
.app-bar-right {
  justify-content: flex-end;
}
</style>
