<script setup>
  import { computed } from 'vue'
  import { useDisplay } from 'vuetify'
  import { appInfo } from '@/utils'

  const { xs } = useDisplay()
  const { imgSrc, title, imgClass, containerClass, maxWidth, width } = defineProps({
    imgSrc: {
      type: String,
      default: null,
    },
    title: {
      type: Boolean,
      default: false,
    },
    imgClass: {
      type: String,
      default: '',
    },
    containerClass: {
      type: String,
      default: '',
    },
    maxWidth: {
      type: [String, Number],
      default: null,
    },
    width: {
      type: [String, Number],
      default: null,
    },
  })

  // Show text if no image is provided or title is explicitly true
  const showText = computed(() => !imgSrc || title)

  const emit = defineEmits(['click'])

  function handleClick () {
    emit('click')
  }
</script>

<template>
  <div
    :class="`d-flex align-center ${containerClass}`"
    @click="handleClick"
  >
    <!--    {{imgSrc}}-->
    <v-img
      v-if="imgSrc"
      :class="` ${imgClass}`"
      :max-width="maxWidth"
      :src="imgSrc"
      :width="width"
    />

    <div
      v-if="showText"
      :class="imgSrc ? 'pl-2' : ''"
    >
      <component :is="xs ? 'h3' : 'h2'">
        <span class="logo-text">{{ appInfo.name }}</span>
      </component>
    </div>
  </div>
</template>

<style scoped>
.logo-text {
  color: rgb(var(--v-theme-secondary)) !important;
  font-weight: var(--font-weight-semibold);
  transition: all 0.3s ease;
}

div.d-flex.align-center {
  transition: transform 0.3s ease;
}

div.d-flex.align-center:hover {
  transform: translateY(-1px);
}

div.d-flex.align-center:hover .logo-text {
  color: rgb(var(--v-theme-primary)) !important;
}
</style>
