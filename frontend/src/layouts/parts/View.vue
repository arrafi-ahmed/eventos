<script setup>
</script>
<template>
  <!--  <v-main class="bg-tertiary">-->
  <v-main>
    <div class="fill-height limit-max-width-xl limit-max-width-lg mx-auto">
      <router-view />
    </div>
  </v-main>
</template>
<style scoped>
.limit-max-width-lg {
  max-width: 1400px;
}
</style>
