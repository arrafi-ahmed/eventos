<script setup>
  import { ref } from 'vue'
  import { getEventImageUrl } from '@/util'

  const { imgSet, openingIndex, imgSrc, aspectRatio } = defineProps([
    'imgSet',
    'openingIndex',
    'imgSrc',
    'aspectRatio',
  ])
  const dialog = ref(false)
  const fullSize = ref(false)
  const currIndex = ref(openingIndex)
  const currImg = ref(imgSrc)

  function switchDialog () {
    // if imgSet is set, prev/next button enabled
    if (imgSet) {
      currIndex.value = openingIndex
      currImg.value = imgSet[currIndex.value]
    } else {
      currImg.value = imgSrc
    }

    fullSize.value = false
    dialog.value = !dialog.value
  }

  function switchFullsize () {
    fullSize.value = !fullSize.value
  }

  function getPrevImage () {
    if (currIndex.value === 0) return
    currIndex.value = currIndex.value - 1
    currImg.value = imgSet[currIndex.value]
  }

  function getNextImage () {
    if (currIndex.value === imgSet.length - 1) return
    currIndex.value = currIndex.value + 1
    currImg.value = imgSet[currIndex.value]
  }
</script>

<template>
  <v-img
    :aspect-ratio="aspectRatio || 1.7"
    class="clickable"
    cover
    :src="getEventImageUrl(imgSrc || null)"
    @click="switchDialog"
  />

  <v-dialog
    v-model="dialog"
    :max-width="!fullSize ? '100vh' : undefined"
  >
    <v-card class="position-relative">
      <v-btn
        :block="false"
        class="rounded-sm z-index-max"
        color="primary"
        icon="mdi-close"
        location="top end"
        :max-width="20"
        position="absolute"
        size="sm"
        @click="dialog = !dialog"
      />
      <v-img
        :contain="!fullSize"
        :max-height="!fullSize ? '85vh' : undefined"
        :src="getEventImageUrl(currImg || null)"
        @click="switchFullsize"
      >
        <v-row
          v-if="imgSet"
          align="center"
          class="fill-height ma-0"
          justify="space-between"
        >
          <v-col
            class="d-flex justify-center"
            cols="auto"
          >
            <v-icon
              v-if="currIndex > 0"
              class="cursor-pointer"
              color="grey"
              size="x-large"
              @click.stop="getPrevImage"
            >
              mdi-chevron-left-circle
            </v-icon>
          </v-col>
          <v-col
            class="d-flex justify-center"
            cols="auto"
          >
            <v-icon
              v-if="currIndex < imgSet.length - 1"
              class="cursor-pointer"
              color="grey"
              size="x-large"
              @click.stop="getNextImage"
            >
              mdi-chevron-right-circle
            </v-icon>
          </v-col>
        </v-row>
      </v-img>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.right-0 {
  right: 0 !important;
}

.top-0 {
  top: 0 !important;
}
</style>
