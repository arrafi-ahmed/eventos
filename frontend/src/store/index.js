import { createStore } from 'vuex'

import * as admin from '@/store/modules/admin'
import * as appearanceSettings from '@/store/modules/appearanceSettings'
import * as appUser from '@/store/modules/appUser'
import * as auth from '@/store/modules/auth'
import * as checkin from '@/store/modules/checkin'
import * as checkout from '@/store/modules/checkout'
import * as counter from '@/store/modules/counter'
import * as event from '@/store/modules/event'
import * as extras from '@/store/modules/extras'
import * as footerSettings from '@/store/modules/footerSettings'
import * as form from '@/store/modules/form'
import * as headerSettings from '@/store/modules/headerSettings'
import * as homepage from '@/store/modules/homepage'
import * as layout from '@/store/modules/layout'
import * as order from '@/store/modules/order'
import * as organization from '@/store/modules/organization'
import * as organizerDashboardBanner from '@/store/modules/organizerDashboardBanner'
import * as preferences from '@/store/modules/preferences'
import * as product from '@/store/modules/product'
import * as productOrder from '@/store/modules/productOrder'
import * as promoCode from '@/store/modules/promoCode'
import * as registration from '@/store/modules/registration'
import * as sponsorship from '@/store/modules/sponsorship'
import * as sponsorshipPackage from '@/store/modules/sponsorshipPackage'
import * as staff from '@/store/modules/staff'
import * as ticket from '@/store/modules/ticket'
import * as ticketCounter from '@/store/modules/ticketCounter'

const store = createStore({
  modules: {
    admin,
    appearanceSettings,
    appUser,
    auth,
    checkin,
    checkout,
    counter,
    event,
    extras,
    footerSettings,
    form,
    headerSettings,
    homepage,
    layout,
    order,
    organization,
    organizerDashboardBanner,
    preferences,
    product,
    productOrder,
    promoCode,
    registration,
    sponsorship,
    sponsorshipPackage,
    ticket,
    ticketCounter,
    staff,
  },
  state: () => ({
    progress: null,
    routeInfo: {},
    snackbars: [],
  }),
  mutations: {
    setProgress (state, payload) {
      state.progress = payload
    },
    setRouteInfo (state, payload) {
      state.routeInfo = payload
    },
    addSnackbar (state, payload) {
      // payload: { text, color, timeout }
      const item = {
        text: payload?.text || '',
        color: payload?.color || 'info',
        timeout: Number.isFinite(payload?.timeout) ? payload.timeout : 4000,
      }
      state.snackbars = [...state.snackbars, item]
    },
    setSnackbars (state, payload) {
      // payload is full list used by v-snackbar-queue two-way binding
      state.snackbars = Array.isArray(payload) ? payload : []
    },
  },
  actions: {},
})

export default store
