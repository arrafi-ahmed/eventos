<script setup>
  import { computed, ref, watch } from 'vue'
  import { useI18n } from 'vue-i18n'
  import { useUiProps } from '@/composables/useUiProps'
  import { getProductImageUrl } from '@/utils'

  const { t } = useI18n()

  const props = defineProps({
    product: {
      type: Object,
      required: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    showDescription: {
      type: Boolean,
      default: true,
    },
    showStock: {
      type: Boolean,
      default: true,
    },
    showSku: {
      type: Boolean,
      default: false,
    },
    showQuantitySelector: {
      type: Boolean,
      default: false,
    },
    showActions: {
      type: Boolean,
      default: false,
    },
    initialQuantity: {
      type: Number,
      default: 0,
    },
    onEdit: {
      type: Boolean,
      default: false,
    },
    onDelete: {
      type: Boolean,
      default: false,
    },
    onRemove: {
      type: Boolean,
      default: false,
    },
    maxDescriptionLength: {
      type: Number,
      default: 100,
    },
    showInEvent: {
      type: Boolean,
      default: false,
    },
    useCartLogic: {
      type: Boolean,
      default: false,
    },
  })

  const emit = defineEmits(['edit', 'delete', 'remove', 'quantity-change'])

  const { rounded, size, density, variant } = useUiProps()

  // Computed UI Pattern
  const ui = computed(() => ({
    out_of_stock: t('shop.product.out_of_stock'),
    only_left: (count) => t('shop.product.only_left', { count }),
    in_stock: t('shop.product.in_stock'),
    featured: t('shop.product.featured'),
    in_event: t('shop.product.in_event'),
    available: (count) => t('shop.product.available', { count }),
    add_to_cart: t('shop.product.add_to_cart'),
    edit: t('shop.product.edit'),
    delete: t('shop.product.delete'),
    remove: t('shop.product.remove'),
  }))

  // Local quantity state
  const quantity = ref(props.initialQuantity)

  // Watch for external quantity changes
  watch(() => props.initialQuantity, newVal => {
    quantity.value = newVal
  })

  // Emit quantity changes
  watch(quantity, newVal => {
    emit('quantity-change', {
      product: props.product,
      quantity: newVal,
    })
  })

  // Product image
  const productImage = computed(() => {
    return getProductImageUrl(props.product.image)
  })

  // Formatted price (convert cents to dollars)
  const formattedPrice = computed(() => {
    return (props.product.price / 100).toFixed(2)
  })

  // Truncated description
  const truncatedDescription = computed(() => {
    if (!props.product.description) return ''
    if (props.product.description.length <= props.maxDescriptionLength) {
      return props.product.description
    }
    return props.product.description.slice(0, Math.max(0, props.maxDescriptionLength)) + '...'
  })

  // Stock status
  const stockColor = computed(() => {
    if (props.product.stock === 0) return 'error'
    if (props.product.stock < 10) return 'warning'
    return 'success'
  })

  const stockText = computed(() => {
    if (props.product.stock === 0) return ui.value.out_of_stock
    if (props.product.stock < 10) return ui.value.only_left(props.product.stock)
    return ui.value.in_stock
  })

  // Quantity controls
  function incrementQuantity () {
    if (quantity.value < props.product.stock) {
      quantity.value++
    }
  }

  function decrementQuantity () {
    if (quantity.value > 0) {
      quantity.value--
    }
  }

  function handleQuantityInput (event) {
    const value = Number.parseInt(event.target.value) || 0
    quantity.value = Math.max(0, Math.min(value, props.product.stock))
  }
</script>

<template>
  <v-card
    class="product-card"
    :class="{ 'featured': isFeatured }"
    elevation="4"
    rounded="xl"
  >
    <!-- Vertical Accent Bar -->
    <div
      class="product-accent-bar"
      :class="{
        'accent-featured': isFeatured && !showInEvent,
        'accent-in-event': showInEvent
      }"
    />

    <!-- Product Image -->
    <div class="product-image-wrapper">
      <v-img
        v-if="productImage"
        :alt="product.name"
        class="product-image"
        cover
        height="200"
        :src="productImage"
      />
      <div
        v-else
        class="product-image-placeholder"
      >
        <v-icon
          color="grey-lighten-1"
          size="64"
        >
          mdi-package-variant
        </v-icon>

      </div>

      <!-- Stock Badge -->
      <v-chip
        v-if="showStock"
        class="stock-badge"
        :color="stockColor"
        size="small"
        variant="flat"
      >
        {{ stockText }}
      </v-chip>

      <!-- Featured Badge (shown only if not showing in-event badge) -->
      <v-chip
        v-if="isFeatured && !showInEvent"
        class="featured-badge"
        color="warning"
        size="small"
        variant="flat"
      >
        <v-icon start>mdi-star</v-icon>
        {{ ui.featured }}
      </v-chip>

      <!-- In Event Badge -->
      <v-chip
        v-if="showInEvent"
        class="in-event-badge"
        color="success"
        size="small"
        variant="flat"
      >
        <v-icon start>mdi-check</v-icon>
        {{ ui.in_event }}
      </v-chip>
    </div>

    <!-- Product Info -->
    <div class="product-info">
      <!-- Product Name -->
      <h3 class="product-name">
        {{ product.name }}
      </h3>

      <!-- Product Description -->
      <p
        v-if="showDescription && product.description"
        class="product-description"
      >
        {{ truncatedDescription }}
      </p>

      <!-- Product Price and Stock -->
      <div class="d-flex justify-space-between align-end mb-2 flex-wrap gap-2">
        <div class="product-price">
          <span class="currency">$</span>
          <span class="amount">{{ formattedPrice }}</span>
        </div>

        <div v-if="showStock" class="product-stock-status mb-2">
          <v-icon class="mr-1" :color="stockColor" size="16">
            {{ product.stock > 0 ? 'mdi-check-circle' : 'mdi-close-circle' }}
          </v-icon>
          <span class="text-caption font-weight-bold text-uppercase letter-spacing-1">
            {{ ui.available(product.stock || 0) }}
          </span>
        </div>
      </div>

      <!-- Product SKU -->
      <div
        v-if="showSku && product.sku"
        class="product-sku"
      >
        SKU: {{ product.sku }}
      </div>
    </div>

    <!-- Quantity Selector / Dynamic Add to Cart -->
    <div
      v-if="showQuantitySelector"
      class="product-actions-modern mt-4"
    >
      <!-- Dynamic Swap: Single button that transforms into +/- control -->
      <v-btn
        v-if="useCartLogic && quantity === 0"
        block
        class="font-weight-bold"
        color="primary"
        elevation="0"
        height="48"
        prepend-icon="mdi-cart-plus"
        rounded="xl"
        @click="incrementQuantity"
      >
        {{ ui.add_to_cart }}
      </v-btn>

      <div
        v-else
        class="d-flex align-center justify-center gap-4 pa-2 bg-surface-variant-light rounded-xl"
        style="height: 48px;"
      >
        <v-btn
          density="comfortable"
          :disabled="quantity <= 0"
          icon="mdi-minus"
          rounded="lg"
          size="small"
          variant="tonal"
          @click="decrementQuantity"
        />

        <div class="quantity-display-modern">
          {{ quantity }}
        </div>

        <v-btn
          density="comfortable"
          :disabled="quantity >= product.stock"
          icon="mdi-plus"
          rounded="lg"
          size="small"
          variant="tonal"
          @click="incrementQuantity"
        />
      </div>
    </div>

    <!-- Admin Actions -->
    <div
      v-if="showActions && (onEdit || onDelete || onRemove)"
      class="admin-actions"
    >
      <v-btn
        v-if="onEdit"
        class="mr-2"
        color="primary"
        density="comfortable"
        prepend-icon="mdi-pencil"
        rounded="rounded"
        style="min-width: 0;"
        variant="tonal"
        @click="emit('edit', product)"
      >
        {{ ui.edit }}
      </v-btn>

      <v-btn
        v-if="onDelete"
        class="mr-2"
        color="error"
        density="comfortable"
        prepend-icon="mdi-delete"
        rounded="rounded"
        style="min-width: 0;"
        variant="tonal"
        @click="emit('delete', product)"
      >
        {{ ui.delete }}
      </v-btn>

      <v-btn
        v-if="onRemove"
        color="error"
        density="comfortable"
        prepend-icon="mdi-close"
        rounded="rounded"
        style="min-width: 0;"
        variant="tonal"
        @click="emit('remove', product)"
      >
        {{ ui.remove }}
      </v-btn>
    </div>

    <!-- Extra Actions Slot -->
    <div
      v-if="$slots['extra-actions']"
      class="extra-actions"
    >
      <slot name="extra-actions" />
    </div>
  </v-card>
