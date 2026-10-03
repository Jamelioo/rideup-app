<script setup>
import { computed } from 'vue'
import { useRouter } from 'vue-router'

// Driver dashboard: licence or insurance expiring within 30 days (or expired). Dates are recorded by RideUp
// when it reviews the documents; reminders also go out by push and email.
const props = defineProps({ driver: { type: Object, default: null } })
const router = useRouter()
const LABEL = { license: 'Driver’s licence', insurance: 'Insurance' }

const items = computed(() => {
  if (!props.driver) return []
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Nassau' })
  return ['license', 'insurance'].map((doc) => {
    const expires = props.driver[`${doc}_expires_on`]
    if (!expires) return null
    const days = Math.round((new Date(`${expires}T12:00:00`) - new Date(`${today}T12:00:00`)) / 86_400_000)
    if (days > 30) return null
    const when = new Date(`${expires}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { doc, days, text: days < 0 ? `${LABEL[doc]} expired on ${when}` : days === 0 ? `${LABEL[doc]} expires today` : `${LABEL[doc]} expires ${when} (${days} day${days === 1 ? '' : 's'})` }
  }).filter(Boolean)
})
const expired = computed(() => items.value.some((i) => i.days < 0))
</script>

<template>
  <div v-if="items.length" role="alert" class="rounded-2xl px-4 py-3 mb-4 text-[13px]"
       :class="expired ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-amber-500/15 text-[var(--color-text-primary)]'">
    <p v-for="i in items" :key="i.doc" class="font-semibold">{{ i.text }}</p>
    <p class="mt-0.5">{{ expired ? 'You can’t go online until we’ve checked the new document.' : 'Upload the renewed document now so you can keep driving without a break.' }}</p>
    <button @click="router.push('/driver/documents')" class="mt-2 font-bold underline underline-offset-2">Upload document</button>
  </div>
</template>
