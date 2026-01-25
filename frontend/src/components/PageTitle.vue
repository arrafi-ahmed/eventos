<script setup>
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'

  // Props
  const { title, subtitle, showBackButton, backRoute, compact, posTitle } = defineProps({
    title: {
      type: String,
      required: true,
    },
    subtitle: {
      type: String,
      default: '',
    },
    showBackButton: {
      type: Boolean,
      default: true,
    },
    backRoute: {
      type: [String, Object],
      default: null,
    },
    posTitle: {
      type: String,
      default: 'start',
    },
    compact: {
      type: Boolean,
      default: false,
    },
  })

  // Router
  const route = useRoute()
  const router = useRouter()
  const store = useStore()
  const { xs } = useDisplay()

  const fallbackHome = { name: 'homepage' }

  function getHomeRoute () {
    return store.getters['auth/calcHome'] || fallbackHome
  }

  function handleBack () {
    if (backRoute) {
      router.push(backRoute)
      return
    }
    router.push(getHomeRoute())
  }
</script>

<template>
  <v-row
    :class="compact ? 'page-title-wrapper-compact' : 'page-title-wrapper'"
    :justify="posTitle"
    no-gutters
  >
    <v-col
      class="d-flex align-center justify-space-between"
      :cols="posTitle==='center'?'auto':12"
    >
      <div
        :class="['d-flex align-center text-truncate', {'flex-grow-1 pr-4': posTitle !== 'center'}]"
      >
        <v-btn
          v-if="showBackButton"
          class="mr-2"
          density="comfortable"
          icon="mdi-arrow-left"
          variant="text"
          @click="handleBack"
        />
        <div class="text-truncate" :class="{ 'text-center': posTitle==='center' }">
          <div class="text-h5 text-md-h4 font-weight-bold text-truncate">{{ title }}</div>
          <div v-if="subtitle" class="text-body-2 text-medium-emphasis pt-1 text-truncate">{{ subtitle }}</div>
        </div>
      </div>

      <div v-if="$slots.actions" class="d-flex align-center flex-shrink-0">
        <!-- Dots Menu for Mobile -->
        <v-menu v-if="xs" location="bottom end" offset="8">
          <template #activator="{ props }">
            <v-btn v-bind="props" class="ml-2" icon="mdi-dots-vertical" variant="plain" />
          </template>
          <v-list class="premium-menu rounded-xl elevation-12" density="comfortable">
            <div class="pa-2 d-flex flex-column gap-2 mini-actions-slot">
              <slot name="actions" />
            </div>
          </v-list>
        </v-menu>

        <!-- Standard Layout for Desktop -->
        <div v-else class="actions-wrapper d-flex align-center">
          <slot name="actions" />
        </div>
      </div>
    </v-col>
  </v-row>
</template>

<style scoped>
.page-title-wrapper {
  margin-bottom: 24px;
}
.page-title-wrapper-compact {
  margin-bottom: 16px;
}

/* Premium Menu Styling */
.premium-menu {
  border: 1px solid rgba(var(--v-border-color), 0.1);
}

.mini-actions-slot :deep(.v-btn) {
  width: 100%;
  justify-content: flex-start;
}
</style>
