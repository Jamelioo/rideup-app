<template>
  <div>
    <h1 class="text-2xl font-bold text-[#191f1c] mb-6">User Management</h1>

    <!-- Search + filter -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
      <div class="flex gap-1 bg-white rounded-lg border border-gray-200 p-1">
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
      <input
        v-model="search"
        type="text"
        placeholder="Search users..."
        class="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#2b8659]/30 focus:border-[#2b8659] w-full sm:w-64"
      />
    </div>

    <!-- Table -->
    <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-gray-400 text-xs uppercase tracking-wider bg-gray-50/50">
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
              class="border-t border-gray-100 hover:bg-gray-50/50 transition-colors"
            >
              <td class="px-4 py-3 text-[#191f1c] font-medium">{{ user.name }}</td>
              <td class="px-4 py-3 text-gray-500">{{ user.email }}</td>
              <td class="px-4 py-3 text-gray-500">{{ user.phone }}</td>
              <td class="px-4 py-3 text-[#191f1c]">{{ user.rides }}</td>
              <td class="px-4 py-3 text-[#191f1c]">{{ user.rating.toFixed(1) }}</td>
              <td class="px-4 py-3 text-gray-400 text-xs">{{ user.joined }}</td>
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
              <td colspan="8" class="px-4 py-8 text-center text-gray-400">No users found.</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { supabase, supabaseConfigured } from '../../lib/supabase'

const filterTabs = ['All', 'Active', 'Suspended']
const activeFilter = ref('All')
const search = ref('')

const users = ref([
  { id: 1, name: 'Marcus Thompson', email: 'marcus.t@gmail.com', phone: '(242) 555-0101', rides: 47, rating: 4.8, joined: '2026-03-15', status: 'Active' },
  { id: 2, name: 'Shania Williams', email: 'shania.w@outlook.com', phone: '(242) 555-0102', rides: 23, rating: 4.9, joined: '2026-04-22', status: 'Active' },
  { id: 3, name: 'Devon Clarke', email: 'devon.c@gmail.com', phone: '(242) 555-0103', rides: 65, rating: 4.7, joined: '2026-02-08', status: 'Active' },
  { id: 4, name: 'Tanya Rolle', email: 'tanya.r@yahoo.com', phone: '(242) 555-0104', rides: 12, rating: 4.5, joined: '2026-06-30', status: 'Active' },
  { id: 5, name: 'James Mitchell', email: 'james.m@gmail.com', phone: '(242) 555-0105', rides: 8, rating: 3.2, joined: '2026-07-18', status: 'Suspended' },
  { id: 6, name: 'Crystal Johnson', email: 'crystal.j@hotmail.com', phone: '(242) 555-0106', rides: 31, rating: 4.6, joined: '2026-05-11', status: 'Active' },
  { id: 7, name: 'Andre Davis', email: 'andre.d@gmail.com', phone: '(242) 555-0107', rides: 55, rating: 4.9, joined: '2026-01-20', status: 'Active' },
  { id: 8, name: 'Lisa Ferguson', email: 'lisa.f@outlook.com', phone: '(242) 555-0108', rides: 19, rating: 4.4, joined: '2026-08-05', status: 'Active' },
  { id: 9, name: 'Robert Sands', email: 'robert.s@gmail.com', phone: '(242) 555-0109', rides: 3, rating: 2.8, joined: '2026-09-01', status: 'Suspended' },
  { id: 10, name: 'Keisha Brown', email: 'keisha.b@gmail.com', phone: '(242) 555-0110', rides: 41, rating: 4.7, joined: '2026-04-02', status: 'Active' },
])

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
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (!error && data && data.length > 0) {
      users.value = data.map((u, i) => ({
        id: u.id || i,
        name: u.name || u.full_name || 'Unknown',
        email: u.email || 'N/A',
        phone: u.phone || 'N/A',
        rides: u.total_rides || 0,
        rating: u.rating || 5.0,
        joined: u.created_at ? u.created_at.split('T')[0] : 'N/A',
        status: u.suspended ? 'Suspended' : 'Active',
      }))
    }
  } catch (e) { /* keep placeholder data */ }
})
</script>
