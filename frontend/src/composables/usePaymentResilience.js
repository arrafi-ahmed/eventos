import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useStore } from 'vuex'
import $axios from '@/plugins/axios'

export function usePaymentResilience() {
    const router = useRouter()
    const store = useStore()
    const isChecking = ref(false)
    const paidSession = ref(null)

    const checkAndCleanupSession = async (slug, isCheckoutPage = false) => {
        const sessionId = localStorage.getItem('tempSessionId')
        if (!sessionId) return

        try {
            isChecking.value = true
            // Use headers to suppress toast for this background check
            const res = await $axios.get(`/payment/status/${sessionId}`, {
                headers: { 'X-Suppress-Toast': 'true' }
            })

            if (res.data?.payload?.status === 'paid') {
                const orderData = res.data.payload

                if (isCheckoutPage) {
                    // On checkout page, we show a banner instead of silent cleanup
                    paidSession.value = orderData
                } else {
                    // On landing/tickets, we silently cleanup to ensure Person B doesn't see Person A's data
                    clearRegistrationLocalData()
                }
            }
        } catch (error) {
            console.warn('[Resilience] Status check failed:', error)
        } finally {
            isChecking.value = false
        }
    }

    const clearRegistrationLocalData = () => {
        localStorage.removeItem('selectedTickets')
        localStorage.removeItem('selectedProducts')
        localStorage.removeItem('attendeesData')
        localStorage.removeItem('registrationData')
        localStorage.removeItem('tempSessionId')
        localStorage.removeItem('cartHash')

        // Clear Vuex store to prevent pre-selected items
        store.dispatch('checkout/clearCheckout')

        paidSession.value = null
    }

    const goToSuccess = (slug) => {
        if (!paidSession.value) return

        router.push({
            name: 'event-register-success-slug',
            params: { slug },
            query: { session_id: localStorage.getItem('tempSessionId') }
        })
    }

    return {
        isChecking,
        paidSession,
        checkAndCleanupSession,
        clearRegistrationLocalData,
        goToSuccess
    }
}
