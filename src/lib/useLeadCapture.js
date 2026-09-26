import { ref } from 'vue'
import { supabase, supabaseConfigured } from './supabase'

/**
 * Validates and submits phone numbers from landing page lead capture forms.
 * @param {'rider'|'driver'} source - Which landing page the lead came from
 */
export function useLeadCapture(source) {
  const phone = ref('')
  const loading = ref(false)
  const error = ref('')
  const success = ref(false)

  // Accept digits, spaces, dashes, parens, plus sign. Must have 7-15 digits.
  function isValidPhone(value) {
    const digits = value.replace(/\D/g, '')
    return digits.length >= 7 && digits.length <= 15
  }

  async function submit() {
    error.value = ''
    success.value = false

    const trimmed = phone.value.trim()
    if (!trimmed) {
      error.value = 'Please enter your phone number.'
      return
    }
    if (!isValidPhone(trimmed)) {
      error.value = 'Please enter a valid phone number.'
      return
    }

    if (!supabaseConfigured) {
      // Demo mode — pretend it worked
      success.value = true
      return
    }

    loading.value = true
    try {
      const { error: dbError } = await supabase
        .from('leads')
        .insert({ phone: trimmed, source })

      if (dbError) {
        error.value = 'Something went wrong. Please try again.'
        console.error('Lead capture error:', dbError)
        return
      }
      success.value = true
    } catch (e) {
      error.value = 'Something went wrong. Please try again.'
      console.error('Lead capture error:', e)
    } finally {
      loading.value = false
    }
  }

  return { phone, loading, error, success, submit }
}
