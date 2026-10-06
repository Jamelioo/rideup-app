<script setup>
import { ref, computed } from 'vue'

// "Who's riding?": book for yourself or for someone else (a parent, a friend, a hotel guest). The driver sees
// the passenger's name and phone, and the passenger gets the driver's details by text.
const model = defineModel({ type: Object, default: null }) // null = me, or { name, phone }
const open = ref(false)
const mode = ref('me')
const name = ref('')
const phone = ref('')
const error = ref('')

const label = computed(() => (model.value ? `For ${model.value.name.split(' ')[0]}` : 'For me'))

function show() {
  mode.value = model.value ? 'other' : 'me'
  name.value = model.value?.name || ''
  phone.value = model.value?.phone || ''
  error.value = ''
  open.value = true
}

function done() {
  if (mode.value === 'me') { model.value = null; open.value = false; return }
  const n = name.value.trim()
  const digits = phone.value.replace(/\D/g, '')
  if (n.length < 2) { error.value = 'Enter the passenger’s name.'; return }
  if (digits.length < 7 || digits.length > 15) { error.value = 'Enter a phone number the driver can call.'; return }
  model.value = { name: n, phone: phone.value.trim() }
  open.value = false
}
</script>

<template>
  <button type="button" @click="show"
          class="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)] mb-2 px-1 w-full text-left"
          :aria-label="model ? `Riding: ${model.name}. Change` : 'Riding: me. Book for someone else'">
    <svg class="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    <span class="flex-1 truncate" :class="model && 'text-[var(--color-text-primary)] font-semibold'">{{ label }}<span v-if="model" class="font-normal text-[var(--color-text-muted)]"> · {{ model.phone }}</span></span>
    <span class="text-[var(--color-brand)] font-semibold">{{ model ? 'Change' : 'Someone else?' }}</span>
  </button>

  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-[120] flex items-end md:items-center justify-center bg-[var(--color-overlay)]" @click.self="open = false">
        <div v-modal="() => (open = false)" role="dialog" aria-modal="true" aria-labelledby="who-title"
             class="w-full max-w-md bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-t-3xl md:rounded-3xl px-6 pt-7 pb-[max(2rem,env(safe-area-inset-bottom))] shadow-xl">
          <h3 id="who-title" class="text-lg font-bold mb-4">Who’s riding?</h3>
          <div class="space-y-2 mb-4" role="radiogroup" aria-labelledby="who-title">
            <label class="flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer" :class="mode === 'me' ? 'border-[#2b8659]' : 'border-[var(--color-border)]'">
              <input type="radio" v-model="mode" value="me" class="w-4 h-4" /> <span class="font-semibold text-[15px]">Me</span>
            </label>
            <label class="flex items-center gap-3 rounded-xl border-2 px-4 py-3 cursor-pointer" :class="mode === 'other' ? 'border-[#2b8659]' : 'border-[var(--color-border)]'">
              <input type="radio" v-model="mode" value="other" class="w-4 h-4" /> <span class="font-semibold text-[15px]">Someone else</span>
            </label>
          </div>
          <div v-if="mode === 'other'" class="space-y-3 mb-4">
            <label class="block text-[13px] font-semibold">Passenger’s name
              <input v-model="name" autocomplete="off" maxlength="60" placeholder="Mary Smith"
                     class="mt-1 w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] font-normal" />
            </label>
            <label class="block text-[13px] font-semibold">Passenger’s phone
              <input v-model="phone" type="tel" inputmode="tel" autocomplete="off" maxlength="20" placeholder="242 555 1234"
                     class="mt-1 w-full px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[16px] font-normal" />
            </label>
            <p class="text-[12px] text-[var(--color-text-muted)]">The driver sees their name and can call them. We text them the driver, car and a link to follow the trip. You pay, and the receipt comes to you.</p>
          </div>
          <p v-if="error" class="text-[13px] text-[var(--color-danger)] mb-3" role="alert">{{ error }}</p>
          <button @click="done" class="w-full py-3.5 bg-[#2b8659] text-white font-bold rounded-xl text-[15px]">Done</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
