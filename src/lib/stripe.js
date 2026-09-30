import { loadStripe } from '@stripe/stripe-js'

let stripePromise = null

export function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    if (!key) {
      console.warn('Missing VITE_STRIPE_PUBLISHABLE_KEY in .env')
      return Promise.resolve(null)
    }
    stripePromise = loadStripe(key).catch((err) => {
      console.error('Failed to load Stripe:', err)
      // Reset so next call retries instead of caching the failure
      stripePromise = null
      return null
    })
  }
  return stripePromise
}
