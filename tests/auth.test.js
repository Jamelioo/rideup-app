import test from 'node:test'
import assert from 'node:assert/strict'
import { safeRedirect } from '../src/lib/safeRedirect.js'
import { toE164, formatPhone, tidyPhone, phoneIsVerified, whatsappUrl } from '../src/lib/phone.js'

test('login redirect: in-app paths are kept', () => {
  assert.equal(safeRedirect('/my-rides'), '/my-rides')
  assert.equal(safeRedirect('/ride/abc?x=1'), '/ride/abc?x=1')
})

test('login redirect: anything that could leave the site falls back', () => {
  for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'javascript:alert(1)', 'evil', '', null, undefined, ['/x'], '/a\nb']) {
    assert.equal(safeRedirect(bad), '/book', String(bad))
  }
  assert.equal(safeRedirect('//evil.example', '/driver/dashboard'), '/driver/dashboard')
})

test('phone: Bahamas numbers in any format become E.164', () => {
  assert.equal(toE164('555-0100'), '+12425550100')
  assert.equal(toE164('(242) 555-0100'), '+12425550100')
  assert.equal(toE164('1 242 555 0100'), '+12425550100')
  assert.equal(toE164('+1 242 555 0100'), '+12425550100')
  assert.equal(toE164('+44 20 7946 0958'), '+442079460958')
})

test('phone: junk is rejected', () => {
  for (const bad of ['', '123', '555-01', '+12', null, 'abcdefg', '2-242-555-0100']) assert.equal(toE164(bad), null, String(bad))
})

test('phone: display format', () => {
  assert.equal(formatPhone('+12425550100'), '(242) 555-0100')
  assert.equal(formatPhone('2425550100'), '(242) 555-0100')
  assert.equal(formatPhone('+442079460958'), '+442079460958')
  assert.equal(formatPhone(''), '')
})

test('phone: a number is tidied once understood, anything else is left as typed', () => {
  assert.equal(tidyPhone('5550100'), '(242) 555-0100')
  assert.equal(tidyPhone('1-242-555-0100'), '(242) 555-0100')
  assert.equal(tidyPhone('+44 20 7946 0958'), '+44 20 7946 0958')
  assert.equal(tidyPhone('555-01'), '555-01')
  assert.equal(tidyPhone(''), '')
})

test('phone: a verified number only counts while it is still the one on the rider profile', () => {
  const verified = { phone: '12425550100', phone_confirmed_at: '2026-10-01T00:00:00Z' }
  assert.equal(phoneIsVerified(verified, '+12425550100'), true)
  assert.equal(phoneIsVerified(verified, '(242) 555-0100'), true)
  assert.equal(phoneIsVerified(verified, ''), true)
  assert.equal(phoneIsVerified(verified, '+12425559999'), false)
  assert.equal(phoneIsVerified({ phone: '12425550100', phone_confirmed_at: null }, '+12425550100'), false)
  assert.equal(phoneIsVerified({ phone: '' }, ''), false)
  assert.equal(phoneIsVerified(null, '+12425550100'), false)
})

test('phone: WhatsApp links work from any stored format', () => {
  assert.equal(whatsappUrl('+12425550100'), 'https://wa.me/12425550100')
  assert.equal(whatsappUrl('(242) 555-0100'), 'https://wa.me/12425550100')
  assert.equal(whatsappUrl('+12425550100', 'Hi Ann, $5 off & more'), 'https://wa.me/12425550100?text=Hi%20Ann%2C%20%245%20off%20%26%20more')
  assert.equal(whatsappUrl(''), '')
  assert.equal(whatsappUrl('123'), '')
  assert.equal(whatsappUrl(null), '')
})
