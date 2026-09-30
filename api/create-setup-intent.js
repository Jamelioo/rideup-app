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

  const { userId, name, email } = req.body

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' })
  }

  try {
    const { data: rider } = await supabase
      .from('riders')
      .select('stripe_customer_id')
      .eq('auth_user_id', userId)
      .maybeSingle()

    let customerId = rider?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        name: name || undefined,
        email: email || undefined,
        metadata: { supabase_user_id: userId },
      })
      customerId = customer.id

      await supabase
        .from('riders')
        .update({ stripe_customer_id: customerId })
        .eq('auth_user_id', userId)
    }

    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
    })

    res.status(200).json({
      client_secret: setupIntent.client_secret,
      customer_id: customerId,
    })
  } catch (err) {
    console.error('Setup intent error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
