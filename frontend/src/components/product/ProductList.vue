<script setup>
  import { computed, ref, watch } from 'vue'
  import { VueDraggable } from 'vue-draggable-plus'
  import ProductCard from './ProductCard.vue'

  const props = defineProps({
    products: {
      type: Array,
      default: () => [],
    },
    title: {
      type: String,
      default: 'Products',
    },
    subtitle: {
      type: String,
      default: '',
    },
    loading: {
      type: Boolean,
      default: false,
    },
    emptyMessage: {
      type: String,
      default: 'No products found',
    },
    emptySubtext: {
      type: String,
      default: '',
    },
    showCreateButton: {
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
    showActions: {
      type: Boolean,
      default: false,
    },
    showStats: {
      type: Boolean,
      default: false,
    },
    enableDragSort: {
      type: Boolean,
      default: false,
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
  })

  const emit = defineEmits(['create', 'edit', 'delete', 'remove', 'reorder'])

  // Local sorted products for drag & drop
  const sortedProducts = ref([...props.products])

  // Watch for products prop changes
  watch(() => props.products, newProducts => {
    sortedProducts.value = [...newProducts]
  }, { deep: true })

  // Calculate total value
  const totalValue = computed(() => {
    if (!props.products || props.products.length === 0) return 0
    return props.products.reduce((sum, product) => {
      return sum + ((product.price || 0) / 100) * (product.stock || 0)
    }, 0)
  })

  // Handle drag end
  function handleDragEnd () {
    // Emit new order
    const productOrders = sortedProducts.value.map((product, index) => ({
      productId: product.id,
      displayOrder: index,
    }))

    emit('reorder', productOrders)
  }
</script>

<template>
  <div class="product-list">
    <!-- Header -->
    <div class="list-header">
      <h2 class="list-title">
        <v-icon
          color="secondary"
          size="large"
          start
        >
          mdi-store
        </v-icon>
        {{ title }}
      </h2>
      <p
        v-if="subtitle"
        class="list-subtitle"
      >
        {{ subtitle }}
      </p>
    </div>

    <!-- Loading State -->
    <div
      v-if="loading"
      class="loading-container"
    >
      <v-progress-circular
        color="secondary"
        indeterminate
        size="64"
      />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!products || products.length === 0"
      class="empty-state"
    >
      <v-icon
        color="surface-variant"
        size="80"
      >
        mdi-package-variant-closed
      </v-icon>
      <h3>{{ emptyMessage }}</h3>
      <p v-if="emptySubtext">
        {{ emptySubtext }}
      </p>
      <v-btn
        v-if="showCreateButton"
        class="mt-4"
        color="primary"
        @click="$emit('create')"
      >
        <v-icon start>
          mdi-plus
        </v-icon>
        Create First Product
      </v-btn>
    </div>

    <!-- Products Grid -->
    <div
      v-else
      class="products-grid"
    >
      <VueDraggable
        v-if="enableDragSort"
        v-model="sortedProducts"
        animation="300"
        class="drag-container"
        @end="handleDragEnd"
      >
        <div
          v-for="product in sortedProducts"
          :key="product.id"
          class="product-item"
        >
          <ProductCard
            :is-featured="product.is_featured"
            :on-delete="onDelete"
            :on-edit="onEdit"
            :on-remove="onRemove"
            :product="product"
            :show-actions="showActions"
            :show-description="showDescription"
            :show-sku="showSku"
            :show-stock="showStock"
            @delete="$emit('delete', $event)"
            @edit="$emit('edit', $event)"
            @remove="$emit('remove', $event)"
          />

          <!-- Drag Handle -->
          <div class="drag-handle">
            <v-icon color="secondary">
              mdi-drag-vertical
            </v-icon>
          </div>
        </div>
      </VueDraggable>

      <template v-else>
        <ProductCard
          v-for="product in products"
          :key="product.id"
          :is-featured="product.is_featured"
          :on-delete="onDelete"
          :on-edit="onEdit"
          :on-remove="onRemove"
          :product="product"
          :show-actions="showActions"
          :show-description="showDescription"
          :show-sku="showSku"
          :show-stock="showStock"
          @delete="$emit('delete', $event)"
          @edit="$emit('edit', $event)"
          @remove="$emit('remove', $event)"
        />
      </template>

      <style scoped>
        .product-list {
        width: 100%;
        }

        .list-header {
        margin-bottom: 24px;
        }

        .list-title {
        font-size: 1.75rem;
        font-weight: 700;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 8px;
        }

        .list-subtitle {
        font-size: 1rem;
        color: rgba(255, 255, 255, 0.7);
        margin-left: 48px;
        }

        .loading-container {
        display: flex;
        justify-content: center;
        align-items: center;
        padding: 80px 20px;
        }

        .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 20px;
        text-align: center;
        }

        .empty-state h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 16px;
        color: rgba(255, 255, 255, 0.8);
        }

        .empty-state p {
        font-size: 0.95rem;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 8px;
        max-width: 400px;
        }

        .products-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 24px;
        margin-bottom: 32px;
        }

        .drag-container {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
        gap: 24px;
        }

        .product-item {
        position: relative;
        cursor: move;
        }

        .drag-handle {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(0, 0, 0, 0.7);
        border-radius: 4px;
        padding: 4px;
        opacity: 0;
        transition: opacity 0.2s;
        }

        .product-item:hover .drag-handle {
        opacity: 1;
        }

        .list-stats {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        padding: 16px 0;
        border-top: 1px solid rgba(0, 255, 255, 0.1);
        }

        @media (max-width: 960px) {
        .products-grid,
        .drag-container {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
        gap: 16px;
        }
        }

        @media (max-width: 600px) {
        .products-grid,
        .drag-container {
        grid-template-columns: 1fr;
        }
        }
      </style>
    </div>
  </div>
</template>
