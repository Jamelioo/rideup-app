<template>
  <div>
    <h1 class="text-2xl font-bold text-[#191f1c] mb-6">Support Tickets</h1>

    <!-- Filter tabs -->
    <div class="flex gap-1 bg-white rounded-lg border border-gray-200 p-1 mb-4 w-fit">
      <button
        v-for="tab in filterTabs"
        :key="tab"
        @click="activeFilter = tab"
        :class="[
          'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
          activeFilter === tab
            ? 'bg-[#2b8659] text-white'
            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
        ]"
      >
        {{ tab }}
      </button>
    </div>

    <!-- Ticket list -->
    <div class="space-y-3">
      <div
        v-for="ticket in filteredTickets"
        :key="ticket.id"
        class="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
      >
        <!-- Header row (clickable) -->
        <button
          class="w-full flex items-center justify-between px-5 py-4 text-left"
          @click="toggle(ticket.id)"
        >
          <div class="flex items-center gap-4 min-w-0">
            <span class="text-xs text-gray-400 font-mono">#{{ ticket.id }}</span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-[#191f1c] truncate">{{ ticket.subject }}</p>
              <p class="text-xs text-gray-400">{{ ticket.user }} -- {{ ticket.date }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span :class="ticketStatusBadge(ticket.status)">{{ ticket.status }}</span>
            <svg
              :class="['w-4 h-4 text-gray-400 transition-transform', expanded === ticket.id ? 'rotate-180' : '']"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </button>

        <!-- Expanded detail -->
        <div v-if="expanded === ticket.id" class="px-5 pb-5 border-t border-gray-100 pt-4">
          <p class="text-sm text-gray-600 leading-relaxed mb-4">{{ ticket.message }}</p>
          <div class="flex gap-2">
            <button
              v-if="ticket.status !== 'Resolved'"
              @click="ticket.status = 'In Progress'"
              class="text-xs font-medium px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
            >
              Mark In Progress
            </button>
            <button
              v-if="ticket.status !== 'Resolved'"
              @click="ticket.status = 'Resolved'"
              class="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#2b8659] text-white hover:bg-[#236e49] transition-colors"
            >
              Resolve
            </button>
            <button
              v-if="ticket.status === 'Resolved'"
              @click="ticket.status = 'Open'"
              class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              Reopen
            </button>
          </div>
        </div>
      </div>

      <p v-if="filteredTickets.length === 0" class="text-center text-gray-400 py-8">No tickets found.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const filterTabs = ['All', 'Open', 'In Progress', 'Resolved']
const activeFilter = ref('All')
const expanded = ref(null)

const tickets = ref([
  { id: 301, subject: 'Driver did not arrive at pickup', user: 'Marcus Thompson', date: '2026-09-27', status: 'Open', message: 'I booked a ride from Atlantis Resort to Downtown Nassau. The driver accepted but never showed up. I waited 15 minutes before cancelling. I was charged a cancellation fee which I believe is unfair since the driver was at fault.' },
  { id: 300, subject: 'Overcharged for ride', user: 'Crystal Johnson', date: '2026-09-27', status: 'Open', message: 'My ride from Montagu Beach to Fish Fry was quoted at $10 but I was charged $12.50. The driver took a slightly different route but it was shorter. Please review the fare calculation.' },
  { id: 299, subject: 'Left item in vehicle', user: 'Devon Clarke', date: '2026-09-26', status: 'In Progress', message: 'I left my laptop bag in the backseat of my ride from Bay Street to Paradise Island. The driver was Andre Bain in a black Nissan Altima. I have tried contacting through the app but no response.' },
  { id: 298, subject: 'App crash during ride booking', user: 'Tanya Rolle', date: '2026-09-26', status: 'Resolved', message: 'The app kept crashing when I tried to set my destination to Cable Beach. I restarted my phone and it worked fine after that. Just wanted to report the issue.' },
  { id: 297, subject: 'Driver was rude and unprofessional', user: 'Lisa Ferguson', date: '2026-09-25', status: 'Open', message: 'The driver was on a personal phone call the entire ride and was driving aggressively. When I asked him to slow down he got annoyed. Very uncomfortable experience. Ride was from Junkanoo Beach to Cable Beach.' },
  { id: 296, subject: 'Payment not processed correctly', user: 'Andre Davis', date: '2026-09-25', status: 'In Progress', message: 'I was double-charged for a ride on September 24th. I see two charges of $24.00 on my bank statement for the same trip from Baha Mar to Downtown Nassau. Please refund the duplicate charge.' },
  { id: 295, subject: 'Cannot update phone number', user: 'Keisha Brown', date: '2026-09-24', status: 'Resolved', message: 'I changed my phone number and cannot update it in my profile. The edit profile page shows an error when I try to save. I need this updated so drivers can contact me.' },
  { id: 294, subject: 'Driver took wrong route', user: 'Robert Sands', date: '2026-09-23', status: 'Resolved', message: 'The driver took a much longer route from Fort Charlotte to PI Airport which increased my fare significantly. I believe the fare should be recalculated based on the optimal route.' },
])

function toggle(id) {
  expanded.value = expanded.value === id ? null : id
}

const filteredTickets = computed(() => {
  if (activeFilter.value === 'All') return tickets.value
  return tickets.value.filter(t => t.status === activeFilter.value)
})

function ticketStatusBadge(status) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap'
  switch (status) {
    case 'Open': return `${base} bg-red-50 text-red-700`
    case 'In Progress': return `${base} bg-yellow-50 text-yellow-700`
    case 'Resolved': return `${base} bg-green-50 text-green-700`
    default: return `${base} bg-gray-50 text-gray-700`
  }
}

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false })
    if (!error && data && data.length > 0) {
      tickets.value = data.map(t => ({
        id: t.id,
        subject: t.subject || 'No subject',
        user: t.user_name || 'Unknown',
        date: t.created_at ? t.created_at.split('T')[0] : 'N/A',
        status: t.status || 'Open',
        message: t.message || '',
      }))
    }
  } catch (e) { /* keep placeholder data */ }
})
</script>
