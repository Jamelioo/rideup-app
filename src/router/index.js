import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import { useAuth } from '../lib/useAuth'
import { useDriver } from '../lib/useDriver'
import { DEMO_MODE } from '../lib/demoMode'
import { setPendingReferral } from '../lib/rewards'

// Eager: landing + main booking (first paint)
import RiderLanding from '../pages/RiderLanding.vue'
import RiderFlow from '../pages/rider/RiderFlow.vue'

// Lazy: everything else
const Login = () => import('../pages/Login.vue')
const Signup = () => import('../pages/Signup.vue')
const ResetPassword = () => import('../pages/ResetPassword.vue')
const VerifyPhone = () => import('../pages/VerifyPhone.vue')
const Profile = () => import('../pages/Profile.vue')
const EditProfile = () => import('../pages/EditProfile.vue')
const MyRides = () => import('../pages/MyRides.vue')
const SplitInvite = () => import('../pages/rider/SplitInvite.vue')
const Payments = () => import('../pages/Payments.vue')
const SavedPlaces = () => import('../pages/SavedPlaces.vue')
const Support = () => import('../pages/Support.vue')
const About = () => import('../pages/About.vue')
const DriverLanding = () => import('../pages/DriverLanding.vue')
const NotFound = () => import('../pages/NotFound.vue')
const TrackTrip = () => import('../pages/TrackTrip.vue')
const TrustedContacts = () => import('../pages/TrustedContacts.vue')
const Promotions = () => import('../pages/Promotions.vue')
const Referrals = () => import('../pages/Referrals.vue')
const Privacy = () => import('../pages/Privacy.vue')
const Terms = () => import('../pages/Terms.vue')
const PaymentSuccess = () => import('../pages/rider/PaymentSuccess.vue')
const RideReceipt = () => import('../pages/rider/RideReceipt.vue')
const DriverApply = () => import('../pages/driver/DriverApply.vue')
const DriverPending = () => import('../pages/driver/DriverPending.vue')
const DriverDashboard = () => import('../pages/driver/DriverDashboard.vue')
const DriverActiveRide = () => import('../pages/driver/DriverActiveRide.vue')
const DriverEarnings = () => import('../pages/driver/DriverEarnings.vue')
const DriverProfile = () => import('../pages/driver/DriverProfile.vue')
const DriverDocuments = () => import('../pages/driver/DriverDocuments.vue')
const RateRide = () => import('../pages/rider/RateRide.vue')
const RateRider = () => import('../pages/driver/RateRider.vue')
const ActiveRide = () => import('../pages/rider/ActiveRide.vue')
const RideMessages = () => import('../pages/rider/RideMessages.vue')
const ScheduledRides = () => import('../pages/rider/ScheduledRides.vue')
const AdminLayout = () => import('../pages/admin/AdminLayout.vue')
const AdminDashboard = () => import('../pages/admin/AdminDashboard.vue')
const AdminRides = () => import('../pages/admin/AdminRides.vue')
const AdminUsers = () => import('../pages/admin/AdminUsers.vue')
const AdminDrivers = () => import('../pages/admin/AdminDrivers.vue')
const AdminRevenue = () => import('../pages/admin/AdminRevenue.vue')
const AdminSupport = () => import('../pages/admin/AdminSupport.vue')
const AdminSafety = () => import('../pages/admin/AdminSafety.vue')
const AdminPayouts = () => import('../pages/admin/AdminPayouts.vue')
const AdminPromos = () => import('../pages/admin/AdminPromos.vue')
const AdminIncentives = () => import('../pages/admin/AdminIncentives.vue')
const AdminSettings = () => import('../pages/admin/AdminSettings.vue')

