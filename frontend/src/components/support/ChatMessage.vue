<template>
  <div :class="['message', `message--${message.role}`]">
    <div class="message-content" :class="`message-content--${message.role}`">
      <div class="message-text" v-html="formatContent(message.content)" />
    </div>
    <div class="message-time">
      {{ formatTime(message.timestamp) }}
    </div>
  </div>
</template>

<script setup>
  import { useI18n } from 'vue-i18n'
 
  const { t } = useI18n()
 
  const props = defineProps({
    message: {
      type: Object,
      required: true,
    },
  })

  function formatTime (timestamp) {
    if (!timestamp) return ''
    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffMs = now - date
      const diffMins = Math.floor(diffMs / 60_000)
      const diffHours = Math.floor(diffMs / 3_600_000)
      const diffDays = Math.floor(diffMs / 86_400_000)

      // Show relative time for recent messages
      if (diffMins < 1) {
        return t('components.time.just_now')
      } else if (diffMins < 60) {
        return `${diffMins}${t('components.time.m_ago')}`
      } else if (diffHours < 24) {
        return `${diffHours}${t('components.time.h_ago')}`
      } else if (diffDays === 1) {
        return t('components.time.yesterday')
      } else if (diffDays < 7) {
        return `${diffDays}${t('components.time.d_ago')}`
      }

      // For older messages, show date and time
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()

      // If same year, show only date and time
      if (year === now.getFullYear()) {
        return `${day}/${month} ${hours}:${minutes}`
      }

      return `${day}/${month}/${year} ${hours}:${minutes}`
    } catch {
      return ''
    }
  }

  function formatContent (content) {
    if (!content) return ''

    // Convert **text** to <strong>text</strong>
    let formatted = content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>')

    return formatted
  }
</script>

<style scoped>
.message {
  margin-bottom: 0;
}

.message--user {
  text-align: right;
}

.message--assistant {
  text-align: left;
}

.message-content {
  display: inline-block;
  padding: 10px 14px;
  border-radius: 12px;
  max-width: 80%;
  word-wrap: break-word;
  line-height: 1.5;
}

.message-text :deep(strong) {
  font-weight: 600;
}

.message-content--user {
  background-color: rgb(var(--v-theme-primary));
  color: white;
  border-bottom-right-radius: 4px;
}

.message-content--assistant {
  background-color: rgb(var(--v-theme-surface-variant));
  color: rgb(var(--v-theme-on-surface-variant));
  border-bottom-left-radius: 4px;
}

.message-time {
  font-size: 0.7rem;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.6;
  margin-top: 4px;
  padding: 0 4px;
}
</style>
