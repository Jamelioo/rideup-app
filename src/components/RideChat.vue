<script setup>
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import QuickMessages from './QuickMessages.vue'
import { supabase, supabaseConfigured } from '../lib/supabase'

// In-trip chat between rider and driver (Uber-style). The parent controls visibility with v-model:open
// and gets `unread` updates so it can badge its Message button.
const props = defineProps({
  rideId: { type: String, required: true },
  currentUserId: { type: String, default: '' },
  otherUserName: { type: String, default: 'Driver' },
  open: { type: Boolean, default: false },
  quickReplies: { type: Array, default: undefined },
  partnerRole: { type: String, default: 'driver' }, // 'driver' | 'rider'
})

const emit = defineEmits(['update:open', 'unread'])

const messages = ref([])
const draft = ref('')
const unread = ref(0)
const sendError = ref('')
const chatClosed = ref(false)
const messageListEl = ref(null)
let subscription = null

function close() {
  emit('update:open', false)
}

function scrollToBottom() {
  if (messageListEl.value) messageListEl.value.scrollTop = messageListEl.value.scrollHeight
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    unread.value = 0
    emit('unread', 0)
    await nextTick(scrollToBottom)
  }
})

async function sendMessage(text) {
  const content = (typeof text === 'string' ? text : draft.value).trim().slice(0, 500)
  if (!content || chatClosed.value) return
  sendError.value = ''

  const local = { id: `local-${Date.now()}`, ride_id: props.rideId, sender_id: props.currentUserId, content, created_at: new Date().toISOString(), pending: true }
  messages.value.push(local)
  draft.value = ''
  await nextTick(scrollToBottom)

  if (!supabaseConfigured) { local.pending = false; return }

  const { data, error } = await supabase
    .from('ride_messages')
    .insert({ ride_id: props.rideId, sender_id: props.currentUserId, content })
    .select()
    .single()

  const idx = messages.value.findIndex((m) => m.id === local.id)
  if (error) {
    // RLS refuses once the trip has ended (chat closes 30 minutes after drop-off).
    if (idx >= 0) messages.value[idx] = { ...local, pending: false, failed: true }
    sendError.value = error.code === '42501' || /row-level security/i.test(error.message)
      ? 'Chat for this trip has closed. Contact support if you need help.'
      : 'Message not sent. Check your connection and try again.'
    if (/closed/.test(sendError.value)) chatClosed.value = true
    return
  }
  if (idx >= 0) messages.value[idx] = data
}

async function loadMessages() {
  if (!supabaseConfigured) return
  const { data } = await supabase
    .from('ride_messages')
    .select('*')
    .eq('ride_id', props.rideId)
    .order('created_at', { ascending: true })
  if (data) {
    messages.value = data
    await nextTick(scrollToBottom)
  }
}

function subscribe() {
  if (!supabaseConfigured) return
  subscription = supabase
    .channel(`ride-chat-${props.rideId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${props.rideId}` }, (payload) => {
      const incoming = payload.new
      if (messages.value.some((m) => m.id === incoming.id)) return
      messages.value.push(incoming)
      if (incoming.sender_id !== props.currentUserId && !props.open) {
        unread.value++
        emit('unread', unread.value)
        if (navigator.vibrate) navigator.vibrate(120)
      }
      nextTick(scrollToBottom)
    })
    .subscribe()
}

onMounted(() => {
  loadMessages()
  subscribe()
})

onUnmounted(() => {
  if (subscription) supabase.removeChannel(subscription)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="slide-up">
      <div v-if="open" v-modal="close" class="fixed inset-0 z-[150] flex flex-col" role="dialog" aria-modal="true" :aria-label="`Chat with ${otherUserName}`">
        <div class="flex-shrink-0 bg-black/40" style="height: 12vh" @click="close"></div>

        <div class="flex-1 flex flex-col bg-[var(--color-surface)] text-[var(--color-text-primary)] rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] overflow-hidden">
          <div class="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-[var(--color-border)]">
            <button @click="close" class="w-11 h-11 rounded-full bg-[var(--color-surface-secondary)] flex items-center justify-center" aria-label="Close chat">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-[15px] truncate">{{ otherUserName }}</div>
              <div class="text-[12px] text-[var(--color-text-muted)]">Only your {{ partnerRole }} on this trip can see these messages</div>
            </div>
          </div>

          <div class="px-4 pt-3">
            <QuickMessages :messages="quickReplies" @send="sendMessage" />
          </div>

          <div ref="messageListEl" class="flex-1 overflow-y-auto px-5 py-4 space-y-2.5" aria-live="polite">
            <div v-if="messages.length === 0" class="text-center text-[13px] text-[var(--color-text-muted)] pt-10">
              No messages yet. Send a quick reply or type below.
            </div>
            <div v-for="msg in messages" :key="msg.id" class="flex" :class="msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'">
              <div class="max-w-[78%]">
                <div class="px-4 py-2.5 rounded-2xl text-[14px] leading-snug break-words"
                     :class="msg.sender_id === currentUserId
                       ? (msg.failed ? 'bg-red-500/15 text-[var(--color-danger)] dark:text-red-300 rounded-br-sm' : 'bg-[#2b8659] text-white rounded-br-sm')
                       : 'bg-[var(--color-surface-secondary)] text-[var(--color-text-primary)] rounded-bl-sm'">
                  {{ msg.content }}
                </div>
                <div v-if="msg.sender_id === currentUserId && (msg.pending || msg.failed)" class="text-[11px] text-right mt-0.5"
                     :class="msg.failed ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'">
                  {{ msg.failed ? 'Not sent' : 'Sending…' }}
                </div>
              </div>
            </div>
          </div>

          <p v-if="sendError" class="px-5 pb-2 text-[13px] text-[var(--color-danger)]" role="alert">{{ sendError }}</p>

          <div class="px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 border-t border-[var(--color-border)] flex items-center gap-2">
            <input
              v-model="draft"
              @keyup.enter="sendMessage(draft)"
              type="text"
              maxlength="500"
              :disabled="chatClosed"
              :placeholder="chatClosed ? 'Chat closed' : 'Type a message…'"
              aria-label="Message"
              class="flex-1 bg-[var(--color-surface-secondary)] rounded-full px-4 py-3 text-[15px] outline-none placeholder:text-[var(--color-text-muted)] disabled:opacity-60"
            />
            <button
              @click="sendMessage(draft)"
              :disabled="chatClosed || !draft.trim()"
              class="w-11 h-11 rounded-full bg-[#2b8659] text-white flex items-center justify-center flex-shrink-0 disabled:opacity-40"
              aria-label="Send message"
            >
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active { transition: transform 0.3s ease, opacity 0.3s ease; }
.slide-up-enter-from,
.slide-up-leave-to { transform: translateY(100%); opacity: 0; }
</style>
