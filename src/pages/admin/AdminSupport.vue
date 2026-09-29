<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">Support Tickets</h1>

    <!-- Filter tabs -->
    <div class="flex gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1 mb-4 w-fit">
      <button
        v-for="tab in filterTabs"
        :key="tab"
        @click="activeFilter = tab"
        :class="[
          'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
          activeFilter === tab
            ? 'bg-[#2b8659] text-white'
            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-secondary)]'
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
        class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden hover:shadow-sm transition-shadow"
      >
        <!-- Header row (clickable) -->
        <button
          class="w-full flex items-center justify-between px-5 py-4 text-left"
          @click="toggle(ticket.id)"
        >
          <div class="flex items-center gap-4 min-w-0">
            <span class="text-xs text-[var(--color-text-muted)] font-mono">#{{ ticket.id }}</span>
            <div class="min-w-0">
              <p class="text-sm font-medium text-[var(--color-text-primary)] truncate">{{ ticket.subject }}</p>
              <p class="text-xs text-[var(--color-text-muted)]">{{ ticket.user }} -- {{ ticket.date }}</p>
            </div>
          </div>
          <div class="flex items-center gap-3 flex-shrink-0">
            <span :class="ticketStatusBadge(ticket.status)">{{ ticket.status }}</span>
            <svg
              :class="['w-4 h-4 text-[var(--color-text-muted)] transition-transform', expanded === ticket.id ? 'rotate-180' : '']"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
            </svg>
          </div>
        </button>

        <!-- Expanded detail -->
        <div v-if="expanded === ticket.id" class="px-5 pb-5 border-t border-[var(--color-border)] pt-4">
          <p class="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-4">{{ ticket.message }}</p>
          <div class="flex gap-2">
            <button
              v-if="ticket.status !== 'Resolved' && ticket.status !== 'resolved'"
              @click="updateTicketStatus(ticket, 'In Progress')"
              class="text-xs font-medium px-3 py-1.5 rounded-lg bg-yellow-50 text-yellow-700 hover:bg-yellow-100 transition-colors"
            >
              Mark In Progress
            </button>
            <button
              v-if="ticket.status !== 'Resolved' && ticket.status !== 'resolved'"
              @click="updateTicketStatus(ticket, 'resolved')"
              class="text-xs font-medium px-3 py-1.5 rounded-lg bg-[#2b8659] text-white hover:bg-[#236e49] transition-colors"
            >
              Resolve
            </button>
            <button
              v-if="ticket.status === 'Resolved' || ticket.status === 'resolved'"
              @click="updateTicketStatus(ticket, 'open')"
              class="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
            >
              Reopen
            </button>
          </div>
        </div>
      </div>

      <p v-if="filteredTickets.length === 0" class="text-center text-[var(--color-text-muted)] py-8">No tickets found.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const filterTabs = ['All', 'Open', 'In Progress', 'Resolved']
const activeFilter = ref('All')
const expanded = ref(null)

const tickets = ref([])

function toggle(id) {
  expanded.value = expanded.value === id ? null : id
}

const filteredTickets = computed(() => {
  if (activeFilter.value === 'All') return tickets.value
  return tickets.value.filter(t => t.status === activeFilter.value)
})

function ticketStatusBadge(status) {
  const base = 'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap'
  const s = (status || '').toLowerCase()
  if (s === 'open') return `${base} bg-red-50 text-red-700`
  if (s === 'in progress') return `${base} bg-yellow-50 text-yellow-700`
  if (s === 'resolved') return `${base} bg-green-50 text-green-700`
  return `${base} bg-[var(--color-surface-secondary)] text-[var(--color-text-secondary)]`
}

async function updateTicketStatus(ticket, newStatus) {
  if (supabaseConfigured) {
    await supabase.from('support_tickets').update({ status: newStatus }).eq('id', ticket.id)
  }
  ticket.status = newStatus
}

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      tickets.value = data.map(t => ({
        id: t.id,
        subject: t.subject || 'No subject',
        description: t.description || '',
        status: t.status || 'open',
        created: t.created_at ? new Date(t.created_at).toLocaleDateString() : '-',
        user: t.user_id || 'Unknown',
        message: t.description || '',
        date: t.created_at ? new Date(t.created_at).toLocaleDateString() : '-',
      }))
    }
  } catch (e) { /* keep empty */ }
})
</script>
