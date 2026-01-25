import { apiCall } from '@/utils'

const STORAGE_KEY = 'ticketi-theme'
const DEFAULT_THEME = 'dark'

export const namespaced = true

export function state () {
  return {
    theme: localStorage.getItem(STORAGE_KEY) || DEFAULT_THEME,
  }
}

export const getters = {
  currentTheme: state => state.theme || DEFAULT_THEME,
}

export const mutations = {
  setTheme (state, payload) {
    const theme = payload || DEFAULT_THEME
    state.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  },
  clearTheme (state) {
    state.theme = DEFAULT_THEME
    localStorage.removeItem(STORAGE_KEY)
  },
}

export const actions = {
  async initializeTheme ({ dispatch, rootGetters }) {
    const isSignedIn = rootGetters['auth/signedin']
    if (isSignedIn) {
      try {
        await dispatch('syncThemeFromServer')
        return
      } catch {
        // ignore and fall back to local storage
      }
    }
  },
  async syncThemeFromServer ({ commit }) {
    const response = await apiCall.get('/user-settings/me')
    const theme = response.data?.payload?.theme || DEFAULT_THEME
    commit('setTheme', theme)
    return theme
  },
  async saveTheme ({ commit, rootGetters }, theme) {
    const normalized = theme === 'light' ? 'light' : 'dark'
    commit('setTheme', normalized)
    if (rootGetters['auth/signedin']) {
      await apiCall.put('/user-settings/theme', { theme: normalized })
    }
  },
  resetTheme ({ commit }) {
    commit('clearTheme')
  },
}
