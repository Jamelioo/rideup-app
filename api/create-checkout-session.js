import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { amount, description, customerEmail } = req.body

  if (!amount || amount < 100) {
    return res.status(400).json({ error: 'Invalid amount' })
  }

  try {
    const domain = process.env.DOMAIN || 'https://rideupnassau.com'

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      ui_mode: 'hosted_page',
      success_url: `${domain}/book?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${domain}/book?payment=cancelled`,
      line_items: [
        {
          price_data: {
            currency: 'bsd',
            product_data: {
              name: description || 'RideUp Ride',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      billing_address_collection: 'auto',
      name_collection: {
        individual: {
          enabled: true,
          optional: true,
        },
      },
      phone_number_collection: { enabled: true },
      allow_promotion_codes: true,
      submit_type: 'auto',
      integration_identifier: 'hosted_web_0001',
      origin_context: 'web',
      customer_email: customerEmail || undefined,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('Stripe checkout error:', err.message)
    res.status(500).json({ error: err.message })
  }
}
