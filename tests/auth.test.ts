import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { hashPassword, verifyPassword } from '../server/modules/auth/password.ts'
import { Client, ORIGIN, startTestServer, type TestServer } from './helpers.ts'

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('correct-horse')
    assert.match(hash, /^scrypt\$/)
    assert.equal(await verifyPassword('correct-horse', hash), true)
    assert.equal(await verifyPassword('wrong-horse', hash), false)
  })

  it('salts every hash', async () => {
    assert.notEqual(await hashPassword('same'), await hashPassword('same'))
  })
})

describe('auth API', () => {
  let server: TestServer
  before(async () => {
    server = await startTestServer()
  })
  after(async () => {
    await server.close()
  })

  it('signs up with free credits, keeps the session, and signs out', async () => {
    const client = new Client(server.url)
    const signup = await client.post('/api/auth/signup', { email: 'Rohit@Example.com', password: 'correct-horse', name: 'Rohit' })
    assert.equal(signup.status, 201)
    assert.equal(signup.json.user.email, 'rohit@example.com')
    assert.equal(signup.json.user.credits, 3)
    assert.match(signup.headers.get('set-cookie') ?? '', /HttpOnly/i)
    assert.match(signup.headers.get('set-cookie') ?? '', /SameSite=Lax/i)

    const me = await client.get('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.json.user.name, 'Rohit')
    assert.equal(me.json.user.passwordHash, undefined)

    assert.equal((await client.post('/api/auth/logout')).status, 204)
    assert.equal((await client.get('/api/auth/me')).json.user, null)
  })

  it('rejects a duplicate email', async () => {
    const client = new Client(server.url)
    await client.post('/api/auth/signup', { email: 'dup@example.com', password: 'correct-horse', name: 'A' })
    const again = await new Client(server.url).post('/api/auth/signup', { email: 'DUP@example.com', password: 'other-pass', name: 'B' })
    assert.equal(again.status, 409)
  })

  it('gives the same answer for unknown email and wrong password', async () => {
    await new Client(server.url).post('/api/auth/signup', { email: 'known@example.com', password: 'correct-horse', name: 'K' })
    const wrong = await new Client(server.url).post('/api/auth/login', { email: 'known@example.com', password: 'nope-nope' })
    const unknown = await new Client(server.url).post('/api/auth/login', { email: 'ghost@example.com', password: 'nope-nope' })
    assert.equal(wrong.status, 401)
    assert.equal(unknown.status, 401)
    assert.equal(wrong.json.error.message, unknown.json.error.message)
  })

  it('signs in with the right password', async () => {
    await new Client(server.url).post('/api/auth/signup', { email: 'login@example.com', password: 'correct-horse', name: 'L' })
    const client = new Client(server.url)
    assert.equal((await client.post('/api/auth/login', { email: 'login@example.com', password: 'correct-horse' })).status, 200)
    assert.equal((await client.get('/api/auth/me')).status, 200)
  })

  it('validates input', async () => {
    const res = await new Client(server.url).post('/api/auth/signup', { email: 'not-an-email', password: 'short', name: '' })
    assert.equal(res.status, 400)
    assert.equal(res.json.error.code, 'bad_request')
  })

  it('blocks writes from other sites (CSRF)', async () => {
    const foreign = await new Client(server.url).post('/api/auth/login', { email: 'a@b.co', password: 'x' }, { Origin: 'https://evil.example' })
    assert.equal(foreign.status, 403)
    const noOrigin = await fetch(`${server.url}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    assert.equal(noOrigin.status, 403)
    assert.ok(ORIGIN)
  })

  it('sends security headers and hides the framework', async () => {
    const res = await fetch(`${server.url}/api/health`)
    assert.equal(res.status, 200)
    assert.ok(res.headers.get('content-security-policy')?.includes("frame-ancestors 'none'"))
    assert.equal(res.headers.get('x-powered-by'), null)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
  })

  it('returns JSON 404 for unknown API routes', async () => {
    const res = await new Client(server.url).get('/api/nope')
    assert.equal(res.status, 404)
    assert.equal(res.json.error.code, 'not_found')
  })
})

describe('auth rate limits', () => {
  let server: TestServer
  before(async () => {
    server = await startTestServer({ SIGNUP_LIMIT_PER_HOUR: '2', LOGIN_FAILURE_LIMIT: '3' })
  })
  after(async () => {
    await server.close()
  })

  it('limits sign-ups per network', async () => {
    const statuses = []
    for (let i = 0; i < 3; i++) {
      statuses.push((await new Client(server.url).post('/api/auth/signup', { email: `rl${i}@example.com`, password: 'correct-horse', name: 'R' })).status)
    }
    assert.deepEqual(statuses, [201, 201, 429])
  })

  it('limits failed sign-ins but not page loads', async () => {
    const client = new Client(server.url)
    for (let i = 0; i < 3; i++) assert.equal((await client.post('/api/auth/login', { email: 'rl0@example.com', password: 'wrong-pass' })).status, 401)
    assert.equal((await client.post('/api/auth/login', { email: 'rl0@example.com', password: 'correct-horse' })).status, 429)
    for (let i = 0; i < 20; i++) assert.equal((await client.get('/api/auth/me')).status, 200)
  })
})

describe('account settings', () => {
  let server: TestServer
  before(async () => {
    server = await startTestServer()
  })
  after(async () => {
    await server.close()
  })

  async function signUp(email: string) {
    const client = new Client(server.url)
    await client.post('/api/auth/signup', { email, password: 'correct-horse', name: 'Old Name' })
    return client
  }

  it('updates the name', async () => {
    const client = await signUp('profile@example.com')
    const res = await client.post('/api/auth/profile', { name: '  New Name ' })
    assert.equal(res.status, 200)
    assert.equal(res.json.user.name, 'New Name')
    assert.equal((await client.post('/api/auth/profile', { name: '' })).status, 400)
  })

  it('changes the password and signs out other devices', async () => {
    const laptop = await signUp('pw@example.com')
    const phone = new Client(server.url)
    await phone.post('/api/auth/login', { email: 'pw@example.com', password: 'correct-horse' })

    assert.equal((await laptop.post('/api/auth/password', { currentPassword: 'wrong-one', newPassword: 'brand-new-pass' })).status, 401)
    assert.equal((await laptop.post('/api/auth/password', { currentPassword: 'correct-horse', newPassword: 'brand-new-pass' })).status, 204)

    assert.equal((await laptop.get('/api/auth/me')).json.user.email, 'pw@example.com')
    assert.equal((await phone.get('/api/auth/me')).json.user, null)
    assert.equal((await new Client(server.url).post('/api/auth/login', { email: 'pw@example.com', password: 'correct-horse' })).status, 401)
    assert.equal((await new Client(server.url).post('/api/auth/login', { email: 'pw@example.com', password: 'brand-new-pass' })).status, 200)
  })

  it('signs out everywhere', async () => {
    const a = await signUp('all@example.com')
    const b = new Client(server.url)
    await b.post('/api/auth/login', { email: 'all@example.com', password: 'correct-horse' })
    assert.equal((await a.post('/api/auth/logout-all')).status, 204)
    assert.equal((await a.get('/api/auth/me')).json.user, null)
    assert.equal((await b.get('/api/auth/me')).json.user, null)
  })

  it('deletes the account only with the right password', async () => {
    const client = await signUp('gone@example.com')
    assert.equal((await client.post('/api/auth/delete', { password: 'nope-nope' })).status, 401)
    assert.equal((await client.post('/api/auth/delete', { password: 'correct-horse' })).status, 204)
    assert.equal((await client.get('/api/auth/me')).json.user, null)
    assert.equal((await new Client(server.url).post('/api/auth/login', { email: 'gone@example.com', password: 'correct-horse' })).status, 401)
    assert.equal(await server.db.users.countDocuments({ email: 'gone@example.com' }), 0)
  })

  it('blocks account changes from other sites', async () => {
    const client = await signUp('csrf2@example.com')
    const res = await client.post('/api/auth/delete', { password: 'correct-horse' }, { Origin: 'https://evil.example' })
    assert.equal(res.status, 403)
  })
})
