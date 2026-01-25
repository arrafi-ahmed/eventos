<script setup>
  import { computed, onMounted } from 'vue'
  import { useStore } from 'vuex'
  import { appInfo } from '@/utils'

  const store = useStore()

  const footerSettings = computed(() => store.state.footerSettings?.settings || {
    style: 'oneline',
    companyName: null,
    companyAddress: null,
    companyEmail: null,
    companyPhone: null,
    quickLinks: [],
    socialLinks: {},
    copyrightText: null,
  })

  // Footer text logic refined to handle Arrafi link gracefully
  const companyName = computed(() => footerSettings.value.companyName?.trim() || appInfo.name)
  const customText = computed(() => {
    const text = footerSettings.value.copyrightText?.trim()
    if (!text || text.includes('Arrafi') || text.toLowerCase() === 'all rights reserved') return null
    return text
  })
  const currentYear = new Date().getFullYear()

  const hasSocialLinks = computed(() => {
    const social = footerSettings.value.socialLinks || {}
    return !!(social.facebook || social.instagram || social.tiktok)
  })

  function getSocialIcon (platform) {
    const icons = {
      facebook: 'mdi-facebook',
      instagram: 'mdi-instagram',
      tiktok: 'mdi-music-note',
    }
    return icons[platform] || 'mdi-link'
  }

// Footer settings are loaded in App.vue on mount
// This component just uses the cached/loaded data from store
</script>

<template>
  <v-footer
    :class="['footer', 'flex-column', 'align-center', 'flex-grow-0', { 'oneline-footer': footerSettings.style === 'oneline' }]"
    color="surface"
  >
    <!-- Expanded Footer -->
    <div v-if="footerSettings.style === 'expanded'">
      <div class="footer-content footer-expanded-content">
        <div class="footer-grid">
          <!-- Company Information -->
          <div
            v-if="footerSettings.companyName || footerSettings.companyAddress || footerSettings.companyEmail || footerSettings.companyPhone"
            class="footer-section"
          >
            <h3
              v-if="footerSettings.companyName"
              class="footer-title"
            >
              {{ footerSettings.companyName }}
            </h3>
            <div class="footer-info">
              <div
                v-if="footerSettings.companyAddress"
                class="footer-info-item"
              >
                <v-icon
                  class="me-2"
                  size="18"
                >
                  mdi-map-marker
                </v-icon>
                <span>{{ footerSettings.companyAddress }}</span>
              </div>
              <div
                v-if="footerSettings.companyEmail"
                class="footer-info-item"
              >
                <v-icon
                  class="me-2"
                  size="18"
                >
                  mdi-email
                </v-icon>
                <a
                  class="footer-link"
                  :href="`mailto:${footerSettings.companyEmail}`"
                >
                  {{ footerSettings.companyEmail }}
                </a>
              </div>
              <div
                v-if="footerSettings.companyPhone"
                class="footer-info-item"
              >
                <v-icon
                  class="me-2"
                  size="18"
                >
                  mdi-phone
                </v-icon>
                <a
                  class="footer-link"
                  :href="`tel:${footerSettings.companyPhone}`"
                >
                  {{ footerSettings.companyPhone }}
                </a>
              </div>
            </div>
          </div>

          <!-- Quick Links -->
          <div
            v-if="footerSettings.quickLinks && footerSettings.quickLinks.length > 0"
            class="footer-section"
          >
            <h3 class="footer-title">
              Quick Links
            </h3>
            <div class="footer-links">
              <router-link
                v-for="(link, index) in footerSettings.quickLinks"
                :key="index"
                class="footer-link-item"
                :to="{ name: link.routeName }"
              >
                {{ link.title }}
              </router-link>
            </div>
          </div>

          <!-- Social Media -->
          <div
            v-if="hasSocialLinks"
            class="footer-section"
          >
            <h3 class="footer-title">
              Follow Us
            </h3>
            <div class="footer-social">
              <a
                v-if="footerSettings.socialLinks?.facebook"
                class="footer-social-link"
                :href="footerSettings.socialLinks.facebook"
                rel="noopener noreferrer"
                target="_blank"
              >
                <v-icon size="24">
                  {{ getSocialIcon('facebook') }}
                </v-icon>
              </a>
              <a
                v-if="footerSettings.socialLinks?.instagram"
                class="footer-social-link"
                :href="footerSettings.socialLinks.instagram"
                rel="noopener noreferrer"
                target="_blank"
              >
                <v-icon size="24">
                  {{ getSocialIcon('instagram') }}
                </v-icon>
              </a>
              <a
                v-if="footerSettings.socialLinks?.tiktok"
                class="footer-social-link"
                :href="footerSettings.socialLinks.tiktok"
                rel="noopener noreferrer"
                target="_blank"
              >
                <v-icon size="24">
                  {{ getSocialIcon('tiktok') }}
                </v-icon>
              </a>
            </div>
          </div>
        </div>
      </div>
      <div class="footer-divider-container w-100 px-10 mb-4">
        <div class="footer-divider" />
      </div>
    </div>
    <!-- Footer Bottom -->
    <div class="footer-content">
      <p class="footer-copyright text-center">
        © {{ currentYear }} {{ companyName }}.
        <span v-if="customText"> {{ customText }}.</span>
        <span class="d-md-inline-block d-block ml-md-1">
          Developed with ❤️ by <a class="developer-link" href="https://www.fiverr.com/rafi89" target="_blank">Arrafi</a>
        </span>
      </p>
    </div>
  </v-footer>
