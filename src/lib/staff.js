import { computed } from 'vue'
import { useAuth } from './useAuth'
import { DEMO_MODE } from './demoMode'
import { staffRole } from './staffRules'

export { staffRole, canOpenAdminPage, ADMIN_ONLY_PAGES } from './staffRules'

// The signed-in team member's role. In demo mode there is no signed-in admin, so the pages show everything.
export function useStaffRole() {
  const { user } = useAuth()
  const role = computed(() => (DEMO_MODE ? 'admin' : staffRole(user.value)))
  return { role, isAdmin: computed(() => role.value === 'admin') }
}