</template>

<style scoped>
.product-card {
  position: relative;
  background: rgba(var(--v-theme-surface), 0.7) !important;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding-bottom: 20px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.product-card:hover {
  transform: translateY(-4px);
  border-color: rgba(var(--v-theme-primary), 0.3);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.4);
}

.product-card.featured {
  border: 1px solid rgba(255, 211, 0, 0.3);
  box-shadow: 0 0 20px rgba(255, 211, 0, 0.15);
}

.product-card.featured::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: radial-gradient(circle at top right, rgba(255, 211, 0, 0.1), transparent 70%);
  pointer-events: none;
}

.product-image-wrapper {
  position: relative;
  overflow: hidden;
}

.product-image {
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.product-card:hover .product-image {
  transform: scale(1.08);
}

.product-image-placeholder {
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(var(--v-theme-surfaceVariant), 0.5), rgba(var(--v-theme-surface), 0.2));
}

.stock-badge {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
  backdrop-filter: blur(4px);
  font-weight: 600;
  letter-spacing: 0.5px;
}

.featured-badge {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
  font-weight: 700;
}

.in-event-badge {
  position: absolute;
  bottom: 12px;
  right: 12px;
  z-index: 2;
  backdrop-filter: blur(4px);
}

.product-info {
  padding: 20px 20px 0;
}

