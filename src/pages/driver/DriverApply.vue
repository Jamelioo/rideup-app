<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../../lib/useAuth'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { DEMO_MODE } from '../../lib/demoMode'

const router = useRouter()
const { user, signUp } = useAuth()

const form = ref({
  name: '', email: '', phone: '',
  vehicleMake: '', vehicleModel: '', vehicleYear: '',
  vehicleColor: '', vehiclePlate: '',
  vehicleType: 'standard', licenseNumber: '',
})
const password = ref('')
const error = ref('')
const submitting = ref(false)
const success = ref(false)

async function handleSubmit() {
  error.value = ''
  const f = form.value

  if (!f.name.trim() || !f.email.trim() || !f.phone.trim()) {
    error.value = 'Please fill in all personal details.'
    return
  }
  if (!f.vehicleMake.trim() || !f.vehicleModel.trim() || !f.vehiclePlate.trim()) {
    error.value = 'Please fill in all vehicle details.'
    return
  }
  if (!f.licenseNumber.trim()) {
    error.value = 'Please enter your driver\'s license number.'
    return
  }

  if (!user.value && password.value.length < 6) {
    error.value = 'Please create a password (at least 6 characters).'
    return
  }

  if (DEMO_MODE) {
    submitting.value = true
    await new Promise(r => setTimeout(r, 800))
    success.value = true
    setTimeout(() => router.push('/driver/dashboard'), 1500)
    return
  }

  submitting.value = true

  // Create account if not logged in
  if (!user.value && password.value.length >= 6) {
    const { error: authErr } = await signUp(f.email.trim(), password.value, f.name.trim())
    if (authErr) { error.value = authErr.message; submitting.value = false; return }
  }

  if (!supabaseConfigured) {
    error.value = 'Database not configured.'
    submitting.value = false
    return
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser()
  if (!currentUser) { error.value = 'Please log in first.'; submitting.value = false; return }

  const { error: insertErr } = await supabase.from('drivers').insert({
    auth_user_id: currentUser.id,
    name: f.name.trim(),
    phone: f.phone.trim(),
    email: f.email.trim(),
    vehicle_make: f.vehicleMake.trim(),
    vehicle_model: f.vehicleModel.trim(),
    vehicle_color: f.vehicleColor.trim(),
    license_plate: f.vehiclePlate.trim(),
    vehicle_year: parseInt(f.vehicleYear) || null,
    license_number: f.licenseNumber?.trim() || null,
    vehicle_type: f.vehicleType,
    approved: false,
  })

  submitting.value = false
  if (insertErr) { error.value = insertErr.message; return }
  success.value = true
  setTimeout(() => router.push('/driver/pending'), 2000)
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="min-h-screen bg-[var(--color-surface)] text-[var(--color-text-primary)] flex flex-col">
    <!-- Top bar -->
    <div class="flex items-center px-4 pt-[max(3rem,env(safe-area-inset-top))] pb-4">
      <button @click="goBack" class="w-10 h-10 flex items-center justify-center rounded-full active:bg-[#191f1c]/5">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </div>

    <div class="flex-1 px-6 w-full max-w-md mx-auto">
      <!-- Success -->
      <div v-if="success" class="pt-20 text-center">
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
            <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Personal Info</p>
            <div class="space-y-2">
              <label class="block">
                <span class="sr-only">Full name</span>
                <input v-model="form.name" type="text" placeholder="Full name" autocomplete="name"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
              <label class="block">
                <span class="sr-only">Email</span>
                <input v-model="form.email" type="email" placeholder="Email address" autocomplete="email"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
              <label class="block">
                <span class="sr-only">Phone</span>
                <input v-model="form.phone" type="tel" placeholder="Phone number" autocomplete="tel"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
              <label v-if="!user" class="block">
                <span class="sr-only">Password</span>
                <input v-model="password" type="password" placeholder="Create a password (min 6 chars)" autocomplete="new-password"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
              </label>
            </div>
          </div>

          <!-- Vehicle Info -->
          <div>
            <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Vehicle Info</p>
            <div class="space-y-2">
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="sr-only">Vehicle make</span>
                  <input v-model="form.vehicleMake" type="text" placeholder="Make (e.g. Toyota)"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
                <label class="block">
                  <span class="sr-only">Vehicle model</span>
                  <input v-model="form.vehicleModel" type="text" placeholder="Model (e.g. Camry)"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <label class="block">
                  <span class="sr-only">Vehicle year</span>
                  <input v-model="form.vehicleYear" type="number" placeholder="Year"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
                <label class="block">
                  <span class="sr-only">Vehicle color</span>
                  <input v-model="form.vehicleColor" type="text" placeholder="Color"
                         class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
                </label>
              </div>
              <label class="block">
                <span class="sr-only">License plate</span>
                <input v-model="form.vehiclePlate" type="text" placeholder="License plate number"
                       class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)] uppercase" />
              </label>
              <label class="block">
                <span class="sr-only">Vehicle type</span>
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
            <p class="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">License</p>
            <label class="block">
              <span class="sr-only">Driver's license number</span>
              <input v-model="form.licenseNumber" type="text" placeholder="Driver's license number"
                     class="w-full px-4 py-3.5 bg-[var(--color-surface-secondary)] rounded-xl border-2 border-transparent text-[15px] outline-none focus:border-[#2b8659] focus:bg-[var(--color-surface)] transition-all placeholder:text-[var(--color-text-muted)]" />
            </label>
          </div>
        </div>

        <p v-if="error" class="text-red-500 text-[13px] mt-4">{{ error }}</p>

        <button @click="handleSubmit" :disabled="submitting"
                class="w-full py-4 bg-[#2b8659] text-white font-bold rounded-2xl text-[15px] mt-6 mb-4 transition-all active:scale-[0.98] shadow-[0_4px_16px_rgba(88,204,2,0.3)] disabled:opacity-50 disabled:shadow-none">
          {{ submitting ? 'Submitting...' : 'Submit Application' }}
        </button>

        <p class="text-[12px] text-[#191f1c]/35 text-center pb-8 leading-relaxed">
          By applying, you agree to our <router-link to="/terms" class="underline">Terms of Service</router-link> and <router-link to="/privacy" class="underline">Privacy Policy</router-link>.
        </p>
      </template>
    </div>
  </div>
</template>
