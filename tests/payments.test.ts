import assert from 'node:assert/strict'
import { after, before, describe, it } from 'node:test'
import { hmacSha256Base64 } from '../server/lib/crypto.ts'
import { SECRET_KEY, signedInClient, startTestServer, type TestServer } from './helpers.ts'

const PHONE = '9876543210'

/** Sends the raw text exactly as signed: Cashfree's amounts like 199.00 must not be re-serialised. */
function webhook(server: TestServer, raw: string, secret = SECRET_KEY) {
  const timestamp = String(Date.now())
  return fetch(`${server.url}/api/payments/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-webhook-timestamp': timestamp, 'x-webhook-signature': hmacSha256Base64(secret, timestamp + raw) },
    body: raw,
  })
}

function paymentSuccess(orderId: string, paymentId: string, amountPaise: number): string {
  const rupees = (amountPaise / 100).toFixed(2)
  return `{"data":{"order":{"order_id":"${orderId}","order_amount":${rupees},"order_currency":"INR"},"payment":{"cf_payment_id":"${paymentId}","payment_status":"SUCCESS","payment_amount":${rupees},"payment_currency":"INR"}},"type":"PAYMENT_SUCCESS_WEBHOOK"}`
}

describe('payments', () => {
  let server: TestServer
  before(async () => {
    server = await startTestServer()
  })
  after(async () => {
    await server.close()
  })

  it('lists packs publicly', async () => {
    const res = await fetch(`${server.url}/api/payments/packs`)
    const json = await res.json()
    assert.equal(json.enabled, true)
    assert.deepEqual(json.packs.map((p: { id: string }) => p.id), ['starter', 'pro', 'studio'])
  })

  it('creates a Cashfree order with the customer details and saves the phone', async () => {
    const client = await signedInClient(server)
    const res = await client.post('/api/payments/orders', { packId: 'starter', phone: '+91 98765-43210' })
    assert.equal(res.status, 201)
    const { orderId, paymentSessionId, mode } = res.json.checkout
    assert.equal(paymentSessionId, `session_${orderId}`)
    assert.equal(mode, 'sandbox')

    const sent = server.gateway.created.find((o) => o.orderId === orderId)!
    assert.equal(sent.amount, 19900)
    assert.equal(sent.customer.phone, PHONE)
    // Local http origin: no return / webhook URLs (Cashfree needs https).
    assert.equal(sent.returnUrl, null)
    assert.equal((await client.get('/api/auth/me')).json.user.phone, PHONE)
  })

  it('rejects a bad phone number', async () => {
    const client = await signedInClient(server)
    assert.equal((await client.post('/api/payments/orders', { packId: 'starter', phone: '12345' })).status, 400)
    assert.equal((await client.post('/api/payments/orders', { packId: 'starter' })).status, 400)
  })

  it('credits a paid order exactly once, from browser and webhook', async () => {
    const client = await signedInClient(server)
    const { orderId } = (await client.post('/api/payments/orders', { packId: 'starter', phone: PHONE })).json.checkout

    const unpaid = await client.post('/api/payments/confirm', { orderId })
    assert.equal(unpaid.status, 409)

    server.gateway.pay(orderId, 19900)
    const confirm = await client.post('/api/payments/confirm', { orderId })
    assert.equal(confirm.status, 200)
    assert.equal(confirm.json.credits, 13)

    assert.equal((await client.post('/api/payments/confirm', { orderId })).json.credits, 13)
    assert.equal((await webhook(server, paymentSuccess(orderId, `cf_pay_${orderId}`, 19900))).status, 200)
    assert.equal((await client.get('/api/auth/me')).json.user.credits, 13)
  })

  it('credits via webhook alone (user closed the tab)', async () => {
    const client = await signedInClient(server)
    const { orderId } = (await client.post('/api/payments/orders', { packId: 'pro', phone: PHONE })).json.checkout
    assert.equal((await webhook(server, paymentSuccess(orderId, 'cf_pay_2', 79900))).status, 200)
    assert.equal((await client.get('/api/auth/me')).json.user.credits, 53)
  })

  it('rejects forged webhooks and ignores underpayment', async () => {
    const client = await signedInClient(server)
    const { orderId } = (await client.post('/api/payments/orders', { packId: 'starter', phone: PHONE })).json.checkout
    assert.equal((await webhook(server, paymentSuccess(orderId, 'cf_x', 19900), 'wrong-secret')).status, 401)
    assert.equal((await webhook(server, paymentSuccess(orderId, 'cf_x', 19800))).status, 200)
    assert.equal((await client.get('/api/auth/me')).json.user.credits, 3)

    server.gateway.pay(orderId, 100)
    assert.equal((await client.post('/api/payments/confirm', { orderId })).status, 400)
    assert.equal((await client.get('/api/auth/me')).json.user.credits, 3)
  })

  it("won't confirm another user's order", async () => {
    const owner = await signedInClient(server)
    const thief = await signedInClient(server)
    const { orderId } = (await owner.post('/api/payments/orders', { packId: 'starter', phone: PHONE })).json.checkout
    server.gateway.pay(orderId, 19900)
    assert.equal((await thief.post('/api/payments/confirm', { orderId })).status, 404)
    assert.equal((await thief.post('/api/payments/confirm', { orderId: 'not-an-order' })).status, 404)
  })

  it('rejects unknown packs', async () => {
    const client = await signedInClient(server)
    assert.equal((await client.post('/api/payments/orders', { packId: 'free-money', phone: PHONE })).status, 400)
  })
})
