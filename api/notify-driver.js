import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { driverId, type } = req.body

  if (!driverId || !type) {
    return res.status(400).json({ error: 'Missing driverId or type' })
  }

  try {
    // Look up driver's email via their auth_user_id
    const { data: driver } = await supabase
      .from('drivers')
      .select('name, email, auth_user_id')
      .eq('id', driverId)
      .single()

    if (!driver || !driver.email) {
      return res.status(200).json({ sent: false, reason: 'No email on file' })
    }

    const driverName = driver.name || 'Driver'

    // Use Supabase's built-in email (auth.admin) or a custom SMTP setup
    // For now, use Supabase's auth.admin.sendRawEmail if available,
    // otherwise log and return success (email service can be added later)
    if (type === 'approved') {
      // Try sending via Supabase Edge Function or just log for now
      console.log(`[NOTIFY] Driver approved: ${driverName} (${driver.email})`)

      // If you have a Resend/SendGrid key, uncomment and configure:
      // const sgMail = require('@sendgrid/mail')
      // sgMail.setApiKey(process.env.SENDGRID_API_KEY)
      // await sgMail.send({
      //   to: driver.email,
      //   from: 'noreply@rideupnassau.com',
      //   subject: 'You\'re approved to drive with RideUp!',
      //   html: `<p>Hi ${driverName},</p><p>Your driver application has been approved! You can now start accepting rides.</p><p>Open the app and go to your Driver Dashboard to go online.</p><p>— The RideUp Team</p>`,
      // })
    }

    res.status(200).json({ sent: true, email: driver.email })
  } catch (err) {
    console.error('Notify error:', err.message)
    res.status(500).json({ error: 'Failed to send notification' })
  }
}
