<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, friendlyAuthError, MIN_PASSWORD } from '../../lib/useAuth'
import { useDriver } from '../../lib/useDriver'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { user, signUp, resendConfirmation } = useAuth()

const form = ref({
  name: '', email: '', phone: '',
  vehicleMake: '', vehicleModel: '', vehicleYear: '',
  vehicleColor: '', vehiclePlate: '',
  vehicleType: 'standard', licenseNumber: '',
})
const password = ref('')
const error = ref('')
const notice = ref('')
const submitting = ref(false)
const success = ref(false)
const awaitingConfirmation = ref(false)
const finishing = ref(false)

// Guests (anonymous sessions) have no login, so they apply with a new account like anyone signed out.
const hasAccount = computed(() => !!user.value && !user.value.is_anonymous)
const maxYear = new Date().getFullYear() + 1

function toRow(f) {
  return {
    name: f.name.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    vehicle_make: f.vehicleMake.trim(),
    vehicle_model: f.vehicleModel.trim(),
    vehicle_color: f.vehicleColor.trim(),
    license_plate: f.vehiclePlate.trim().toUpperCase(),
    vehicle_year: parseInt(f.vehicleYear) || null,
    license_number: f.licenseNumber.trim() || null,
    vehicle_type: f.vehicleType,
  }
}

// Insert the application for a signed-in user. Used right away, or after they confirm their email.
async function submitApplication(authUser, row) {
  const { error: insertErr } = await supabase.from('drivers').insert({ ...row, auth_user_id: authUser.id })
  if (insertErr && insertErr.code !== '23505') return insertErr // 23505: already applied
  if (authUser.user_metadata?.driver_application) {
    await supabase.auth.updateUser({ data: { driver_application: null } })
  }
  useDriver().reset()
  return null
}

onMounted(async () => {
  if (DEMO_MODE || !supabaseConfigured) return
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser || authUser.is_anonymous) return

  form.value.email = authUser.email || ''
  form.value.name = authUser.user_metadata?.name || ''

  // Already a driver: nothing to apply for.
  const { data: existing } = await supabase.from('drivers').select('id, approved').eq('auth_user_id', authUser.id).maybeSingle()
  const saved = authUser.user_metadata?.driver_application
  if (existing) {
    if (saved) await supabase.auth.updateUser({ data: { driver_application: null } })
    router.replace(existing.approved ? '/driver/dashboard' : '/driver/pending')
    return
  }

  // Back from the confirmation email: submit the application they filled in before confirming.
  if (saved && typeof saved === 'object') {
    finishing.value = true
    const err = await submitApplication(authUser, saved)
    finishing.value = false
    if (err) {
      Object.assign(form.value, {
        name: saved.name || '', phone: saved.phone || '', email: authUser.email || '',
        vehicleMake: saved.vehicle_make || '', vehicleModel: saved.vehicle_model || '', vehicleYear: saved.vehicle_year || '',
        vehicleColor: saved.vehicle_color || '', vehiclePlate: saved.license_plate || '',
        vehicleType: saved.vehicle_type || 'standard', licenseNumber: saved.license_number || '',
      })
      error.value = `We couldn’t submit your saved application: ${err.message}. Check your details and tap Submit.`
      return
    }
    success.value = true
    setTimeout(() => router.push('/driver/pending'), 2000)
  }
})

function validate(f) {
  if (!f.name.trim() || !f.email.trim() || !f.phone.trim()) return 'Please fill in all personal details.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return 'Please enter a valid email address.'
  if (f.phone.replace(/\D/g, '').length < 7) return 'Please enter a valid phone number.'
  if (!f.vehicleMake.trim() || !f.vehicleModel.trim() || !f.vehiclePlate.trim()) return 'Please fill in all vehicle details.'
  const year = parseInt(f.vehicleYear)
  if (f.vehicleYear && (!year || year < 1990 || year > maxYear)) return `Enter the vehicle year between 1990 and ${maxYear}.`
  if (!f.licenseNumber.trim()) return 'Please enter your driver\'s license number.'
  if (!hasAccount.value && password.value.length < MIN_PASSWORD) return `Please create a password (at least ${MIN_PASSWORD} characters).`
  return ''
}

async function handleSubmit() {
  error.value = ''
  const f = form.value
  const problem = validate(f)
  if (problem) {
    error.value = problem
    return
  }

  if (DEMO_MODE) {
    submitting.value = true
    await new Promise(r => setTimeout(r, 800))
    success.value = true
    setTimeout(() => router.push('/driver/dashboard'), 1500)
    return
  }
  if (!supabaseConfigured) {
    error.value = 'Database not configured.'
    return
  }

  submitting.value = true
  const row = toRow(f)

  if (!hasAccount.value) {
    // Keep the application with the new account so it survives email confirmation, on any device.
    const result = await signUp(row.email, password.value, row.name, { redirectPath: '/driver/apply', data: { driver_application: row } })
    if (result.error) {
      submitting.value = false
      error.value = friendlyAuthError(result.error)
      return
    }
    if (result.needsConfirmation) {
      submitting.value = false
      awaitingConfirmation.value = true
      return
    }
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) {
    submitting.value = false
    error.value = 'Please log in first.'
    return
  }
  const err = await submitApplication(currentUser, row)
  submitting.value = false
  if (err) {
    error.value = err.message
    return
  }
  success.value = true
  setTimeout(() => router.push('/driver/pending'), 2000)
}

