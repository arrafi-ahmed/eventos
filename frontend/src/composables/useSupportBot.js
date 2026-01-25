import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useStore } from 'vuex'
import $axios from '@/plugins/axios'
import { getIntentConfig, INTENT_CONFIG, SLOT_VALIDATORS } from '@/utils/supportIntents'

const STORAGE_KEY = 'support_session_id'

export function useSupportBot () {
  const store = useStore()
  const route = useRoute()
  const router = useRouter()

  // State
  const sessionId = ref(null)
  const messages = ref([])
  const currentIntent = ref(null)
  const isLoading = ref(false)
  const formData = ref({})
  const otpData = ref(null) // { requiresOTP: true, supportRequestId, otpSentTo }
  const isInitializing = ref(true)

  // Computed
  const currentUser = computed(() => store.state.auth.currentUser)
  const userEmail = computed(() => currentUser.value?.email || null)

  const currentIntentConfig = computed(() => {
    return currentIntent.value ? getIntentConfig(currentIntent.value) : null
  })

  // Initialize session
  onMounted(async () => {
    await initializeSession()
  })

  async function initializeSession () {
    isInitializing.value = true

    // Only load chat if sessionId is in URL query parameter
    const querySessionId = route.query.sessionId

    if (querySessionId) {
      sessionId.value = querySessionId
      // Store it in localStorage for future use
      localStorage.setItem(STORAGE_KEY, querySessionId)
      // Remove sessionId from URL to keep it clean after loading
      updateUrlWithoutSessionId()

      // Load chat history
      await loadChatHistory(querySessionId)
    } else {
      // No sessionId in query - show initial empty state
      // Clear any existing sessionId
      sessionId.value = null
    }

    isInitializing.value = false
  }

  async function loadChatHistory (sessionIdToLoad) {
    if (!sessionIdToLoad) {
      return
    }

    try {
      isLoading.value = true
      const response = await $axios.get(`/support/session/${sessionIdToLoad}`, {
        suppressToast: true,
      })

      const data = response.data.payload

      if (data && data.messages && Array.isArray(data.messages)) {
        // Load messages from history
        // Backend returns camelCase (due to db.js toCamelCase conversion)
        messages.value = data.messages.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt || msg.created_at || new Date(),
          intent: msg.intent,
          confidence: msg.confidence,
          slots: msg.slots || {},
        }))
      }
    } catch (error) {
      // If session doesn't exist or error, start fresh
      console.warn('Could not load chat history:', error)
      sessionId.value = null
      localStorage.removeItem(STORAGE_KEY)
      updateUrlWithoutSessionId()
    } finally {
      isLoading.value = false
    }
  }

  function updateUrlWithSessionId (id) {
    router.replace({
      query: {
        ...route.query,
        sessionId: id,
      },
    })
  }

  function updateUrlWithoutSessionId () {
    const query = { ...route.query }
    delete query.sessionId
    router.replace({ query })
  }

  function saveSessionId (id) {
    sessionId.value = id
    localStorage.setItem(STORAGE_KEY, id)
    // Append sessionId to URL when chat starts
    updateUrlWithSessionId(id)
  }

  // Send chat message
  async function sendMessage (text) {
    if (!text.trim() || isLoading.value) {
      return
    }

    isLoading.value = true

    const messageText = text.trim()

    // Add user message to UI immediately
    addMessage('user', messageText)

    try {
      // Create request config with suppressToast
      const requestConfig = {
        suppressToast: true, // Suppress default toast, we'll show in chat
      }

      const response = await $axios.post('/support/chat', {
        sessionId: sessionId.value,
        message: messageText,
        context: {
          userEmail: userEmail.value,
        },
      }, requestConfig)

      // Access payload from ApiResponse wrapper
      const data = response.data.payload

      // Save session ID if new
      if (data.sessionId && !sessionId.value) {
        saveSessionId(data.sessionId)
      }

      // Add assistant response
      addMessage('assistant', data.naturalResponse, {
        intent: data.intent,
        confidence: data.confidence,
        slots: data.slots,
      })

      // Handle intent detection
      if (data.intent && data.intent !== 'unknown' && data.confidence >= 0.7) {
        // Clean and validate slots using configured validators
        const cleanedSlots = {}
        if (data.slots) {
          for (const key of Object.keys(data.slots)) {
            const value = data.slots[key]

            // Skip null/undefined/empty values
            if (value === null || value === undefined || value === '') {
              continue
            }

            // Apply validator if one exists for this slot
            if (SLOT_VALIDATORS[key]) {
              const validated = SLOT_VALIDATORS[key](value)
              if (validated !== null && validated !== undefined) {
                cleanedSlots[key] = validated
              }
              // If validator returns null, try to extract from original message (fallback)
              else if (key === 'orderNumber' && typeof value === 'string' && value.trim().toLowerCase() === 'order') {
                // Fallback: try to extract from the original message
                const orderMatch = messageText.match(/(ORD[_-]?[\w\d]+)/i)
                if (orderMatch) {
                  cleanedSlots[key] = orderMatch[1]
                }
              }
            } else {
              // No validator: basic sanitization (trim strings)
              if (typeof value === 'string') {
                const trimmed = value.trim()
                if (trimmed) {
                  cleanedSlots[key] = trimmed
                }
              } else {
                cleanedSlots[key] = value
              }
            }
          }
        }
        setCurrentIntent(data.intent, cleanedSlots)
      } else if (data.confidence < 0.5) {
        // Low confidence - show buttons
        showQuickIntentButtons()
      }
    } catch (error) {
      handleError(error)
    } finally {
      isLoading.value = false
    }
  }

  // Handle intent button click
  function selectIntent (intentKey) {
    const config = getIntentConfig(intentKey)
    if (!config) {
      return
    }

    currentIntent.value = intentKey
    formData.value = {}
    otpData.value = null

    // Pre-fill form with user email if available
    if (userEmail.value) {
      for (const slotKey of Object.keys(config.slots)) {
        if (slotKey === 'email' || slotKey === 'oldEmail') {
          formData.value[slotKey] = userEmail.value
        }
      }
    }

    // Pre-fill with slots from LLM if available
    const lastMessage = messages.value.at(-1)
    if (lastMessage?.slots) {
      for (const key of Object.keys(lastMessage.slots)) {
        if (lastMessage.slots[key]) {
          formData.value[key] = lastMessage.slots[key]
        }
      }
    }
  }

  // Submit intent form
  async function submitIntentForm () {
    if (!currentIntent.value) {
      return
    }

    const config = getIntentConfig(currentIntent.value)
    if (!config) {
      return
    }

    // Validate required fields
    const requiredSlots = Object.entries(config.slots)
      .filter(([_, slotConfig]) => slotConfig.required)
      .map(([key]) => key)

    const missing = requiredSlots.filter(key => !formData.value[key])
    if (missing.length > 0) {
      addMessage('assistant', `Please fill in: ${missing.join(', ')}`)
      return
    }

    // Show user's request message
    const userRequestText = formatUserRequest(currentIntent.value, formData.value, config)
    addMessage('user', userRequestText)

    isLoading.value = true

    try {
      // Prepare request data
      let requestData = { ...formData.value }

      // Handle update_shipping_address special case
      if (currentIntent.value === 'update_shipping_address') {
        requestData = {
          orderNumber: formData.value.orderNumber,
          newAddress: {
            line1: formData.value.line1,
            line2: formData.value.line2,
            city: formData.value.city,
            state: formData.value.state,
            postal_code: formData.value.postal_code,
            country: formData.value.country,
          },
        }
      }

      const response = await $axios.post(config.apiEndpoint, {
        ...requestData,
        sessionId: sessionId.value,
      }, {
        suppressToast: true,
      })

      const data = response.data.payload

      // Check if OTP required
      if (data.requiresOTP) {
        otpData.value = {
          requiresOTP: true,
          supportRequestId: data.supportRequestId,
          otpSentTo: data.otpSentTo,
          expiresIn: data.expiresIn,
        }
        addMessage('assistant', `OTP sent to ${data.otpSentTo}. Please enter the code.`)
      } else {
        // Success - format the response message
        let successMessage = data.message || data.naturalResponse || 'Request processed successfully'

        // Format specific responses for better UX
        if (data.attendees && Array.isArray(data.attendees)) {
          // Check-in status response - format as HTML-friendly text
          const checkedIn = data.attendees.filter(a => a.checkinStatus === 'checked_in').length
          const total = data.attendees.length

          const attendeesList = data.attendees.map(a => {
            const status = a.checkinStatus === 'checked_in'
              ? '✓ Checked in'
              : '○ Not checked in'
            const time = a.checkedInAt
              ? new Date(a.checkedInAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : ''
            // Use name if available and looks valid, otherwise fallback to email or "Attendee"
            const trimmedName = (a.name || '').trim()
            // Check if name looks like invalid/test data (e.g., "loop jki", "test test", single word lowercase)
            const isValidName = trimmedName
              && trimmedName !== 'Attendee'
              && trimmedName.length > 2
              && !(/^[a-z]+\s[a-z]+$/.test(trimmedName) && trimmedName.length < 10) // Filter out short lowercase two-word names like "loop jki"

            const displayName = isValidName
              ? trimmedName
              : (a.email || 'Attendee')
            return `${displayName}: ${status}${time ? ` at ${time}` : ''}`
          }).join('\n')

          successMessage = `**Check-in Status for Order ${data.orderNumber}**\n\n${attendeesList}\n\n**Summary:** ${checkedIn} of ${total} ${total === 1 ? 'attendee' : 'attendees'} checked in`
        } else if (data.paymentStatus) {
          // Payment status response
          const paidDate = data.paidAt
            ? new Date(data.paidAt).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : null
          successMessage = `**Payment Status for Order ${data.orderNumber}**\n\nStatus: ${data.paymentStatus}\nAmount: ${data.currency || 'USD'} ${data.totalAmount}${paidDate ? `\nPaid on: ${paidDate}` : ''}`
        } else if (data.shipment) {
          // Shipment tracking response
          const estDelivery = data.shipment.estimatedDelivery
            ? new Date(data.shipment.estimatedDelivery).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : null
          successMessage = `**Shipment Status for Order ${data.orderNumber}**\n\n${data.shipment.trackingNumber ? `Tracking Number: ${data.shipment.trackingNumber}\n` : ''}Status: ${data.shipment.status}${estDelivery ? `\nEstimated Delivery: ${estDelivery}` : ''}`
        } else if (data.event) {
          // Event details response
          const startDate = data.event.startDate
            ? new Date(data.event.startDate).toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : null
          const endDate = data.event.endDate
            ? new Date(data.event.endDate).toLocaleString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : null

          let eventInfo = `**${data.event.name}**\n\n`
          if (data.event.description) {
            eventInfo += `${data.event.description}\n\n`
          }
          if (startDate) {
            eventInfo += `**Start:** ${startDate}\n`
          }
          if (endDate) {
            eventInfo += `**End:** ${endDate}\n`
          }
          if (data.event.location) {
            eventInfo += `**Location:** ${data.event.location}\n`
          }
          if (data.event.venue) {
            eventInfo += `**Venue:** ${data.event.venue}\n`
          }
          successMessage = eventInfo.trim()
        } else if (data.order) {
          // Order details response
          const orderDate = data.order.createdAt
            ? new Date(data.order.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
            : null
          successMessage = `**Order ${data.order.orderNumber}**\n\nStatus: ${data.order.status}\nAmount: ${data.order.currency || 'USD'} ${data.order.totalAmount}${orderDate ? `\nDate: ${orderDate}` : ''}${data.order.eventName ? `\nEvent: ${data.order.eventName}` : ''}`
        }

        addMessage('assistant', successMessage)
        resetIntent()
      }
    } catch (error) {
      handleError(error)
    } finally {
      isLoading.value = false
    }
  }

  // Verify OTP
  async function verifyOTP (code) {
    if (!otpData.value || !code) {
      return
    }

    isLoading.value = true

    try {
      const response = await $axios.post('/support/verify-otp', {
        email: otpData.value.otpSentTo,
        purpose: currentIntent.value,
        code,
        supportRequestId: otpData.value.supportRequestId,
      }, {
        suppressToast: true,
      })

      const data = response.data.payload

      addMessage('assistant', data.message || 'Action completed successfully')
      resetIntent()
      otpData.value = null
    } catch (error) {
      handleError(error)
    } finally {
      isLoading.value = false
    }
  }

  // Resend OTP
  async function resendOTP () {
    if (!otpData.value) {
      return
    }

    isLoading.value = true

    try {
      await $axios.post('/support/resend-otp', {
        email: otpData.value.otpSentTo,
        purpose: currentIntent.value,
        supportRequestId: otpData.value.supportRequestId,
      }, {
        suppressToast: true,
      })

      addMessage('assistant', 'New OTP sent to your email')
    } catch (error) {
      handleError(error)
    } finally {
      isLoading.value = false
    }
  }

  // Helper functions
  function addMessage (role, content, metadata = {}) {
    messages.value.push({
      role,
      content,
      timestamp: new Date(),
      ...metadata,
    })
  }

  function setCurrentIntent (intentKey, prefillSlots = {}) {
    currentIntent.value = intentKey
    formData.value = { ...prefillSlots }
  }

  function resetIntent () {
    currentIntent.value = null
    formData.value = {}
    otpData.value = null
  }

  function showQuickIntentButtons () {
    // Trigger UI to show buttons (handled in component)
    currentIntent.value = 'show_buttons'
  }

  function formatUserRequest (intentKey, formData, config) {
    // Create a user-friendly summary of what they're requesting
    const intentLabel = config.label || intentKey

    // Build a readable summary
    const parts = []
    for (const key of Object.keys(config.slots)) {
      if (formData[key] && key !== 'message') {
        const slotConfig = config.slots[key]
        const label = slotConfig.description || key
        parts.push(`${label}: ${formData[key]}`)
      }
    }

    if (parts.length > 0) {
      return `${intentLabel}\n${parts.join('\n')}`
    }

    return intentLabel
  }

  function handleError (error) {
    let errorMessage = 'An error occurred. Please try again.'

    if (error.response?.data?.payload) {
      const payload = error.response.data.payload
      errorMessage = payload.naturalResponse || payload.message || errorMessage

      // Handle requiresMoreInfo
      if (payload.requiresMoreInfo // Show form or ask for more info
        && payload.intent) {
        setCurrentIntent(payload.intent, payload.slots || {})
      }
    } else if (error.response?.data?.msg) {
      errorMessage = error.response.data.msg
    }

    addMessage('assistant', errorMessage)
  }

  return {
    // State
    sessionId,
    messages,
    currentIntent,
    isLoading,
    isInitializing,
    formData,
    otpData,
    userEmail,

    // Computed
    currentIntentConfig,

    // Methods
    sendMessage,
    selectIntent,
    submitIntentForm,
    verifyOTP,
    resendOTP,
    resetIntent,
    loadChatHistory,
  }
}
