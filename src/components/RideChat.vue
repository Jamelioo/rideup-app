<script setup>
import { ref, nextTick, watch, onMounted, onUnmounted } from 'vue'
import QuickMessages from './QuickMessages.vue'
import { supabase, supabaseConfigured } from '../lib/supabase'

const props = defineProps({
  rideId: { type: String, required: true },
  currentUserId: { type: String, default: '' },
  otherUserName: { type: String, default: 'Driver' },
})

const emit = defineEmits(['close'])

const isOpen = ref(false)
const messages = ref([])
const draft = ref('')
const hasUnread = ref(false)
const messageListEl = ref(null)

let subscription = null

// Toggle the chat sheet
function toggle() {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    hasUnread.value = false
    nextTick(scrollToBottom)
  }
}

function close() {
  isOpen.value = false
  emit('close')
}

function scrollToBottom() {
  if (messageListEl.value) {
    messageListEl.value.scrollTop = messageListEl.value.scrollHeight
  }
}

// Send a message (used by both text input and quick chips)
async function sendMessage(text) {
  const content = (typeof text === 'string' ? text : draft.value).trim()
  if (!content) return

  const msg = {
    id: Date.now().toString(),
    ride_id: props.rideId,
    sender_id: props.currentUserId,
    content,
    created_at: new Date().toISOString(),
  }

  messages.value.push(msg)
  draft.value = ''
  await nextTick(scrollToBottom)

  // Persist to Supabase
  if (supabaseConfigured) {
    try {
      await supabase.from('ride_messages').insert({
        ride_id: msg.ride_id,
        sender_id: msg.sender_id,
        content: msg.content,
      })
    } catch (err) {
      console.warn('Failed to persist message:', err)
    }
  }
}

// Load existing messages
async function loadMessages() {
  if (!supabaseConfigured) return
  try {
    const { data } = await supabase
      .from('ride_messages')
      .select('*')
      .eq('ride_id', props.rideId)
      .order('created_at', { ascending: true })
    if (data) {
      messages.value = data
      await nextTick(scrollToBottom)
    }
  } catch (err) {
    console.warn('Failed to load messages:', err)
  }
}

// Subscribe to new messages via Supabase Realtime
function subscribeToMessages() {
  if (!supabaseConfigured) return
  try {
    subscription = supabase
      .channel(`ride-chat-${props.rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_messages',
          filter: `ride_id=eq.${props.rideId}`,
        },
        (payload) => {
          const incoming = payload.new
          // Skip if we already have this message locally
          const exists = messages.value.some(
            (m) => m.id === incoming.id || (m.content === incoming.content && m.sender_id === incoming.sender_id && Math.abs(new Date(m.created_at) - new Date(incoming.created_at)) < 2000)
          )
          if (!exists) {
            messages.value.push(incoming)
            if (!isOpen.value) {
              hasUnread.value = true
            }
            nextTick(scrollToBottom)
          }
        }
      )
      .subscribe()
  } catch (err) {
    console.warn('Failed to subscribe to messages:', err)
  }
}

onMounted(() => {
  loadMessages()
  subscribeToMessages()
})

onUnmounted(() => {
  if (subscription) {
    supabase.removeChannel(subscription)
  }
})

// Expose toggle for parent components
defineExpose({ toggle, hasUnread })
</script>

<template>
  <!-- Floating chat bubble button -->
  <button
    v-if="!isOpen"
    @click="toggle"
    class="fixed bottom-28 right-5 z-40 w-14 h-14 rounded-full bg-[#2b8659] text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
    aria-label="Open chat"
  >
    <!-- Unread indicator -->
    <span
      v-if="hasUnread"
      class="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"
    ></span>
    <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  </button>

  <!-- Bottom sheet chat overlay -->
  <Transition name="slide-up">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex flex-col">
      <!-- Backdrop -->
      <div class="flex-shrink-0 bg-black/30" @click="close" style="height: 15vh"></div>

      <!-- Chat sheet -->
      <div class="flex-1 flex flex-col bg-[var(--color-surface)] rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.15)] overflow-hidden">
        <!-- Header -->
        <div class="flex items-center gap-3 px-5 pt-5 pb-3 border-b border-[#191f1c]/6">
          <div class="flex justify-center w-full absolute left-0 top-3 pointer-events-none">
            <div class="w-10 h-1 rounded-full bg-[#191f1c]/10"></div>
          </div>
          <button @click="close" class="w-9 h-9 rounded-full bg-[#191f1c]/5 flex items-center justify-center" aria-label="Close chat">
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4 text-[var(--color-text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div class="flex-1">
            <div class="font-bold text-[15px] text-[var(--color-text-primary)]">{{ otherUserName }}</div>
            <div class="text-[11px] text-[var(--color-text-muted)]">In-ride chat</div>
          </div>
        </div>

        <!-- Quick message chips -->
        <div class="px-4 pt-3">
          <QuickMessages @send="sendMessage" />
        </div>

        <!-- Messages list -->
        <div ref="messageListEl" class="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          <div v-if="messages.length === 0" class="text-center text-[13px] text-[#191f1c]/30 pt-10">
            No messages yet. Send a quick message or type below.
          </div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex"
            :class="msg.sender_id === currentUserId ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[75%] px-4 py-2.5 rounded-2xl text-[13px] leading-snug"
              :class="msg.sender_id === currentUserId
                ? 'bg-[#2b8659] text-white rounded-br-sm'
                : 'bg-[#191f1c]/6 text-[var(--color-text-primary)] rounded-bl-sm'"
            >
              {{ msg.content }}
            </div>
          </div>
        </div>

        <!-- Input bar -->
        <div class="px-4 pb-6 pt-3 border-t border-[#191f1c]/6 flex items-center gap-2 bg-[var(--color-surface)]">
          <input
            v-model="draft"
            @keyup.enter="sendMessage(draft)"
            type="text"
            placeholder="Type a message..."
            class="flex-1 bg-[#191f1c]/[0.04] rounded-full px-4 py-2.5 text-[13px] outline-none placeholder:text-[#191f1c]/35 font-sans"
          />
          <button
            @click="sendMessage(draft)"
            class="w-10 h-10 rounded-full bg-[#2b8659] text-white flex items-center justify-center flex-shrink-0 active:opacity-80 transition-opacity"
            aria-label="Send message"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
