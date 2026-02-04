<script setup>
  import { computed, ref } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useRoute } from 'vue-router'
  import { useStore } from 'vuex'

  const { t } = useI18n()

  definePage({
    name: 'not-found',
    meta: {
      layout: 'default',
      title: 'Page Not Found',
      titleKey: 'pages.not_found.title',
    },
  })

  const route = useRoute()
  const store = useStore()
  const status = ref(route.params.status || 404)
  const message = ref(route.params.message || t('common.not_found.message'))

  const ui = computed(() => ({
    go_home: t('common.not_found.go_home'),
  }))
</script>

<template>
  <v-container class="fill-height">
    <v-row
      align="center"
      justify="center"
    >
      <v-col
        class="bg page_404 text-center"
        cols="10"
      >
        <h1>{{ status }}</h1>
        <div>{{ message }}</div>
        <v-btn
          class="clickable"
          color="primary"
          size="small"
          to="/"
          variant="text"
        >
          {{ ui.go_home }}
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<style scoped>
.bg {
  background-image: url(https://cdn.dribbble.com/users/285475/screenshots/2083086/dribbble_1.gif);
  height: 450px;
  background-position: center;
}
</style>
