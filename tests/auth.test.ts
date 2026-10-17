import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { Client, ORIGIN, googleCredential, startTestServer, type TestServer } from './helpers.ts'

describe('auth API', () => {
  let server: TestServer
  before(async () => {
    server = await startTestServer()
  })
  after(async () => {
    await server.close()
  })

  it('creates an account with free credits on first Google sign-in, keeps the session, and signs out', async () => {
    const client = new Client(server.url)
    const first = await client.post('/api/auth/google', { credential: googleCredential('Rohit@Example.com', 'Rohit') })
    assert.equal(first.status, 201)
    assert.equal(first.json.isNew, true)
    assert.equal(first.json.user.email, 'rohit@example.com')
    assert.equal(first.json.user.credits, 3)
    assert.match(first.headers.get('set-cookie') ?? '', /HttpOnly/i)
    assert.match(first.headers.get('set-cookie') ?? '', /SameSite=Lax/i)

    const me = await client.get('/api/auth/me')
    assert.equal(me.status, 200)
    assert.equal(me.json.user.name, 'Rohit')
    assert.equal(me.json.user.googleId, undefined)

    assert.equal((await client.post('/api/auth/logout')).status, 204)
    assert.equal((await client.get('/api/auth/me')).json.user, null)
  })

  it('signs in to the same account the second time without a second bonus', async () => {
    const first = await new Client(server.url).post('/api/auth/google', { credential: googleCredential('again@example.com') })
    const again = await new Client(server.url).post('/api/auth/google', { credential: googleCredential('AGAIN@example.com') })
    assert.equal(again.status, 200)
    assert.equal(again.json.isNew, false)
    assert.equal(again.json.user.id, first.json.user.id)
    assert.equal(again.json.user.credits, 3)
  })

  it('links an older password account with the same email and keeps its credits', async () => {
    await server.db.users.insertOne({ email: 'old@example.com', name: 'Old', credits: 7, appliedRefs: [], createdAt: new Date() } as never)
    const res = await new Client(server.url).post('/api/auth/google', { credential: googleCredential('old@example.com') })
    assert.equal(res.status, 200)
    assert.equal(res.json.user.credits, 7)
    assert.equal((await server.db.users.findOne({ email: 'old@example.com' }))?.googleId, 'g-old@example.com')
  })

  it('rejects an invalid Google credential', async () => {
    assert.equal((await new Client(server.url).post('/api/auth/google', { credential: 'forged' })).status, 401)
    assert.equal((await new Client(server.url).post('/api/auth/google', {})).status, 400)
  })

  it('blocks writes from other sites (CSRF)', async () => {
    const foreign = await new Client(server.url).post('/api/auth/google', { credential: googleCredential('a@b.co') }, { Origin: 'https://evil.example' })
    assert.equal(foreign.status, 403)
    const noOrigin = await fetch(`${server.url}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
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
    await client.post('/api/auth/google', { credential: googleCredential(email, 'Old Name') })
    return client
  }

  it('updates the name', async () => {
    const client = await signUp('profile@example.com')
    const res = await client.post('/api/auth/profile', { name: '  New Name ' })
    assert.equal(res.status, 200)
    assert.equal(res.json.user.name, 'New Name')
    assert.equal((await client.post('/api/auth/profile', { name: '' })).status, 400)
  })

  it('signs out everywhere', async () => {
    const a = await signUp('all@example.com')
    const b = new Client(server.url)
    await b.post('/api/auth/google', { credential: googleCredential('all@example.com') })
    assert.equal((await a.post('/api/auth/logout-all')).status, 204)
    assert.equal((await a.get('/api/auth/me')).json.user, null)
    assert.equal((await b.get('/api/auth/me')).json.user, null)
  })

  it('deletes the account', async () => {
    const client = await signUp('gone@example.com')
    assert.equal((await client.post('/api/auth/delete')).status, 204)
    assert.equal((await client.get('/api/auth/me')).json.user, null)
    assert.equal(await server.db.users.countDocuments({ email: 'gone@example.com' }), 0)
  })

  it('blocks account changes from other sites', async () => {
    const client = await signUp('csrf2@example.com')
    const res = await client.post('/api/auth/delete', {}, { Origin: 'https://evil.example' })
    assert.equal(res.status, 403)
  })
})
