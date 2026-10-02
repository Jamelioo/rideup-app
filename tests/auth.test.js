import test from 'node:test'
import assert from 'node:assert/strict'
import { safeRedirect } from '../src/lib/safeRedirect.js'
import { toE164, formatPhone } from '../src/lib/phone.js'

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
