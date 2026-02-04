import $axios from '@/plugins/axios'

export const namespaced = true

export const state = {
    settings: {
        localization: { defaultCurrency: 'USD', defaultLanguage: 'en' },
        appearance: { defaultTheme: 'dark' },
        header: {},
        footer: {},
        organizer_dashboard_banner: {}
    }
}

export const mutations = {
    setSettings(state, payload) {
        state.settings = { ...state.settings, ...payload }
    },
    updateSection(state, { section, data }) {
        state.settings[section] = data
    }
}

export const actions = {
    async fetchSettings({ commit }) {
        try {
            const response = await $axios.get('/system-settings')
            if (response.data.success) {
                commit('setSettings', response.data.payload)
            }
        } catch (error) {
            console.error('Error fetching system settings:', error)
        }
    },
    async updateSettings({ commit }, { section, data }) {
        try {
            const response = await $axios.put(`/system-settings/${section}`, data)
            if (response.data.success) {
                // The backend returns the full system_settings object row, so we take the section from it
                // OR checks if your backend returns just that section?
                // Let's check backend service: returns `result.rows[0]` which is the full row.
                // So we need to grab the section from the result.
                // The backend returns the full system_settings object row in the payload
                const updatedRow = response.data.payload
                commit('updateSection', { section, data: updatedRow[section] })
                return updatedRow[section]
            }
        } catch (error) {
            console.error(`Error updating ${section} settings:`, error)
            throw error
        }
    }
}

export const getters = {
    localization: state => state.settings.localization,
    appearance: state => state.settings.appearance,
    header: state => state.settings.header,
    footer: state => state.settings.footer,
    organizerDashboardBanner: state => state.settings.organizer_dashboard_banner
}

export default {
    namespaced: true,
    state,
    mutations,
    actions,
    getters
}