async function resend() {
  notice.value = ''
  error.value = ''
  submitting.value = true
  const { error: err } = await resendConfirmation(form.value.email.trim(), '/driver/apply')
  submitting.value = false
  if (err) {
    error.value = friendlyAuthError(err)
    return
  }
  notice.value = 'Sent again. It can take a minute; check your spam folder too.'
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-dvh bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-11 h-11 flex items-center justify-center rounded-full active:bg-[var(--color-surface-secondary)]" aria-label="Back">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 w-full max-w-md mx-auto">
      <p v-if="finishing" class="pt-20 text-center text-[var(--color-text-secondary)]" role="status">Submitting your application…</p>

      <!-- Waiting for email confirmation -->
      <div v-else-if="awaitingConfirmation" class="pt-10">
        <h2 class="text-2xl font-bold mb-2" aria-live="polite">Confirm your email to finish</h2>
        <p class="text-[var(--color-text-secondary)] text-[14px] mb-6">
          We sent a link to <strong class="text-[var(--color-text-primary)]">{{ form.email }}</strong>. Tap it and your application is submitted automatically. We saved everything you entered.
        </p>
        <p v-if="notice" class="text-[13px] text-[var(--color-brand)] mb-3" role="status">{{ notice }}</p>
        <p v-if="error" class="text-[13px] text-[var(--color-danger)] mb-3" role="alert">{{ error }}</p>
        <button @click="resend" :disabled="submitting" class="w-full py-3.5 rounded-xl border border-[var(--color-border)] font-semibold text-[15px] disabled:opacity-50">{{ submitting ? 'Sending…' : 'Resend email' }}</button>
        <button @click="awaitingConfirmation = false" class="w-full py-3 mt-2 text-[14px] font-semibold text-[var(--color-text-muted)]">Wrong email? Go back</button>
      </div>

      <!-- Success -->
      <div v-else-if="success" class="pt-20 text-center">
        <div class="w-16 h-16 rounded-full bg-[#2b8659] flex items-center justify-center mx-auto mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-2xl font-bold mb-2">Application Submitted</h2>
        <p class="text-[var(--color-text-muted)] text-[14px]">{{ DEMO_MODE ? 'Redirecting to dashboard...' : 'We\'ll review your application and get back to you.' }}</p>
      </div>

      <!-- Form -->
      <template v-else>
        <h1 class="text-[28px] font-bold leading-tight mb-2">Drive with RideUp</h1>
        <p class="text-[var(--color-text-muted)] text-[14px] mb-6">Fill out your details to apply</p>

        <div class="space-y-5">
          <!-- Personal Info -->
          <div>
            <h2 class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Personal Info</h2>
            <div class="space-y-3">
              <label class="block">
                <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Full name</span>
                <input v-model="form.name" type="text" autocomplete="name"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
              <label class="block">
                <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Email address</span>
                <input v-model="form.email" type="email" autocomplete="email" :readonly="hasAccount" :aria-readonly="hasAccount"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
              <label class="block">
                <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Phone number</span>
                <input v-model="form.phone" type="tel" placeholder="242 555 1234" autocomplete="tel"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
              <label v-if="!hasAccount" class="block">
                <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Create a password</span>
                <input v-model="password" type="password" :placeholder="`At least ${MIN_PASSWORD} characters`" autocomplete="new-password"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
            </div>
          </div>

          <!-- Vehicle Info -->
          <div>
            <h2 class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Vehicle Info</h2>
            <div class="space-y-3">
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Make</span>
                  <input v-model="form.vehicleMake" type="text" placeholder="e.g. Toyota"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
                <label class="block">
                  <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Model</span>
                  <input v-model="form.vehicleModel" type="text" placeholder="e.g. Corolla"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Year</span>
                  <input v-model="form.vehicleYear" type="number" inputmode="numeric" min="1990" :max="maxYear" placeholder="e.g. 2019"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
                <label class="block">
                  <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Colour</span>
                  <input v-model="form.vehicleColor" type="text" placeholder="e.g. Silver"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
              </div>
              <label class="block">
                <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Licence plate</span>
                <input v-model="form.vehiclePlate" type="text" placeholder="e.g. AB 1234"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)] uppercase" />
              </label>
              <label class="block">
                <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Vehicle type</span>
                <select v-model="form.vehicleType"
                        class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all text-[var(--color-text-primary)]">
                  <option value="standard">Standard (4 seats)</option>
                  <option value="xl">XL (6 seats)</option>
                </select>
              </label>
            </div>
          </div>

          <!-- License -->
          <div>
            <h2 class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Licence</h2>
            <label class="block">
              <span class="block text-[13px] font-medium text-[var(--color-text-secondary)] mb-1.5">Driver’s licence number</span>
              <input v-model="form.licenseNumber" type="text" 
                     class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
            </label>
          </div>
        </div>

        <p v-if="error" class="text-[var(--color-danger)] text-[13px] mt-4" role="alert">{{ error }}</p>

        <button @click="handleSubmit" :disabled="submitting"
                class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mt-6 mb-4 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(43,134,89,0.3)] disabled:opacity-50 disabled:shadow-none">
          {{ submitting ? 'Submitting...' : 'Submit Application' }}
        </button>

        <p class="text-[12px] text-[var(--color-text-muted)] text-center pb-8 leading-relaxed">
          By applying, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
        </p>
      </template>
    </div>
  </div>
</template>
