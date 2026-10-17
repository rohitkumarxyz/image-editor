import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import path from 'node:path'
import { after, before, describe, it } from 'node:test'
import { MongoClient } from 'mongodb'

const ROOT = path.resolve(import.meta.dirname, '..')
const SERVER = path.join(ROOT, '.next', 'standalone', 'server.js')
const ORIGIN = 'https://edit.example.com'
const MONGODB_URI = process.env.TEST_MONGODB_URI ?? 'mongodb://127.0.0.1:27017'
const DB_NAME = `image_editor_pages_${process.pid}_${Date.now()}`

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer().listen(0, () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolve(port))
    })
    probe.on('error', reject)
  })
}

async function waitUntilUp(url: string): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (await fetch(url).then((res) => res.ok, () => false)) return
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('Next.js server did not start')
}

describe('web pages (built Next.js server)', { skip: existsSync(SERVER) ? false : 'run `npm run build` first' }, () => {
  let child: ChildProcess
  let url: string
  before(async () => {
    const port = await freePort()
    url = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, [SERVER], {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(port),
        HOSTNAME: '127.0.0.1',
        APP_ORIGIN: ORIGIN,
        MONGODB_URI,
        MONGODB_DB: DB_NAME,
        OPENAI_API_KEY: 'sk-test-not-used-0000000000',
        SUPPORT_EMAIL: 'support@example.com',
      },
      stdio: 'ignore',
    })
    await waitUntilUp(`${url}/api/health`)
  })
  after(async () => {
    if (child && child.exitCode === null) await new Promise((resolve) => child.once('exit', resolve).kill('SIGTERM'))
    const client = await MongoClient.connect(MONGODB_URI)
    await client.db(DB_NAME).dropDatabase()
    await client.close()
  })

  it('serves known pages with 200 and unknown ones with 404', async () => {
    for (const page of ['/', '/editor', '/account', '/terms', '/privacy', '/refunds', '/contact']) assert.equal((await fetch(url + page)).status, 200, page)
    const missing = await fetch(url + '/pricing-old')
    assert.equal(missing.status, 404)
    assert.match(missing.headers.get('content-type') ?? '', /html/)
  })

  it('makes the social preview image URL absolute', async () => {
    const html = await (await fetch(url + '/')).text()
    assert.ok(html.includes(`content="${ORIGIN}/media/hero-poster.jpg"`))
  })

  it('publishes robots.txt and a sitemap with public pages only', async () => {
    const robots = await (await fetch(url + '/robots.txt')).text()
    assert.match(robots, /Disallow: \/api\//)
    assert.ok(robots.includes(`Sitemap: ${ORIGIN}/sitemap.xml`))
    const sitemap = await (await fetch(url + '/sitemap.xml')).text()
    assert.ok(sitemap.includes(`<loc>${ORIGIN}/terms</loc>`))
    assert.ok(!sitemap.includes('/account'))
  })

  it('sends a fresh CSP nonce that matches the page scripts', async () => {
    const res = await fetch(url + '/')
    const csp = res.headers.get('content-security-policy') ?? ''
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1]
    assert.ok(nonce, csp)
    assert.ok((await res.text()).includes(`nonce="${nonce}"`))
    assert.ok(csp.includes("frame-ancestors 'none'"))
    assert.equal(res.headers.get('x-powered-by'), null)
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
    const again = (await fetch(url + '/')).headers.get('content-security-policy')
    assert.notEqual(again, csp)
  })

  it('renders the editor dark and the website light', async () => {
    assert.match(await (await fetch(url + '/editor')).text(), /<html[^>]*data-theme="dark"/)
    assert.match(await (await fetch(url + '/terms')).text(), /<html[^>]*data-theme="light"/)
  })
})
