import { computed } from 'vue'
import { useDisplay } from 'vuetify'
import { useStore } from 'vuex'

export function useUiProps() {
  const store = useStore()
  const { mdAndUp } = useDisplay()

  const currentUser = computed(() => store.state.auth.currentUser)

  const rounded = computed(() => (mdAndUp.value ? 'xl' : 'lg'))
  const size = computed(() => (mdAndUp.value ? 'large' : 'default'))
  const density = computed(() => (mdAndUp.value ? 'default' : 'comfortable'))
  const variant = computed(() => (currentUser.value?.defaultTheme === 'light' ? 'solo' : 'outlined'))
  return { rounded, size, variant, density }
}
