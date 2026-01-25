<script setup>
  import { computed, onMounted, ref } from 'vue'
  import { VueDraggable } from 'vue-draggable-plus'
  import { useRoute, useRouter } from 'vue-router'
  import { useDisplay } from 'vuetify'
  import { useStore } from 'vuex'
  import AppNoData from '@/components/AppNoData.vue'
  import ProductCard from '@/components/product/ProductCard.vue'
  import ProductForm from '@/components/product/ProductForm.vue'
  import { useUiProps } from '@/composables/useUiProps'

  definePage({
    name: 'event-manage-shop',
    meta: {
      layout: 'default',
      title: 'Manage Shop',
      requiresAuth: true,
    },
  })

  const { xs } = useDisplay()
  const route = useRoute()
  const router = useRouter()
  const store = useStore()

  const { rounded, size, variant, density } = useUiProps()

  // State
  const eventId = ref(Number.parseInt(route.params.eventId))
  const activeTab = ref('assigned') // 'assigned' or 'catalog'
  const isLoading = ref(false)
  const showProductDialog = ref(false)
  const showAddProductDialog = ref(false)
  const editingProduct = ref(null)
  const savingProduct = ref(false)
  const productToRemove = ref(null)

  // Computed
  const currentUser = computed(() => store.getters['auth/getCurrentUser'])
  const organizationId = computed(() => currentUser.value?.organizationId)
  const event = computed(() => store.state.event.event)
  const allProducts = computed(() => store.state.product.products)

  // Normalize event products: convert snake_case from backend to camelCase
  const eventProducts = computed(() => {
    const products = store.state.product.eventProducts
    if (!products || !Array.isArray(products)) return []
    return products.map(product => ({
      ...product,
      isFeatured: product.is_featured || false,
      displayOrder: product.display_order || 0,
    }))
  })

  // Available products (not yet assigned to event)
  const availableProducts = computed(() => {
    if (!allProducts.value || !Array.isArray(allProducts.value)) return []

    // If no event products, all products are available
    if (!eventProducts.value || eventProducts.value.length === 0) {
      return allProducts.value.filter(p => p.isActive)
    }

    const assignedIds = new Set(eventProducts.value.map(p => p.id))
    return allProducts.value.filter(p => !assignedIds.has(p.id) && p.isActive)
  })

  // Fetch data on mount
  onMounted(async () => {
    await loadData()
  })

  async function loadData () {
    try {
      isLoading.value = true

      // Fetch event details
      await store.dispatch('event/setEvent', { eventId: eventId.value })

      // Fetch products linked to this event
      await store.dispatch('product/fetchEventProducts', eventId.value)

      // Fetch all organization products
      if (organizationId.value) {
        await store.dispatch('product/fetchOrganizerProducts', organizationId.value)
      }
    } catch (error) {
      console.error('Error loading data:', error)
      store.commit('addSnackbar', {
        text: 'Failed to load shop data',
        color: 'error',
      })
    } finally {
      isLoading.value = false
    }
  }

  // Product CRUD operations
  function openCreateDialog () {
    editingProduct.value = null
    showProductDialog.value = true
  }

  function openEditDialog (product) {
    editingProduct.value = product
    showProductDialog.value = true
  }

  function closeProductDialog () {
    showProductDialog.value = false
    editingProduct.value = null
  }

  async function handleProductSubmit (formData) {
    try {
      savingProduct.value = true

      let result = null

      if (editingProduct.value) {
        // Update existing product
        result = await store.dispatch('product/updateProduct', formData)
      // Notification handled by backend
      } else {
        // Create new product
        result = await store.dispatch('product/createProduct', formData)
        // Notification handled by backend

        // Ask if user wants to add it to this event
        if (result?.data?.id) {
          const addToEvent = confirm('Product created! Add it to this event now?')
          if (addToEvent) {
            await handleAddProductToEvent(result.data.id)
          }
        }
      }

      closeProductDialog()

      // Update store state - single source of truth
      if (editingProduct.value) {
        // Update existing product in store
        if (result?.data) {
          store.commit('product/UPDATE_PRODUCT', result.data)
        }
      } else {
        // Add new product to store
        if (result?.data) {
          store.commit('product/ADD_PRODUCT', result.data)
        }
      }
    } catch (error) {
      console.error('Error saving product:', error)
    // Error notification handled by backend via axios interceptor
    } finally {
      savingProduct.value = false
    }
  }

  async function handleDeleteProduct (product) {
    if (!confirm(`Delete "${product.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      await store.dispatch('product/deleteProduct', product.id)
      // Notification handled by backend
      // Remove from store - single source of truth
      store.commit('product/REMOVE_PRODUCT', product.id)
    } catch (error) {
      console.error('Error deleting product:', error)
    // Error notification handled by backend via axios interceptor
    }
  }

  // Event-Product operations
  async function handleAddProductToEvent (productId) {
    try {
      await store.dispatch('product/addProductToEvent', {
        eventId: eventId.value,
        productId,
        isFeatured: false,
      })

      // Notification handled by backend
      // Add to store - single source of truth
      const productToAdd = allProducts.value.find(p => p.id === productId)
      if (productToAdd) {
        store.commit('product/ADD_PRODUCT_TO_EVENT', {
          ...productToAdd,
          is_featured: false,
          display_order: eventProducts.value.length,
        })
      }
    } catch (error) {
      console.error('Error adding product to event:', error)
    // Error notification handled by backend via axios interceptor
    }
  }

  function handleRemoveProductFromEvent (product) {
    productToRemove.value = product
  }

  async function confirmRemoveProduct () {
    if (!productToRemove.value) return

    try {
      await store.dispatch('product/removeProductFromEvent', {
        eventId: eventId.value,
        productId: productToRemove.value.id,
      })

      // Notification handled by backend
      // Remove from store - single source of truth
      store.commit('product/REMOVE_PRODUCT_FROM_EVENT', productToRemove.value.id)
    } catch (error) {
      console.error('Error removing product from event:', error)
    // Error notification handled by backend via axios interceptor
    } finally {
      productToRemove.value = null
    }
  }

  async function handleToggleFeatured (product) {
    try {
      await store.dispatch('product/updateEventProductSettings', {
        eventId: eventId.value,
        productId: product.id,
        isFeatured: !product.isFeatured,
      })

      // Notification handled by backend
      // Update store - single source of truth
      const index = eventProducts.value.findIndex(p => p.id === product.id)
      if (index !== -1) {
        store.commit('product/UPDATE_EVENT_PRODUCT', {
          ...eventProducts.value[index],
          is_featured: !product.isFeatured,
        })
      }
    } catch (error) {
      console.error('Error toggling featured status:', error)
    // Error notification handled by backend via axios interceptor
    }
  }

  async function handleReorder () {
    try {
      // Create productOrders from eventProducts with their current positions
      const productOrders = eventProducts.value.map((product, index) => ({
        productId: product.id,
        displayOrder: index,
      }))

      await store.dispatch('product/reorderEventProducts', {
        eventId: eventId.value,
        productOrders,
      })

    // Notification handled by backend
    } catch (error) {
      console.error('Error reordering products:', error)
    // Error notification handled by backend via axios interceptor
    }
  }

  function handleImageDelete () {
    // Update the editing product to remove the image
    if (editingProduct.value) {
      editingProduct.value.image = null
    }
  }

  function goBack () {
    router.push({ name: 'admin-dashboard' })
  }
</script>

<template>
  <v-container class="manage-shop-page">
    <!-- Header Section -->
    <v-row
      class="mb-6"
      justify="center"
    >
      <v-col cols="12">
        <page-title :subtitle="event?.name" title="Manage Shop">
          <template #actions>
            <v-btn
              color="primary"
              :density="density"
              :rounded="rounded"
              :size="size"
              @click="openCreateDialog"
            >
              <v-icon start>
                mdi-plus
              </v-icon>
              {{ xs ? ' Product' : 'New Product' }}
            </v-btn>
          </template>
        </page-title>
      </v-col>
    </v-row>

    <!-- Tabs Section -->
    <v-row justify="center">
      <v-col cols="12">
        <v-tabs
          v-model="activeTab"
          class="mb-6"
          color="secondary"
        >
          <v-tab value="assigned">
            <v-icon start>
              mdi-check-circle
            </v-icon>
            Assigned Products
            <v-chip
              v-if="eventProducts.length > 0"
              class="ml-2"
              size="small"
            >
              {{ eventProducts.length }}
            </v-chip>
          </v-tab>

          <v-tab value="catalog">
            <v-icon start>
              mdi-package-variant
            </v-icon>
            Product Catalog
            <v-chip
              v-if="allProducts?.length > 0"
              class="ml-2"
              size="small"
            >
              {{ allProducts.length }}
            </v-chip>
          </v-tab>
        </v-tabs>

        <!-- Tab Content -->
        <v-window v-model="activeTab">

          <!-- Assigned Products Tab -->
          <v-window-item value="assigned">
            <!-- Loading State -->
            <div
              v-if="isLoading"
              class="d-flex justify-center align-center pa-16"
            >
              <v-progress-circular
                color="secondary"
                indeterminate
                size="64"
              />
            </div>

            <!-- Empty State -->
            <AppNoData
              v-else-if="eventProducts.length === 0"
              icon="mdi-cart-off"
              message="Add products from your catalog or create new ones to sell alongside tickets."
              title="No Products Assigned"
            >
              <template #actions>
                <v-btn
                  color="secondary"
                  :rounded="rounded"
                  :size="size"
                  @click="activeTab = 'catalog'"
                >
                  <v-icon start>
                    mdi-plus
                  </v-icon>
                  Browse Catalog
                </v-btn>
              </template>
            </AppNoData>

            <!-- Products Grid -->
            <div v-else>
              <v-alert
                class="mb-6"
                color="info"
                variant="tonal"
              >
                <div class="text-body-2">These products will be displayed to attendees during ticket selection.</div>
                <div class="text-caption mt-1">Drag to reorder • Click star to feature</div>
              </v-alert>

              <VueDraggable
                v-model="eventProducts"
                animation="300"
                class="products-grid"
                @end="handleReorder"
              >
                <div
                  v-for="product in eventProducts"
                  :key="product.id"
                  class="product-wrapper"
                >
                  <ProductCard
                    :is-featured="product.isFeatured"
                    :on-remove="true"
                    :product="product"
                    :show-actions="true"
                    @remove="handleRemoveProductFromEvent"
                  />

                  <!-- Product Actions -->
                  <div class="product-overlay-actions">

                    <v-chip color="primary" variant="flat">
                      <v-icon @click="handleToggleFeatured(product)">
                        {{ product.isFeatured ? 'mdi-star' : 'mdi-star-outline' }}
                      </v-icon>
                    </v-chip>
                    <v-chip variant="flat">
                      <v-icon class="drag-handle">mdi-drag</v-icon>
                    </v-chip>
                  </div>
                </div>
              </VueDraggable>
            </div>
          </v-window-item>

          <!-- Product Catalog Tab -->
          <v-window-item value="catalog">
            <!-- Loading State -->
            <div
              v-if="isLoading"
              class="d-flex justify-center align-center pa-16"
            >
              <v-progress-circular
                color="secondary"
                indeterminate
                size="64"
              />
            </div>

            <!-- Empty Catalog -->
            <AppNoData
              v-else-if="allProducts && allProducts.length === 0"
              icon="mdi-package-variant-closed"
              message="Create your first product to start selling merchandise."
              title="No Products Yet"
            >
              <template #actions>
                <v-btn
                  color="primary"
                  :rounded="rounded"
                  :size="size"
                  @click="openCreateDialog"
                >
                  <v-icon start>
                    mdi-plus
                  </v-icon>
                  Create Product
                </v-btn>
              </template>
            </AppNoData>

            <!-- All Products -->
            <div v-else>
              <v-alert
                class="mb-6"
                color="info"
                variant="tonal"
              >
                <div class="text-body-2">Manage all your products. Click "+" to add products to this event.</div>
              </v-alert>

              <div class="products-grid">
                <ProductCard
                  v-for="product in allProducts"
                  :key="product.id"
                  :on-delete="true"
                  :on-edit="true"
                  :product="product"
                  :show-actions="true"
                  :show-in-event="!availableProducts.some(p => p.id === product.id)"
                  @delete="handleDeleteProduct"
                  @edit="openEditDialog"
                >
                  <template
                    v-if="availableProducts.some(p => p.id === product.id)"
                    #extra-actions
                  >
                    <div class="d-flex flex-wrap">
                      <v-btn
                        block
                        color="secondary"
                        density="comfortable"
                        prepend-icon="mdi-plus"
                        rounded="rounded"
                        variant="tonal"
                        @click="handleAddProductToEvent(product.id)"
                      >
                        Add to Event
                      </v-btn>
                    </div>
                  </template>
                </ProductCard>
              </div>
            </div>
          </v-window-item>
        </v-window>
      </v-col>
    </v-row>

    <!-- Product Form Dialog -->
    <v-dialog
      v-model="showProductDialog"
      max-width="700px"
      persistent
    >
      <v-card class="rounded-xl">
        <ProductForm
          v-if="showProductDialog"
          :currency="event?.currency || 'USD'"
          :loading="savingProduct"
          :product="editingProduct"
          @cancel="closeProductDialog"
          @image-delete="handleImageDelete"
          @submit="handleProductSubmit"
        />
      </v-card>
    </v-dialog>

    <!-- Confirmation Dialog for Removing Products -->
    <v-dialog
      v-model="productToRemove"
      :rounded="rounded"
      :width="400"
    >
      <v-card :rounded="rounded">
        <v-card-title>
          <span>Remove Product</span>
        </v-card-title>
        <v-card-text>
          Remove "{{ productToRemove?.name }}" from this event?
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            class="mr-3"
            :rounded="rounded"
            :size="size"
            variant="outlined"
            @click="productToRemove = null"
          >
            Cancel
          </v-btn>
          <v-btn
            color="warning"
            :rounded="rounded"
            :size="size"
            @click="confirmRemoveProduct"
          >
            Remove
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<style scoped>
/* Products Grid */
.products-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

/* Product Card Wrapper for Overlay Actions */
.product-wrapper {
  position: relative;
}

.product-overlay-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  gap: 8px;
  opacity: 1;
  transition: opacity 0.2s;
}

.product-wrapper:hover .product-overlay-actions {
  opacity: 1;
}

.drag-handle {
  cursor: move;
}

/* Responsive Grid */
@media (max-width: 960px) {
  .products-grid {
    grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
    gap: 16px;
  }
}

@media (max-width: 600px) {
  .products-grid {
    grid-template-columns: 1fr;
  }
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
