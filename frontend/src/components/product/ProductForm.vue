<script setup>
  import { computed, onMounted, ref, watch } from 'vue'
  import { useStore } from 'vuex'
  import ImageManager from '@/components/ImageManager.vue'
  import { useUiProps } from '@/composables/useUiProps'
  import { getApiPublicImageUrl, getCurrencySymbol } from '@/utils'

  const props = defineProps({
    product: {
      type: Object,
      default: null,
    },
    loading: {
      type: Boolean,
      default: false,
    },
    currency: {
      type: String,
      default: 'USD',
    },
  })

  const emit = defineEmits(['submit', 'cancel', 'image-delete'])

  const { rounded, size, variant, density } = useUiProps()

  const formRef = ref(null)
  const formValid = ref(false)

  const formData = ref({
    name: '',
    description: '',
    price: 0,
    stock: 0,
    sku: '',
    imageFile: null,
    isActive: true,
    removeImage: false, // Flag to indicate image should be removed
  })

  const imagePreview = ref(null)

  // Computed property for existing image URL
  const existingImageUrl = computed(() => {
    if (props.product?.image) {
      return getApiPublicImageUrl(props.product.image, 'product-image')
    }
    return null
  })

  // Form validation rules
  const rules = {
    required: value => !!value || 'This field is required',
    priceMin: value => value >= 0 || 'Price must be 0 or greater',
    stockMin: value => value >= 0 || 'Stock must be 0 or greater',
  }

  const isEdit = computed(() => !!props.product)

  // Initialize form with product data if editing
  onMounted(() => {
    if (props.product) {
      formData.value = {
        name: props.product.name || '',
        description: props.product.description || '',
        price: props.product.price ? (props.product.price / 100) : 0, // Convert cents to dollars
        stock: props.product.stock || 0,
        sku: props.product.sku || '',
        imageFile: null,
        isActive: props.product.is_active === undefined ? true : props.product.is_active,
      }

      // Set existing image preview
      if (props.product.image) {
        imagePreview.value = getApiPublicImageUrl(props.product.image, 'product-image')
      }
    }
  })

  // Watch for product prop changes
  watch(() => props.product, newProduct => {
    if (newProduct) {
      formData.value = {
        name: newProduct.name || '',
        description: newProduct.description || '',
        price: newProduct.price ? (newProduct.price / 100) : 0,
        stock: newProduct.stock || 0,
        sku: newProduct.sku || '',
        imageFile: null,
        isActive: newProduct.is_active === undefined ? true : newProduct.is_active,
      }

      if (newProduct.image) {
        imagePreview.value = getApiPublicImageUrl(newProduct.image, 'product-image')
      }
    }
  })

  function handleImageChange (file) {
    // v-file-upload passes the file directly
    if (file) {
      const reader = new FileReader()
      reader.addEventListener('load', e => {
        imagePreview.value = e.target.result
      })
      reader.readAsDataURL(file)
    }
  }

  function handleImageDelete () {
    // Set flag to remove image
    formData.value.removeImage = true
    // This will be handled by the parent component
    // We can emit an event to indicate the image should be removed
    emit('image-delete')
  }

  function clearImage () {
    formData.value.imageFile = null
    imagePreview.value = null
  }

  const store = useStore()
  const currentUser = computed(() => store.state.auth.currentUser)

  function handleSubmit () {
    if (!formValid.value) return

    // Prepare FormData for submission
    const submitData = new FormData()
    submitData.append('organizationId', currentUser.value?.organizationId)
    submitData.append('name', formData.value.name)
    submitData.append('description', formData.value.description || '')
    submitData.append('price', Math.round((formData.value.price || 0) * 100)) // Convert dollars to cents
    submitData.append('stock', formData.value.stock)
    submitData.append('sku', formData.value.sku || '')

    if (isEdit.value) {
      submitData.append('productId', props.product.id)
      submitData.append('isActive', formData.value.isActive)

      // Handle image removal
      if (formData.value.removeImage) {
        submitData.append('removeImage', 'true')
      }
    }

    if (formData.value.imageFile) {
      submitData.append('files', formData.value.imageFile)
    }

    emit('submit', submitData)
  }

  function handleCancel () {
    emit('cancel')
  }

  // Expose reset method
  defineExpose({
    reset: () => {
      formRef.value?.reset()
      imagePreview.value = null
    },
  })
