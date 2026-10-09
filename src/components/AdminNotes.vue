<script setup>
import { ref, watch } from 'vue'
import { supabase, supabaseConfigured } from '../lib/supabase'
import { DEMO_MODE } from '../lib/demoMode'
import { useAuth } from '../lib/useAuth'
import { useStaffRole } from '../lib/staff'

// Private team notes on a rider, driver or ride ("Called about the late pickup"). Riders and drivers never see
// them. The author is stamped by the database.
const props = defineProps({
  subjectType: { type: String, required: true }, // 'rider' | 'driver' | 'ride'
  subjectId: { type: String, required: true },
})

const { user } = useAuth()
const { isAdmin } = useStaffRole()
const notes = ref([])
const draft = ref('')
const busy = ref(false)
const error = ref('')
const loading = ref(false)

const when = (iso) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const author = (n) => (n.author_id && n.author_id === user.value?.id ? 'You' : (n.author_email || 'Team').split('@')[0])

async function load() {
  notes.value = []
  error.value = ''
  if (DEMO_MODE || !supabaseConfigured || !props.subjectId) return
  loading.value = true
  const { data, error: err } = await supabase
    .from('admin_notes')
    .select('id, body, author_id, author_email, created_at')
    .eq('subject_type', props.subjectType)
    .eq('subject_id', props.subjectId)
    .order('created_at', { ascending: false })
    .limit(50)
  loading.value = false
  if (err) error.value = /admin_notes/.test(err.message) ? 'Run database update 016 to use notes.' : 'Couldn’t load notes.'
  else notes.value = data || []
}
watch(() => props.subjectId, load, { immediate: true })

async function add() {
  const body = draft.value.trim()
  if (!body) return
  error.value = ''
  if (DEMO_MODE || !supabaseConfigured) {
    notes.value.unshift({ id: crypto.randomUUID(), body, author_id: user.value?.id, created_at: new Date().toISOString() })
    draft.value = ''
    return
  }
  busy.value = true
  const { data, error: err } = await supabase
    .from('admin_notes')
    .insert({ subject_type: props.subjectType, subject_id: props.subjectId, body })
    .select('id, body, author_id, author_email, created_at')
    .single()
  busy.value = false
  if (err) { error.value = 'Couldn’t save the note. Try again.'; return }
  notes.value.unshift(data)
  draft.value = ''
}

async function remove(note) {
  if (!window.confirm('Delete this note?')) return
  if (!DEMO_MODE && supabaseConfigured) {
    const { error: err } = await supabase.from('admin_notes').delete().eq('id', note.id)
    if (err) { error.value = 'Couldn’t delete the note.'; return }
  }
  notes.value = notes.value.filter((n) => n.id !== note.id)
}
</script>

<template>
  <section class="mb-5">
    <h3 class="font-semibold text-sm mb-2">Team notes</h3>
    <form @submit.prevent="add" class="mb-3">
      <label :for="`note-${subjectId}`" class="sr-only">Add a note</label>
      <textarea :id="`note-${subjectId}`" v-model="draft" rows="2" maxlength="2000" placeholder="Add a note only the team can see…"
                class="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] text-sm resize-y"></textarea>
      <div class="flex justify-end mt-1">
        <button type="submit" :disabled="busy || !draft.trim()" class="h-9 px-4 rounded-lg bg-[var(--color-text-primary)] text-[var(--color-surface)] text-sm font-semibold disabled:opacity-40">
          {{ busy ? 'Saving…' : 'Add note' }}
        </button>
      </div>
    </form>
    <p v-if="error" class="text-sm text-[var(--color-danger)] mb-2" role="alert">{{ error }}</p>
    <p v-if="loading" class="text-sm text-[var(--color-text-muted)]">Loading…</p>
    <ul v-else-if="notes.length" class="space-y-2">
      <li v-for="n in notes" :key="n.id" class="rounded-xl bg-[var(--color-surface-secondary)] p-3 text-sm">
        <p class="whitespace-pre-line break-words">{{ n.body }}</p>
        <div class="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--color-text-muted)]">
          <span>{{ author(n) }} · {{ when(n.created_at) }}</span>
          <button v-if="isAdmin || n.author_id === user?.id" @click="remove(n)" class="font-semibold hover:text-[var(--color-danger)]">Delete</button>
        </div>
      </li>
    </ul>
    <p v-else class="text-sm text-[var(--color-text-muted)]">No notes yet.</p>
  </section>
</template>
