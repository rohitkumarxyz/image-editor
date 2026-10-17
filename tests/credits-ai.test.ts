import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { editBody, signedInClient, startTestServer, Client, type TestServer } from './helpers.ts'

describe('AI edits and credits', () => {
  let server: TestServer
  before(async () => {
    server = await startTestServer({ AI_DETECT_DAILY_LIMIT: '2', REFUND_DAILY_LIMIT: '1' })
  })
  after(async () => {
    await server.close()
  })

  it('requires sign-in', async () => {
    const res = await new Client(server.url).post('/api/ai/edit', editBody())
    assert.equal(res.status, 401)
  })

  it('charges one credit per edit and returns the drafts', async () => {
    const client = await signedInClient(server)
    const res = await client.post('/api/ai/edit', editBody())
    assert.equal(res.status, 200)
    assert.deepEqual(res.json.images, ['draft-a', 'draft-b'])
    assert.equal(res.json.credits, 2)
    const history = await client.get('/api/credits/history')
    assert.deepEqual(history.json.entries.map((e: { reason: string }) => e.reason), ['ai_edit', 'signup_bonus'])
  })

  it('gives the credit back when the AI fails', async () => {
    const client = await signedInClient(server)
    server.ai.failNext = true
    const res = await client.post('/api/ai/edit', editBody())
    assert.equal(res.status, 502)
    assert.equal((await client.get('/api/auth/me')).json.user.credits, 3)
  })

  it('never lets parallel edits spend more credits than the user has', async () => {
    const client = await signedInClient(server)
    const results = await Promise.all(Array.from({ length: 8 }, () => client.post('/api/ai/edit', editBody())))
    const ok = results.filter((r) => r.status === 200).length
    const refused = results.filter((r) => r.status === 402).length
    assert.equal(ok, 3)
    assert.equal(refused, 5)
    assert.equal((await client.get('/api/auth/me')).json.user.credits, 0)
  })

  it('refunds a rejected edit once, within the daily limit', async () => {
    const client = await signedInClient(server)
    const first = await client.post('/api/ai/edit', editBody())
    const refund = await client.post(`/api/ai/edit/${first.json.jobId}/refund`)
    assert.equal(refund.status, 200)
    assert.equal(refund.json.credits, 3)
    assert.equal((await client.post(`/api/ai/edit/${first.json.jobId}/refund`)).status, 429)

    const second = await client.post('/api/ai/edit', editBody())
    assert.equal((await client.post(`/api/ai/edit/${second.json.jobId}/refund`)).status, 429)
  })

  it("can't refund someone else's edit", async () => {
    const owner = await signedInClient(server)
    const other = await signedInClient(server)
    const edit = await owner.post('/api/ai/edit', editBody())
    assert.equal((await other.post(`/api/ai/edit/${edit.json.jobId}/refund`)).status, 400)
  })

  it('rejects non-PNG images and odd sizes', async () => {
    const client = await signedInClient(server)
    const notPng = await client.post('/api/ai/edit', { ...editBody(), image: Buffer.from('GIF89a').toString('base64') })
    assert.equal(notPng.status, 400)
    const badSize = await client.post('/api/ai/edit', { ...editBody(), size: '5000x100' })
    assert.equal(badSize.status, 400)
    assert.equal((await client.get('/api/auth/me')).json.user.credits, 3)
  })

  it('caps the AI text finder per day', async () => {
    const client = await signedInClient(server)
    const body = { image: 'data:image/png;base64,iVBORw0KGgo=', width: 10, height: 10 }
    assert.equal((await client.post('/api/ai/detect', body)).status, 200)
    assert.equal((await client.post('/api/ai/detect', body)).status, 200)
    const third = await client.post('/api/ai/detect', body)
    assert.equal(third.status, 429)
    assert.equal(third.json.error.code, 'limit_reached')
  })
})
