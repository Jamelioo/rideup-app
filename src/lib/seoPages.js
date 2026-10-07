// Public pages search engines should index. The router uses these for <title>/description in the browser, and
// scripts/seo-pages.mjs writes one HTML file per page at build time so crawlers that don't run JavaScript still
// get the right title, description, canonical link and heading (not the home page's). Keep descriptions under
// 160 characters. Pages here should also be listed in public/sitemap.xml.
export const SITE = 'https://www.rideupnassau.com'

export const SEO_PAGES = [
  {
    path: '/',
    title: 'RideUp Nassau — Book a ride with upfront prices',
    description: 'Book a ride across New Providence. See your exact fare before you book, pay by card, and ride with approved local drivers. LPIA airport rides too.',
    h1: 'Get anywhere in Nassau.',
    intro: 'See your exact fare before you book. That’s the price you pay, with a driver approved by RideUp.',
  },
  {
    path: '/airport',
    title: 'Nassau Airport Rides — RideUp',
    description: 'Rides from Lynden Pindling International Airport (LPIA) to Cable Beach, Paradise Island and downtown Nassau, with the price shown before you book.',
    h1: 'Nassau airport rides with the price up front',
    intro: 'Book a ride from LPIA to your hotel or home and see the fare before you confirm.',
  },
  {
    path: '/drive',
    title: 'Drive with RideUp — Nassau',
    description: 'Drive with RideUp in Nassau. Use your own car, choose your hours and keep 70% of every trip fare plus 100% of tips. Apply online.',
    h1: 'Drive with RideUp and keep 70% of every fare',
    intro: 'Your car, your hours, your money. Apply online and start driving across New Providence.',
  },
  {
    path: '/driver/apply',
    title: 'Apply to Drive — RideUp',
    description: 'Apply to drive with RideUp in Nassau. Tell us about you and your car, upload your documents, and start earning once you’re approved.',
    h1: 'Drive with RideUp',
    intro: 'Apply online in a few minutes.',
  },
  {
    path: '/about',
    title: 'About — RideUp',
    description: 'RideUp is a Nassau ride service with upfront prices, card payments and approved local drivers across New Providence.',
    h1: 'About RideUp',
    intro: 'Rides across New Providence with the price shown before you book.',
  },
  {
    path: '/support',
    title: 'Help — RideUp',
    description: 'Get help with RideUp rides, payments, receipts, lost items and safety. Contact RideUp support in Nassau.',
    h1: 'How can we help?',
    intro: 'Answers about rides, payments, receipts and safety.',
  },
  {
    path: '/terms',
    title: 'Terms of Service — RideUp',
    description: 'The terms for riding and driving with RideUp in Nassau, The Bahamas: bookings, fares, fees, cancellations and payments.',
    h1: 'Terms of Service',
    intro: 'The terms for riding and driving with RideUp.',
  },
  {
    path: '/privacy',
    title: 'Privacy Policy — RideUp',
    description: 'How RideUp collects, uses and protects your information when you book or drive, including location, payments and safety features.',
    h1: 'Privacy Policy',
    intro: 'How RideUp handles your information.',
  },
]

export const seoPageFor = (path) => SEO_PAGES.find((p) => p.path === path)
