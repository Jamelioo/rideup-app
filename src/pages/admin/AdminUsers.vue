<template>
  <div>
    <h1 class="text-2xl font-bold text-[var(--color-text-primary)] mb-6">User Management</h1>

    <!-- Search + filter -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div class="flex gap-1 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] p-1">
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
      <input
        v-model="search"
        type="text"
        placeholder="Search users..."
        class="px-3 py-2 text-sm border border-[var(--color-border)] rounded-lg bg-[var(--color-surface)] focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 focus:border-[#2b8659] w-full sm:w-64"
      />
    </div>

    <!-- Table -->
    <div class="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-[var(--color-text-muted)] text-xs uppercase tracking-wider bg-[var(--color-surface-secondary)]">
              <th class="px-4 py-3 font-medium">Name</th>
              <th class="px-4 py-3 font-medium">Email</th>
              <th class="px-4 py-3 font-medium">Phone</th>
              <th class="px-4 py-3 font-medium">Rides</th>
              <th class="px-4 py-3 font-medium">Rating</th>
              <th class="px-4 py-3 font-medium">Joined</th>
              <th class="px-4 py-3 font-medium">Status</th>
              <th class="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="user in filteredUsers"
              :key="user.id"
              class="border-t border-[var(--color-border)] hover:bg-[var(--color-surface-secondary)] transition-colors"
            >
              <td class="px-4 py-3 text-[var(--color-text-primary)] font-medium">{{ user.name }}</td>
              <td class="px-4 py-3 text-[var(--color-text-muted)]">{{ user.email }}</td>
              <td class="px-4 py-3 text-[var(--color-text-muted)]">{{ user.phone }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)]">{{ user.rides }}</td>
              <td class="px-4 py-3 text-[var(--color-text-primary)]">{{ user.rating.toFixed(1) }}</td>
              <td class="px-4 py-3 text-[var(--color-text-muted)] text-xs">{{ user.joined }}</td>
              <td class="px-4 py-3">
                <span :class="user.status === 'Active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'" class="text-xs font-medium px-2 py-0.5 rounded-full">
                  {{ user.status }}
                </span>
              </td>
              <td class="px-4 py-3">
                <button
                  @click="toggleUserStatus(user)"
                  :class="[
                    'text-xs font-medium px-3 py-1.5 rounded-lg transition-colors',
                    user.status === 'Active'
                      ? 'text-red-600 bg-red-50 hover:bg-red-100'
                      : 'text-[#2b8659] bg-green-50 hover:bg-green-100'
                  ]"
                >
                  {{ user.status === 'Active' ? 'Suspend' : 'Unsuspend' }}
                </button>
              </td>
            </tr>
            <tr v-if="filteredUsers.length === 0">
              <td colspan="8" class="px-4 py-8 text-center text-[var(--color-text-muted)]">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="users.length === 0" class="px-4 py-12 text-center text-[var(--color-text-muted)]">
      <p class="text-lg font-medium mb-1">No users yet</p>
      <p class="text-sm">Users will appear here when riders sign up.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const filterTabs = ['All', 'Active', 'Suspended']
const activeFilter = ref('All')
const search = ref('')

const users = ref([])

const filteredUsers = computed(() => {
  let list = users.value
  if (activeFilter.value !== 'All') {
    list = list.filter(u => u.status === activeFilter.value)
  }
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    list = list.filter(u =>
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.phone.includes(q)
    )
  }
  return list
})

function toggleUserStatus(user) {
  user.status = user.status === 'Active' ? 'Suspended' : 'Active'
}

onMounted(async () => {
  if (!supabaseConfigured) return
  try {
    const { data, error } = await supabase
      .from('riders')
      .select('*')
      .order('created_at', { ascending: false })

    if (!error && data) {
      users.value = data.map(r => ({
        id: r.id,
        name: r.name || 'Unknown',
        email: r.email || '',
        phone: r.phone || '-',
        rides: r.total_rides || 0,
        rating: r.rating || 0,
        joined: r.created_at ? r.created_at.split('T')[0] : '-',
        status: 'Active',
      }))
    }
  } catch (e) { /* keep empty */ }
})
</script>
