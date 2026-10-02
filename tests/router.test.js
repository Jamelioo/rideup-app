import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// The Stripe routes create their client when loaded; give them a dummy key (no request is ever sent).
process.env.STRIPE_SECRET_KEY ||= 'sk_test_dummy'

const root = path.resolve(import.meta.dirname, '..')

function mockRes() {
  return {
    statusCode: 200, body: null, headers: {},
    status(code) { this.statusCode = code; return this },
    json(body) { this.body = body; return this },
    setHeader(k, v) { this.headers[k] = v },
    end() { return this },
  }
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
}

test('Vercel Hobby plan: at most 12 serverless functions', () => {
  // Vercel makes a function from every api/**/*.js file except paths with a segment starting with "_" or ".".
  const functions = walk(path.join(root, 'api'))
    .map((f) => path.relative(root, f).split(path.sep).join('/'))
    .filter((f) => /\.(js|mjs|ts)$/.test(f) && !f.includes('/_') && !f.includes('/.'))
  assert.ok(functions.length <= 12, `${functions.length} functions: ${functions.join(', ')}`)
})

test('every /api route the app calls is handled', async () => {
  const { ACTIONS } = await import('../api/[action].js')
  const called = new Set()
  for (const file of walk(path.join(root, 'src')).filter((f) => /\.(vue|js)$/.test(f))) {
    // Only app-relative URLs ('/api/…'), not third-party ones like maps.googleapis.com/maps/api/js.
    for (const m of fs.readFileSync(file, 'utf8').matchAll(/['"`]\/api\/([a-z0-9-]+)/g)) called.add(m[1])
  }
  assert.ok(called.size >= 8, `expected the app's API calls to be found, got ${[...called]}`)
  for (const name of called) {
    const standalone = fs.existsSync(path.join(root, 'api', `${name}.js`))
    assert.ok(standalone || ACTIONS.includes(name), `/api/${name} is called by the app but not handled`)
  }
})

test('router sends each action to its handler and rejects unknown ones', async () => {
  const { default: handler, ACTIONS } = await import('../api/[action].js')
  for (const action of ACTIONS) {
    const res = mockRes()
    await handler({ method: 'GET', query: { action }, headers: {}, url: `/api/${action}` }, res)
    assert.equal(res.statusCode, 405, `${action} should reach its handler (POST only)`)
  }
  for (const bad of ['nope', '_auth', '__proto__', 'constructor', '']) {
    const res = mockRes()
    await handler({ method: 'POST', query: { action: bad }, headers: {}, url: `/api/${bad}` }, res)
    assert.equal(res.statusCode, 404, `"${bad}" must not resolve`)
  }
})

test('router falls back to the URL when the query has no action', async () => {
  const { actionFrom } = await import('../api/[action].js')
  assert.equal(actionFrom({ query: {}, url: '/api/cancel-ride?x=1' }), 'cancel-ride')
  assert.equal(actionFrom({ query: { action: ['add-tip', 'other'] }, url: '/api/[action]' }), 'add-tip')
})
