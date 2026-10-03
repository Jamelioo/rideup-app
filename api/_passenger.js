import { admin } from './_auth.js'
import { sendSms } from './_sms.js'

const APP_URL = () => process.env.APP_URL || 'https://rideupnassau.com'

// Texts the passenger of a ride booked for someone else: driver, car, plate, pickup PIN and a live trip link.
//   event: 'accepted' | 'arrived'
export async function notifyPassenger(rideId, event) {
  try {
    const { data: ride } = await admin
      .from('rides')
      .select('id, passenger_name, passenger_phone, share_token, pickup_address, drivers:driver_id(name, vehicle_color, vehicle_make, vehicle_model, license_plate)')
      .eq('id', rideId)
      .maybeSingle()
    if (!ride?.passenger_phone) return false
    let token = ride.share_token
    if (!token) {
      token = crypto.randomUUID()
      await admin.from('rides').update({ share_token: token }).eq('id', rideId).is('share_token', null)
      const { data: again } = await admin.from('rides').select('share_token').eq('id', rideId).maybeSingle()
      token = again?.share_token || token
    }
    const d = ride.drivers || {}
    const driver = String(d.name || 'Your driver').trim().split(/\s+/)[0]
    const car = [d.vehicle_color, d.vehicle_make, d.vehicle_model].filter(Boolean).join(' ')
    const { data: pin } = await admin.from('ride_pins').select('pin').eq('ride_id', rideId).maybeSingle()
    const name = String(ride.passenger_name || '').split(/\s+/)[0]
    const link = `${APP_URL()}/track/${token}`
    const body = event === 'arrived'
      ? `RideUp: ${name ? name + ', y' : 'Y'}our driver ${driver} is at the pickup${car ? ` in a ${car}` : ''}${d.license_plate ? ` (${d.license_plate})` : ''}.${pin?.pin ? ` Your PIN is ${pin.pin}.` : ''} ${link}`
      : `RideUp: ${name ? `Hi ${name}, a` : 'A'} ride was booked for you. ${driver}${car ? ` (${car}${d.license_plate ? `, ${d.license_plate}` : ''})` : ''} is on the way to ${String(ride.pickup_address || 'your pickup').split(',')[0]}.${pin?.pin ? ` Tell the driver PIN ${pin.pin} to start.` : ''} Follow the car: ${link}`
    return sendSms(ride.passenger_phone, body)
  } catch (err) {
    console.error('Passenger notify failed:', err.message)
    return false
  }
}
