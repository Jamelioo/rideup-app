import test from 'node:test'
import assert from 'node:assert/strict'
import { toE164, smsConfigured } from '../api/_sms.js'

test('Bahamian phone numbers become international format for texts', () => {
  assert.equal(toE164('555-1234'), '+12425551234')
  assert.equal(toE164('(242) 555-1234'), '+12425551234')
  assert.equal(toE164('1 242 555 1234'), '+12425551234')
  assert.equal(toE164('+44 20 7946 0958'), '+442079460958')
  assert.equal(toE164('123'), null)
  assert.equal(toE164(''), null)
})

test('texts are off until Twilio keys are set', () => {
  assert.equal(smsConfigured(), false)
})
