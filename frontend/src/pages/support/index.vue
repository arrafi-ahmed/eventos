<template>
  <v-container>
    <PageTitle
      :show-back-button="true"
      subtitle="Get help with your tickets, orders, and account"
      title="Support"
    />
    <v-row justify="center">
      <v-col cols="12" lg="8" md="10">
        <SupportBot />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import PageTitle from '@/components/PageTitle.vue'
  import SupportBot from '@/components/support/SupportBot.vue'
</script>
