/**
 * plugins/vuetify.js
 *
 * Framework documentation: https://vuetifyjs.com`
 */

// Composables
import { createVuetify } from 'vuetify'
import { VDateInput } from 'vuetify/labs/VDateInput'
import { VFileUpload } from 'vuetify/labs/VFileUpload'
import { VStepperVertical, VStepperVerticalItem } from 'vuetify/labs/VStepperVertical'

import { VPie } from 'vuetify/labs/VPie'

// Styles
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'
import '../styles/vuetify-overrides.css'
import '../styles/components.css'

// Defaults are defined in backend/src/service/appearanceSettings.js
// These are minimal initial defaults - will be overridden by backend settings
const light = {
  dark: false,
  colors: {
    'background': '#F8FAFC',
    'surface': '#FFFFFF',
    'surface-variant': '#F1F5F9',
    'surface-bright': '#FFFFFF',
    'primary': '#ED2939',
    'on-primary': '#FFFFFF',
    'secondary': '#64748B',
    'on-secondary': '#FFFFFF',
    'accent': '#0EA5E9',
    'on-accent': '#FFFFFF',
    'tertiary': '#0F172A',
    'on-tertiary': '#FFFFFF',
    'success': '#10B981',
    'on-success': '#FFFFFF',
    'error': '#EF4444',
    'on-error': '#FFFFFF',
    'warning': '#F59E0B',
    'on-warning': '#FFFFFF',
    'info': '#3B82F6',
    'on-info': '#FFFFFF',
    'on-background': '#0F172A',
    'on-surface': '#0F172A',
    'on-surface-variant': '#64748B',
    'outline': '#E2E8F0',
    'outline-variant': '#F1F5F9',
    'on-gradient-light': '#0F172A', // Dark text for light theme gradients
    'on-gradient-dark': '#FFFFFF', // Light text for dark theme gradients
  },
}

// Defaults are defined in backend/src/service/appearanceSettings.js
// These are minimal initial defaults - will be overridden by backend settings
const dark = {
  dark: true,
  colors: {
    'background': '#383838',
    'surface': '#424242',
    'surface-variant': '#4A4A4A',
    'surface-bright': '#505050',
    'primary': '#ccff00',
    'on-primary': '#000000',
    'secondary': '#00A1DE',
    'on-secondary': '#FFFFFF',
    'accent': '#00A1DE',
    'on-accent': '#FFFFFF',
    'tertiary': '#FFFFFF',
    'on-tertiary': '#383838',
    'success': '#4CAF50',
    'on-success': '#FFFFFF',
    'error': '#ED2939',
    'on-error': '#FFFFFF',
    'warning': '#FF9800',
    'on-warning': '#FFFFFF',
    'info': '#00A1DE',
    'on-info': '#FFFFFF',
    'on-background': '#FFFFFF',
    'on-surface': '#FFFFFF',
    'on-surface-variant': '#E0E0E0',
    'outline': '#616161',
    'outline-variant': '#757575',
    'on-gradient-light': '#1F1F1F', // Dark text for light theme gradients
    'on-gradient-dark': '#FFFFFF', // Light text for dark theme gradients
  },
  variables: {
    'border-color': '#616161',
    'border-opacity': 0.12,
    'high-emphasis-opacity': 1,
    'medium-emphasis-opacity': 0.8,
    'disabled-opacity': 0.5,
    'idle-opacity': 0.1,
    'hover-opacity': 0.08,
    'focus-opacity': 0.12,
    'selected-opacity': 0.12,
    'activated-opacity': 0.12,
    'pressed-opacity': 0.16,
    'dragged-opacity': 0.08,
    'kbd-background-color': '#424242',
    'kbd-color': '#FFFFFF',
    'code-background-color': '#424242',
  },
}

// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides
const vuetify = createVuetify({
  components: {
    VFileUpload,
    VDateInput,
    VPie,
    VStepperVertical,
    VStepperVerticalItem,
  },
  theme: {
    defaultTheme: 'dark',
    themes: {
      light,
      dark,
    },
  },
  defaults: {},
})

export default vuetify
