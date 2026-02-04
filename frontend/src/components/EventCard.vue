<script setup>
  import { computed } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useUiProps } from '@/composables/useUiProps'
  import { formatEventDateDisplay } from '@/utils'

  const { rounded } = useUiProps()
  const { t, locale } = useI18n()

  const props = defineProps({
    event: {
      type: Object,
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  })

  // Reactive date display based on current locale
  const formattedDate = computed(() => {
    // Trigger reactivity when locale changes
    const currentLocale = locale.value
    return formatEventDateDisplay({
      event: {
        ...props.event,
        config: { ...props.event.config, showEndTime: false },
      },
    })
  })

  // Status mapping
  const statusMap = {
    'Today': 'home.event.status.today',
    'Tomorrow': 'home.event.status.tomorrow',
    'This Week': 'home.event.status.this_week',
    'Next Week': 'home.event.status.next_week',
    'Upcoming': 'home.event.status.upcoming',
    'Past': 'home.event.status.past',
  }

  const getStatusLabel = (status) => {
    const key = statusMap[status]
    return key ? t(key) : status
  }

  // Get badge color based on status
  function getBadgeColor (status) {
    switch (status) {
      case 'Today': {
        return 'error'
      }
      case 'Tomorrow': {
        return 'warning'
      }
      case 'This Week': {
        return 'info'
      }
      case 'Next Week': {
        return 'success'
      }
      case 'Upcoming': {
        return 'primary'
      }
      case 'Past': {
        return 'grey'
      }
      default: {
        return 'primary'
      }
    }
  }

  const emit = defineEmits(['click'])

  function handleClick () {
    emit('click', props.event)
  }

  // Computed UI handles the button
  const ui = computed(() => ({
    reserve_now: t('home.event.reserve_now'),
  }))
</script>

<template>
  <div
    class="event-card"
    :class="{ 'featured-glow': props.isFeatured || props.event.is_featured }"
    @click="handleClick"
  >
    <!-- Inset Accent Bar (Signature) -->
    <div
      class="event-accent-bar"
      :class="{ 'accent-featured': props.isFeatured || props.event.is_featured }"
    />

    <div class="event-image-wrapper">
      <v-img
        :alt="props.event.title"
        class="event-img"
        cover
        eager
        :src="props.event.banner"
      >
        <template #placeholder>
          <div class="d-flex align-center justify-center fill-height bg-surface-variant-light">
            <v-progress-circular color="primary" indeterminate />
          </div>
        </template>

        <!-- Glassmorphic Status Badge -->
        <div
          v-if="props.event.eventStatus"
          class="event-status-badge"
          :class="`badge-${getBadgeColor(props.event.eventStatus)}`"
        >
          {{ getStatusLabel(props.event.eventStatus) }}
        </div>
      </v-img>
    </div>

    <div class="event-content">
      <h3 class="event-title text-truncate-2">
        {{ props.event.title }}
      </h3>

      <div class="event-meta">
        <div class="meta-item">
          <v-icon color="primary" size="18">mdi-calendar-range</v-icon>
          <span class="meta-text">{{ formattedDate }}</span>
        </div>
        <div
          v-if="props.event.location && props.event.location.trim()"
          class="meta-item mt-1"
        >
          <v-icon color="primary" size="18">mdi-map-marker-outline</v-icon>
          <span class="meta-text text-truncate">{{ props.event.location }}</span>
        </div>
      </div>

      <p
        v-if="props.event.description && props.event.description !== 'null'"
        class="event-description text-truncate-3"
      >
        {{ props.event.description }}
      </p>

      <div class="card-footer mt-auto pt-4">
        <v-btn
          block
          class="font-weight-bold"
          color="primary"
          height="44"
          prepend-icon="mdi-ticket-confirmation-outline"
          rounded="xl"
          variant="tonal"
        >
          {{ ui.reserve_now }}
        </v-btn>
      </div>
    </div>
  </div>
</template>

<style scoped>
.event-card {
  position: relative;
  background: rgba(var(--v-theme-surface), 0.7) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(var(--v-theme-on-surface), 0.1);
  border-radius: 20px;
  overflow: hidden;
  height: 100%;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.event-card:hover {
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.1);
}

.featured-glow {
  box-shadow: 0 0 20px rgba(var(--v-theme-primary), 0.15);
  border-color: rgba(var(--v-theme-primary), 0.2);
}

/* Inset Accent Bar */
.event-accent-bar {
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 0;
  width: 4px;
  background: rgb(var(--v-theme-primary));
  opacity: 0.8;
  border-radius: 0 4px 4px 0;
  z-index: 5;
  transition: all 0.3s ease;
}

.accent-featured {
  background: rgb(var(--v-theme-warning)); /* Use theme warning for featured */
}

.event-image-wrapper {
  position: relative;
  height: 200px;
  overflow: hidden;
}

.event-img {
  width: 100%;
  height: 100%;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Status Badge - Glassmorphic */
.event-status-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 6px 14px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  z-index: 2;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.badge-error { background: rgba(var(--v-theme-error), 0.85); color: white; }
.badge-warning { background: rgba(var(--v-theme-warning), 0.85); color: white; }
.badge-info { background: rgba(var(--v-theme-info), 0.85); color: white; }
.badge-success { background: rgba(var(--v-theme-success), 0.85); color: white; }
.badge-primary { background: rgba(var(--v-theme-primary), 0.85); color: white; }
.badge-grey { background: rgba(var(--v-theme-grey), 0.85); color: white; }

.event-content {
  padding: 20px 20px 20px 24px; /* Extra left padding for accent bar */
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.event-title {
  font-size: 1.35rem;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 12px;
  color: rgb(var(--v-theme-on-surface));
  letter-spacing: -0.01em;
}

.event-meta {
  margin-bottom: 16px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.meta-text {
  font-size: 0.9rem;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.event-description {
  font-size: 0.9rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.text-truncate-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.bg-surface-variant-light {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

@media (max-width: 600px) {
  .event-image-wrapper {
    height: 180px;
  }
  .event-title {
    font-size: 1.2rem;
  }
}
</style>