.product-name {
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 6px;
  color: rgb(var(--v-theme-on-surface));
  line-height: 1.2;
  letter-spacing: -0.01em;
}

.product-description {
  font-size: 0.9rem;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin-bottom: 16px;
  line-height: 1.6;
}

.product-price {
  display: flex;
  align-items: baseline;
  /* margin-bottom: 8px; Removed as it's now part of a flex container */
}

.product-price .currency {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgb(var(--v-theme-primary));
  margin-right: 2px;
}

.product-price .amount {
  font-size: 1.75rem;
  font-weight: 800;
  color: rgb(var(--v-theme-primary));
  letter-spacing: -0.02em;
}

.product-sku {
  font-size: 0.7rem;
  color: rgba(var(--v-theme-on-surface), 0.4);
  font-family: inherit;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.product-accent-bar {
  position: absolute;
  top: 16px;
  bottom: 16px;
  left: 0;
  width: 4px;
  background: rgb(var(--v-theme-primary));
  opacity: 0.8;
  border-radius: 0 4px 4px 0;
  z-index: 5;
  transition: background 0.3s ease;
}

.product-accent-bar.accent-featured {
  background: rgb(var(--v-theme-warning));
}

.product-accent-bar.accent-in-event {
  background: rgb(var(--v-theme-success));
}

.product-actions-modern {
  padding: 0 20px;
}

.bg-surface-variant-light {
  background: rgba(var(--v-theme-on-surface), 0.05);
}

.quantity-display-modern {
  font-size: 1.25rem;
  font-weight: 800;
  min-width: 32px;
  text-align: center;
  color: rgb(var(--v-theme-primary));
}

.product-stock-status {
  padding: 4px 8px;
  background: rgba(var(--v-theme-surfaceVariant), 0.3);
  border-radius: 6px;
  display: flex;
}

.letter-spacing-1 {
  letter-spacing: 1px;
}

.admin-actions {
  padding: 20px 20px 0;
  display: flex;
  gap: 12px;
}

.admin-actions .v-btn {
  flex: 1;
  text-transform: none;
  font-weight: 600;
  letter-spacing: 0;
}

.extra-actions {
  padding: 16px 20px 0;
  display: flex;
}

.extra-actions .v-btn {
  flex: 1;
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0;
}
.gap-2 {
  gap: 8px;
}
</style>
