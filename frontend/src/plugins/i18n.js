import { createI18n } from 'vue-i18n'
import { en as vuetifyEn, fr as vuetifyFr } from 'vuetify/locale'

// Get saved locale or default to browser language or 'en'
const savedLocale = localStorage.getItem('user-locale') ||
    (navigator.language.startsWith('fr') ? 'fr' : 'en')

// Helper to load and merge modular locale files
const loadLocales = () => {
    const messages = { en: {}, fr: {} }
    const files = import.meta.glob('../locales/**/*.json', { eager: true })

    for (const path in files) {
        const matched = path.match(/\.\.\/locales\/(en|fr)\/(.*)\.json$/)
        if (matched) {
            const locale = matched[1]
            const name = matched[2]
            // Support nested keys or just merge directly
            // Here we merge everything into the root or by module name
            // If the file is common.json, we might want it in root, but safer to keep modules
            messages[locale][name] = files[path].default
        }
    }

    // Legacy support for root en.json/fr.json if they still exist (we'll remove them soon)
    if (files['../locales/en.json']) Object.assign(messages.en, files['../locales/en.json'].default)
    if (files['../locales/fr.json']) Object.assign(messages.fr, files['../locales/fr.json'].default)

    // Merge Vuetify translations
    messages.en.$vuetify = vuetifyEn
    messages.fr.$vuetify = vuetifyFr

    return messages
}

const i18n = createI18n({
    legacy: false, // Use Composition API
    locale: savedLocale,
    fallbackLocale: 'en',
    messages: loadLocales(),
    globalInjection: true,
})

export default i18n
