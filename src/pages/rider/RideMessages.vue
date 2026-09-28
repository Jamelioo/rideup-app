<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import QuickMessages from '../../components/QuickMessages.vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'

const route = useRoute()
const router = useRouter()
const { user } = useAuth()

const rideId = route.params.rideId
const driverName = ref(route.query.driverName || 'Your Driver')

const messages = ref([])
const draft = ref('')
const messageListEl = ref(null)

let subscription = null

const currentUserId = ref('')

function scrollToBottom() {
  if (messageListEl.value) {
    messageListEl.value.scrollTop = messageListEl.value.scrollHeight
  }
}

async function sendMessage(text) {
  const content = (typeof text === 'string' ? text : draft.value).trim()
  if (!content) return

  const msg = {
    id: Date.now().toString(),
    ride_id: rideId,
    sender_id: currentUserId.value,
    content,
    created_at: new Date().toISOString(),
  }

  messages.value.push(msg)
  draft.value = ''
  await nextTick(scrollToBottom)

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

async function loadMessages() {
  if (!supabaseConfigured) return
  try {
    const { data } = await supabase
      .from('ride_messages')
      .select('*')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true })
    if (data) {
      messages.value = data
      await nextTick(scrollToBottom)
    }
  } catch (err) {
    console.warn('Failed to load messages:', err)
  }
}

function subscribeToMessages() {
  if (!supabaseConfigured) return
  try {
    subscription = supabase
      .channel(`ride-chat-full-${rideId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ride_messages',
          filter: `ride_id=eq.${rideId}`,
        },
        (payload) => {
          const incoming = payload.new
          const exists = messages.value.some(
            (m) => m.id === incoming.id || (m.content === incoming.content && m.sender_id === incoming.sender_id && Math.abs(new Date(m.created_at) - new Date(incoming.created_at)) < 2000)
          )
          if (!exists) {
            messages.value.push(incoming)
            nextTick(scrollToBottom)
          }
        }
      )
      .subscribe()
  } catch (err) {
    console.warn('Failed to subscribe to messages:', err)
  }
}

function goBack() {
  router.push({ name: 'active-ride', params: { rideId } })
}

onMounted(() => {
  currentUserId.value = user.value?.id || 'demo-rider'
  loadMessages()
  subscribeToMessages()
})

onUnmounted(() => {
  if (subscription) {
    supabase.removeChannel(subscription)
  }
})
</script>

<template>
  <div class="fixed inset-0 bg-white text-[#191f1c] flex flex-col font-sans">
    <!-- Header -->
    <div class="bg-[#2b8659] px-5 pt-10 pb-4 flex items-center gap-3 flex-shrink-0">
      <button
        @click="goBack"
        class="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white"
        aria-label="Back to ride"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <div class="w-9 h-9 rounded-full bg-white/25 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
        {{ driverName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="text-white font-bold text-[15px] truncate">{{ driverName }}</div>
        <div class="text-white/60 text-[11px]">Your driver</div>
      </div>
    </div>

    <!-- Quick message chips -->
    <div class="px-4 pt-3 pb-1 border-b border-[#191f1c]/6 flex-shrink-0">
      <QuickMessages @send="sendMessage" />
    </div>

    <!-- Messages list -->
    <div ref="messageListEl" class="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
      <div v-if="messages.length === 0" class="text-center text-[13px] text-[#191f1c]/30 pt-16">
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
            : 'bg-[#191f1c]/6 text-[#191f1c] rounded-bl-sm'"
        >
          {{ msg.content }}
        </div>
      </div>
    </div>

    <!-- Input bar -->
    <div class="px-4 pb-8 pt-3 border-t border-[#191f1c]/6 flex items-center gap-2 bg-white flex-shrink-0">
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
</template>
