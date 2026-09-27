import { createRouter, createWebHistory } from 'vue-router'
import { watch } from 'vue'
import RiderFlow from '../pages/rider/RiderFlow.vue'
import Login from '../pages/Login.vue'
import Signup from '../pages/Signup.vue'
import Profile from '../pages/Profile.vue'
import EditProfile from '../pages/EditProfile.vue'
import MyRides from '../pages/MyRides.vue'
import Payments from '../pages/Payments.vue'
import Support from '../pages/Support.vue'
import About from '../pages/About.vue'
import RiderLanding from '../pages/RiderLanding.vue'
import DriverLanding from '../pages/DriverLanding.vue'
import NotFound from '../pages/NotFound.vue'
import Privacy from '../pages/Privacy.vue'
import Terms from '../pages/Terms.vue'
import DriverApply from '../pages/driver/DriverApply.vue'
import DriverPending from '../pages/driver/DriverPending.vue'
import DriverDashboard from '../pages/driver/DriverDashboard.vue'
import DriverActiveRide from '../pages/driver/DriverActiveRide.vue'
import DriverEarnings from '../pages/driver/DriverEarnings.vue'
import DriverProfile from '../pages/driver/DriverProfile.vue'
import { useAuth } from '../lib/useAuth'
import { useDriver } from '../lib/useDriver'
import { DEMO_MODE } from '../lib/demoMode'

const routes = [
  { path: '/', name: 'home', component: RiderLanding, meta: { title: 'RideUp — Ride in Nassau' } },
  { path: '/book', name: 'book', component: RiderFlow, meta: { title: 'RideUp Nassau' } },
  { path: '/login', name: 'login', component: Login, meta: { guestOnly: true, title: 'Log In — RideUp' } },
  { path: '/signup', name: 'signup', component: Signup, meta: { guestOnly: true, title: 'Sign Up — RideUp' } },
  { path: '/profile', name: 'profile', component: Profile, meta: { requiresAuth: true, title: 'Profile — RideUp' } },
  { path: '/edit-profile', name: 'edit-profile', component: EditProfile, meta: { requiresAuth: true, title: 'Edit Profile — RideUp' } },
  { path: '/my-rides', name: 'my-rides', component: MyRides, meta: { requiresAuth: true, title: 'My Rides — RideUp' } },
  { path: '/payments', name: 'payments', component: Payments, meta: { requiresAuth: true, title: 'Payments — RideUp' } },
  { path: '/support', name: 'support', component: Support, meta: { title: 'Support — RideUp' } },
  { path: '/about', name: 'about', component: About, meta: { title: 'About — RideUp' } },
  { path: '/welcome', redirect: '/' },
  { path: '/drive', name: 'driver-landing', component: DriverLanding, meta: { title: 'Drive with RideUp Nassau' } },
  { path: '/privacy', name: 'privacy', component: Privacy, meta: { title: 'Privacy Policy — RideUp' } },
  { path: '/terms', name: 'terms', component: Terms, meta: { title: 'Terms of Service — RideUp' } },
  { path: '/driver/apply', name: 'driver-apply', component: DriverApply, meta: { title: 'Drive with RideUp' } },
  { path: '/driver/pending', name: 'driver-pending', component: DriverPending, meta: { requiresAuth: true, title: 'Application Status — RideUp' } },
  { path: '/driver/dashboard', name: 'driver-dashboard', component: DriverDashboard, meta: { requiresAuth: true, title: 'Driver Dashboard — RideUp' } },
  { path: '/driver/active-ride', name: 'driver-active-ride', component: DriverActiveRide, meta: { requiresAuth: true, title: 'Active Ride — RideUp' } },
  { path: '/driver/earnings', name: 'driver-earnings', component: DriverEarnings, meta: { requiresAuth: true, title: 'Earnings — RideUp' } },
  { path: '/driver/profile', name: 'driver-profile', component: DriverProfile, meta: { requiresAuth: true, title: 'Driver Profile — RideUp' } },
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

  if (to.meta.guestOnly && user.value) {
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

      if (!driver.value.approved) {
        return { path: '/driver/pending' }
      }

      if (to.path === '/driver/active-ride' && !currentRide.value) {
        return { path: '/driver/dashboard' }
      }
    }
  }
})

router.afterEach((to) => {
  document.title = to.meta.title || 'RideUp Nassau'
})

export default router
