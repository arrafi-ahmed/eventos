import { createStore } from 'vuex'

import * as admin from '@/store/modules/admin'
import * as appUser from '@/store/modules/appUser'
import * as auth from '@/store/modules/auth'
import * as checkin from '@/store/modules/checkin'
import * as checkout from '@/store/modules/checkout'
import * as counter from '@/store/modules/counter'
import * as event from '@/store/modules/event'
import * as form from '@/store/modules/form'
import * as organization from '@/store/modules/organization'
import * as preferences from '@/store/modules/preferences'
import * as registration from '@/store/modules/registration'
import * as layout from '@/store/modules/layout'
import * as staff from '@/store/modules/staff'
import * as ticket from '@/store/modules/ticket'
import * as ticketCounter from '@/store/modules/ticketCounter'
import * as systemSettings from './modules/systemSettings'
import * as homepage from './modules/homepage'
import * as order from './modules/order'
import * as product from './modules/product'
import * as productOrder from './modules/productOrder'
import * as promoCode from './modules/promoCode'


const store = createStore({
  modules: {
    admin,
    appUser,
    auth,
    checkin,
    counter,
    event,
    form,
    organization,
    registration,
    ticket,
    ticketCounter,
    staff,
    checkout,
    layout,
    systemSettings,
    homepage,
    preferences,
    order,
    product,
    productOrder,
    promoCode,
  },
  state: () => ({
    progress: null,
    routeInfo: {},
    snackbars: [],
  }),
  mutations: {
    setProgress(state, payload) {
      state.progress = payload
    },
    setRouteInfo(state, payload) {
      state.routeInfo = payload
    },
    addSnackbar(state, payload) {
      // payload: { text, color, timeout }
      const item = {
        text: payload?.text || '',
        color: payload?.color || 'info',
        timeout: Number.isFinite(payload?.timeout) ? payload.timeout : 4000,
      }
      state.snackbars = [...state.snackbars, item]
    },
    setSnackbars(state, payload) {
      // payload is full list used by v-snackbar-queue two-way binding
      state.snackbars = Array.isArray(payload) ? payload : []
    },
  },
  actions: {},
})

export default store
