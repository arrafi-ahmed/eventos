<script setup>

  import { useStore } from 'vuex'

  definePage({
    name: 'signout',
    meta: {
      layout: 'default',
      title: 'Signout',
      requiresAuth: true,
    },
  })

  const store = useStore()
  store
    .dispatch('auth/signout')
    .then(res => {
      store.commit('addSnackbar', { text: 'Signout successful!', color: 'success' })
      window.location.href = '/auth/signin'
    })
    .catch(error => {})
</script>