</template>

<style scoped>
.footer {
  padding: 80px 24px 40px;
  border-top: 1px solid rgba(var(--v-border-color), 0.08);
}

.oneline-footer {
  padding: 12px 24px !important;
}

.footer-content {
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.footer-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 48px;
  margin-bottom: 60px;
}

.footer-section {
  display: flex;
  flex-direction: column;
}

.footer-title {
  color: rgb(var(--v-theme-on-surface));
  font-family: 'Plus Jakarta Sans', sans-serif !important;
  font-size: 0.85rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 24px;
  opacity: 0.9;
}

.footer-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.footer-info-item {
  display: flex;
  align-items: center;
  color: rgb(var(--v-theme-on-surface));
  font-size: 0.95rem;
  opacity: 0.8;
}

.footer-link {
  color: inherit;
  text-decoration: none;
  transition: opacity 0.2s, transform 0.2s;
}

.footer-link:hover {
  opacity: 1;
  color: rgb(var(--v-theme-primary));
}

.footer-links {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.footer-link-item {
  color: rgb(var(--v-theme-on-surface));
  text-decoration: none;
  font-size: 0.95rem;
  font-weight: 500;
  transition: all 0.2s;
  opacity: 0.8;
}

.footer-link-item:hover {
  opacity: 1;
  color: rgb(var(--v-theme-primary));
  padding-left: 4px;
}

.footer-social {
  display: flex;
  gap: 12px;
}

.footer-social-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background-color: rgba(var(--v-theme-on-surface), 0.03);
  color: rgb(var(--v-theme-on-surface));
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.footer-social-link:hover {
  background-color: rgb(var(--v-theme-primary));
  color: white;
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(var(--v-theme-primary), 0.3);
}

.footer-divider-container {
  display: flex;
  justify-content: center;
}

.footer-divider {
  width: 100%;
  max-width: 1400px;
  height: 1px;
  background-color: rgba(var(--v-border-color), 0.15);
}

.footer-copyright {
  color: rgb(var(--v-theme-on-surface)) !important;
  font-size: 0.85rem;
  opacity: 0.6;
  width: 100%;
}

.developer-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
  font-weight: 600;
  opacity: 1 !important;
}

.developer-link:hover {
  text-decoration: underline;
}

@media (max-width: 960px) {
  .footer {
    padding: 12px;
  }

  .footer-grid {
    grid-template-columns: 1fr;
    gap: 24px;
    text-align: center;
  }

  .footer-section {
    margin-bottom: 0;
  }

  .footer-info {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .footer-social {
    justify-content: center;
  }
}
</style>