const routes = [
  { path: '/', name: 'home', component: RiderLanding, meta: { title: 'RideUp — Ride in Nassau' } },
  { path: '/book', name: 'book', component: RiderFlow, meta: { title: 'RideUp Nassau' } },
  { path: '/login', name: 'login', component: Login, meta: { guestOnly: true, title: 'Log In — RideUp' } },
  { path: '/signup', name: 'signup', component: Signup, meta: { guestOnly: true, title: 'Sign Up — RideUp' } },
  { path: '/reset-password', name: 'reset-password', component: ResetPassword, meta: { title: 'Reset Password — RideUp' } },
  { path: '/set-password', name: 'set-password', component: ResetPassword, meta: { title: 'Choose a Password — RideUp' } },
  { path: '/verify-phone', name: 'verify-phone', component: VerifyPhone, meta: { requiresAuth: true, title: 'Verify Your Phone — RideUp' } },
  { path: '/profile', name: 'profile', component: Profile, meta: { requiresAuth: true, title: 'Profile — RideUp' } },
  { path: '/edit-profile', name: 'edit-profile', component: EditProfile, meta: { requiresAuth: true, title: 'Edit Profile — RideUp' } },
  { path: '/split/:splitId', name: 'split-invite', component: SplitInvite, meta: { requiresAuth: true, title: 'Split Fare — RideUp' } },
  { path: '/my-rides', name: 'my-rides', component: MyRides, meta: { requiresAuth: true, title: 'My Rides — RideUp' } },
  { path: '/scheduled-rides', name: 'scheduled-rides', component: ScheduledRides, meta: { requiresAuth: true, title: 'Scheduled Rides — RideUp' } },
  { path: '/payments', name: 'payments', component: Payments, meta: { requiresAuth: true, title: 'Payments — RideUp' } },
  { path: '/saved-places', name: 'saved-places', component: SavedPlaces, meta: { requiresAuth: true, title: 'Saved Places — RideUp' } },
  { path: '/payment-success', name: 'payment-success', component: PaymentSuccess, meta: { title: 'Payment Successful — RideUp' } },
  { path: '/receipt/:rideId', name: 'ride-receipt', component: RideReceipt, meta: { title: 'Receipt — RideUp' } },
  { path: '/support', name: 'support', component: Support, meta: { title: 'Support — RideUp' } },
  { path: '/trusted-contacts', name: 'trusted-contacts', component: TrustedContacts, meta: { requiresAuth: true, title: 'Trusted Contacts — RideUp' } },
  { path: '/promotions', name: 'promotions', component: Promotions, meta: { requiresAuth: true, title: 'Promotions — RideUp' } },
  { path: '/referrals', name: 'referrals', component: Referrals, meta: { requiresAuth: true, title: 'Invite Friends — RideUp' } },
  { path: '/about', name: 'about', component: About, meta: { title: 'About — RideUp' } },
  { path: '/track/:token', name: 'track-trip', component: TrackTrip, meta: { title: 'Live trip — RideUp', public: true } },
  { path: '/welcome', redirect: '/' },
  // Referral links (rideupnassau.com/r/RIDEXXXXX): remember the code, then sign up. It's applied once the
  // friend has an account (App.vue), giving them $5 off their first ride.
  {
    path: '/r/:code',
    name: 'referral-link',
    redirect: (to) => {
      setPendingReferral(String(to.params.code || '').slice(0, 20))
      return { path: '/signup', query: { ref: '1' } }
    },
  },
  { path: '/drive', name: 'driver-landing', component: DriverLanding, meta: { title: 'Drive with RideUp Nassau' } },
  { path: '/privacy', name: 'privacy', component: Privacy, meta: { title: 'Privacy Policy — RideUp' } },
  { path: '/terms', name: 'terms', component: Terms, meta: { title: 'Terms of Service — RideUp' } },
  { path: '/driver/apply', name: 'driver-apply', component: DriverApply, meta: { title: 'Drive with RideUp' } },
  { path: '/driver/pending', name: 'driver-pending', component: DriverPending, meta: { requiresAuth: true, title: 'Application Status — RideUp' } },
  { path: '/driver/dashboard', name: 'driver-dashboard', component: DriverDashboard, meta: { requiresAuth: true, title: 'Driver Dashboard — RideUp' } },
  { path: '/driver/active-ride', name: 'driver-active-ride', component: DriverActiveRide, meta: { requiresAuth: true, title: 'Active Ride — RideUp' } },
  { path: '/driver/earnings', name: 'driver-earnings', component: DriverEarnings, meta: { requiresAuth: true, title: 'Earnings — RideUp' } },
  { path: '/driver/profile', name: 'driver-profile', component: DriverProfile, meta: { requiresAuth: true, title: 'Driver Profile — RideUp' } },
  { path: '/driver/documents', name: 'driver-documents', component: DriverDocuments, meta: { requiresAuth: true, title: 'Documents — RideUp' } },
  { path: '/rate/:rideId', name: 'rate-ride', component: RateRide, meta: { requiresAuth: true, title: 'Rate Your Ride — RideUp' } },
  { path: '/ride/:rideId', name: 'active-ride', component: ActiveRide, meta: { requiresAuth: true, title: 'Your Ride — RideUp' } },
  { path: '/ride/:rideId/messages', name: 'ride-messages', component: RideMessages, meta: { requiresAuth: true, title: 'Messages — RideUp' } },
  { path: '/driver/rate/:rideId', name: 'rate-rider', component: RateRider, meta: { requiresAuth: true, title: 'Rate Rider — RideUp' } },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: AdminDashboard, meta: { title: 'Admin Dashboard — RideUp' } },
      { path: 'rides', name: 'admin-rides', component: AdminRides, meta: { title: 'Manage Rides — RideUp' } },
      { path: 'users', name: 'admin-users', component: AdminUsers, meta: { title: 'Manage Users — RideUp' } },
      { path: 'drivers', name: 'admin-drivers', component: AdminDrivers, meta: { title: 'Manage Drivers — RideUp' } },
      { path: 'revenue', name: 'admin-revenue', component: AdminRevenue, meta: { title: 'Money — RideUp' } },
      { path: 'support', name: 'admin-support', component: AdminSupport, meta: { title: 'Support Tickets — RideUp' } },
      { path: 'safety', name: 'admin-safety', component: AdminSafety, meta: { title: 'Safety Reports — RideUp' } },
      { path: 'payouts', name: 'admin-payouts', component: AdminPayouts, meta: { title: 'Driver Payouts — RideUp' } },
      { path: 'promos', name: 'admin-promos', component: AdminPromos, meta: { title: 'Promo Codes — RideUp' } },
      { path: 'incentives', name: 'admin-incentives', component: AdminIncentives, meta: { title: 'Driver Incentives — RideUp' } },
      { path: 'settings', name: 'admin-settings', component: AdminSettings, meta: { title: 'Settings — RideUp' } },
    ],
  },
  { path: '/:pathMatch(.*)*', name: 'not-found', component: NotFound, meta: { title: 'Page Not Found — RideUp' } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

router.beforeEach(async (to) => {
  const { user, loading } = useAuth()

  // Wait for auth to finish loading before making redirect decisions
  if (loading.value) {
    await new Promise((resolve) => {
      const stop = watch(loading, (val) => {
        if (!val) { stop(); resolve() }
      })
    })
  }

  // Logged-in users visiting the landing page get redirected to the booking screen
  if (to.path === '/' && user.value) {
    return { path: '/book' }
  }

  if (to.meta.requiresAuth && !user.value && !DEMO_MODE) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }

  // Guests (anonymous or phone-only sessions) can still reach log in and sign up to use a real account.
  if (to.meta.guestOnly && user.value?.email && !user.value.is_anonymous) {
    return { path: '/book' }
  }

  if (to.meta.requiresAdmin && !DEMO_MODE && user.value?.app_metadata?.role !== 'admin') {
    return { path: '/book' }
  }

  // Driver-specific route guards
  if (to.path.startsWith('/driver/') && to.path !== '/driver/apply' && to.path !== '/driver/pending') {
    if (!DEMO_MODE) {
      const { driver, currentRide, fetchDriver } = useDriver()

      if (!driver.value && user.value) {
        await fetchDriver(user.value.id)
      }

      if (!driver.value) {
        return { path: '/driver/apply' }
      }

      // A driver sent back to review mid-trip can still finish that trip.
      if (!driver.value.approved && !(to.path === '/driver/active-ride' && currentRide.value)) {
        return { path: '/driver/pending' }
      }

      if (to.path === '/driver/active-ride' && !currentRide.value) {
        return { path: '/driver/dashboard' }
      }
      if (to.path === '/driver/dashboard' && currentRide.value) {
        return { path: '/driver/active-ride' }
      }
    }
  }
})

// Full-screen app screens: lock the page so only their inner panels scroll (see html.app-shell in style.css).
const APP_SHELL_ROUTES = ['/book', '/ride/', '/driver/dashboard', '/driver/active-ride']

router.afterEach((to) => {
  document.title = to.meta.title || 'RideUp Nassau'
  const shell = APP_SHELL_ROUTES.some((p) => to.path === p || (p.endsWith('/') && to.path.startsWith(p)))
  document.documentElement.classList.toggle('app-shell', shell)
  if (shell) window.scrollTo(0, 0)
})

export default router
