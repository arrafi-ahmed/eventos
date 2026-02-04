<template>
  <v-container>
    <PageTitle
      :show-back-button="true"
      :subtitle="t('pages.support.subtitle')"
      :title="t('pages.support.title')"
      :title-key="'pages.support.title'"
    />
    <v-row justify="center">
      <v-col cols="12" lg="8" md="10">
        <SupportBot />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup>
  import { useI18n } from 'vue-i18n'
  import PageTitle from '@/components/PageTitle.vue'
  import SupportBot from '@/components/support/SupportBot.vue'

  definePage({
    name: 'support',
    meta: {
      layout: 'default',
      title: 'Support Center',
      titleKey: 'pages.support.title',
    },
  })

  const { t } = useI18n()
</script>
