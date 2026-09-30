import Stripe from 'stripe'
import { buffer } from 'micro'
import { admin as supabase } from './_auth.js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export const config = {
  api: { bodyParser: false },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabase) return res.status(500).json({ error: 'Server is not configured' })

  const buf = await buffer(req)
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let event

  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret)
  } catch (err) {
    console.log('Webhook signature verification failed:', err.message)
    return res.status(400).send('Webhook signature verification failed')
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object
      const rideId = session.metadata?.rideId

      // Only a fully paid session counts; never touch rides.status (it's the ride lifecycle, not payment).
      if (rideId && session.payment_status === 'paid') {
        await supabase
          .from('rides')
          .update({
            payment_status: 'paid',
            payment_session_id: session.id,
            paid_at: new Date().toISOString(),
          })
          .eq('id', rideId)
      }
      break
    }
    case 'payment_intent.payment_failed': {
      const rideId = event.data.object.metadata?.ride_id
      if (rideId) {
        await supabase.from('rides').update({ payment_status: 'failed' }).eq('id', rideId)
      }
      break
    }
    default:
      break
  }

  res.status(200).json({ received: true })
}
