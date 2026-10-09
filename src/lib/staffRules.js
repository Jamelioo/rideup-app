// Admin roles live in the account's app_metadata.role (set from Admin › Team). No app imports, so the rules are
// unit-tested and shared by the router and the admin pages:
//   'admin'   everything
//   'support' day-to-day operations (Live, rides, riders, drivers, safety, support tickets, notes, cancel and
//             assign trips) without money, payouts, promos, settings, approvals, refunds or the team
export const staffRole = (user) => (['admin', 'support'].includes(user?.app_metadata?.role) ? user.app_metadata.role : null)

// Admin pages support staff can't open (the database and server refuse their data too).
export const ADMIN_ONLY_PAGES = ['/admin/revenue', '/admin/payouts', '/admin/promos', '/admin/incentives', '/admin/settings', '/admin/team', '/admin/activity', '/admin/messages']
export const canOpenAdminPage = (role, path) =>
  role === 'admin' || (role === 'support' && path !== '/admin' && path !== '/admin/' && !ADMIN_ONLY_PAGES.some((p) => path.startsWith(p)))