</script>

<template>
  <v-form
    ref="formRef"
    v-model="formValid"
    @submit.prevent="handleSubmit"
  >
    <v-card
      elevation="4"
    >
      <v-card-title>
        {{ isEdit ? 'Edit Product' : 'Create New Product' }}
      </v-card-title>

      <v-card-text class="scrollable-content">
        <!-- Product Name -->
        <v-text-field
          v-model="formData.name"
          class="mt-2 mt-md-4"
          :density="density"
          hide-details="auto"
          label="Product Name *"
          placeholder="e.g. Official Event T-Shirt"
          prepend-inner-icon="mdi-tag"
          required
          :rounded="rounded"
          :rules="[rules.required]"
          :variant="variant"
        />

        <!-- Description -->
        <v-textarea
          v-model="formData.description"
          class="mt-2 mt-md-4"
          :density="density"
          hide-details="auto"
          label="Description"
          placeholder="Describe your product..."
          prepend-inner-icon="mdi-text"
          :rounded="rounded"
          rows="3"
          :variant="variant"
        />

        <!-- Price and Stock Row -->
        <v-row class="mt-2">
          <v-col
            cols="12"
            md="6"
          >
            <v-text-field
              v-model.number="formData.price"
              :density="density"
              hide-details="auto"
              hint="Price (0 = free product)"
              :label="`Price (${getCurrencySymbol({ code: currency, type: 'symbol' })})`"
              min="0"
              persistent-hint
              :prefix="getCurrencySymbol({ code: currency, type: 'symbol' })"
              :rounded="rounded"
              :rules="[rules.priceMin]"
              step="0.01"
              type="number"
              :variant="variant"
            />
          </v-col>

          <v-col
            cols="12"
            md="6"
          >
            <v-text-field
              v-model.number="formData.stock"
              :density="density"
              hide-details="auto"
              label="Stock Quantity *"
              min="0"
              prepend-inner-icon="mdi-package-variant-closed"
              required
              :rounded="rounded"
              :rules="[rules.required, rules.stockMin]"
              type="number"
              :variant="variant"
            />
          </v-col>
        </v-row>

        <!-- SKU and Active Status Row -->
        <v-row class="mt-2">
          <v-col
            cols="12"
            md="8"
          >
            <v-text-field
              v-model="formData.sku"
              :density="density"
              hide-details="auto"
              label="SKU (Optional)"
              placeholder="e.g. TSHIRT-XL-BLK"
              prepend-inner-icon="mdi-barcode"
              :rounded="rounded"
              :variant="variant"
            />
          </v-col>

          <v-col
            v-if="isEdit"
            cols="12"
            md="4"
          >
            <v-switch
              v-model="formData.isActive"
              color="success"
              :density="density"
              hide-details="auto"
              inset
              label="Active"
              :rounded="rounded"
              :variant="variant"
            />
          </v-col>
        </v-row>

        <!-- Image Upload -->
        <div class="image-upload-section">
          <!-- Existing Image Display -->
          <ImageManager
            v-if="existingImageUrl && !formData.imageFile"
            :src="existingImageUrl"
            @delete="handleImageDelete"
          />

          <!-- File Upload -->
          <v-file-upload
            v-model="formData.imageFile"
            accept="image/*"
            class="mt-4"
            clearable
            density="compact"
            hide-details="auto"
            :rounded="rounded"
            show-size
            title="Product Image (Optional)"
            :variant="variant"
            @update:model-value="handleImageChange"
          />
        </div>
      </v-card-text>

      <v-card-actions class="form-actions">
        <v-btn
          :rounded="rounded"
          :size="size"
          variant="text"
          @click="handleCancel"
        >
          Cancel
        </v-btn>
        <v-spacer />
        <v-btn
          color="primary"
          :disabled="!formValid"
          :loading="loading"
          :rounded="rounded"
          :size="size"
          type="submit"
        >
          <v-icon start>
            mdi-check
          </v-icon>
          {{ isEdit ? 'Update Product' : 'Create Product' }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-form>
</template>

<style scoped>
</style>
