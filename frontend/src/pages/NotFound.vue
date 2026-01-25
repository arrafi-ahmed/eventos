<script setup>
  import { ref } from 'vue'

  import { useRoute } from 'vue-router'
  import { useStore } from 'vuex'

  definePage({
    name: 'not-found',
    meta: {
      layout: 'default',
      title: 'Not Found',
    },
  })

  const route = useRoute()
  const store = useStore()
  const status = ref(route.params.status || 404)
  const message = ref(route.params.message || 'Looks like you\'re lost!')
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
          Go Home
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
