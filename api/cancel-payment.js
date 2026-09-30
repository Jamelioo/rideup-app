import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { rideId } = req.body

  if (!rideId) {
    return res.status(400).json({ error: 'rideId is required' })
  }

  try {
    const { data: ride } = await supabase
      .from('rides')
      .select('payment_intent_id, payment_status')
      .eq('id', rideId)
      .single()

    if (ride?.payment_intent_id && ride.payment_status === 'authorized') {
      await stripe.paymentIntents.cancel(ride.payment_intent_id)

      await supabase
        .from('rides')
        .update({ payment_status: 'cancelled' })
        .eq('id', rideId)
    }

    res.status(200).json({ success: true })
  } catch (err) {
    console.error('Cancel payment error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
