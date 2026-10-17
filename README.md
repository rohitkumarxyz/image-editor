# Image Text Editor

Edit text inside any image so it looks like it was never changed. Upload a photo, scan or design, click a
line of text, type the new words. The app matches the original font, size, colour, spacing and slant.
**AI exact match** redraws the text pixel-perfect with OpenAI and is paid per edit with credits.

- Free, no account: text detection (Tesseract), font-matched edits, crop (any shape), PNG/PDF download.
- With an account: AI text finder (brush/script/tilted text) and AI exact-match edits (1 credit each).
- New accounts get 3 free credits; packs from ₹199 / 10 edits via Cashfree (UPI, cards, net banking).
- Each AI edit's real OpenAI cost is stored on the `aiJobs` record (`providerCostUsd`) for margin checks.
- User images are never stored. They are sent to OpenAI only for the requested edit.

## Pages

| Path | What |
|---|---|
| `/` | Website (light theme): upload box as the hero, real before/after examples, how it works, pricing, FAQ |
| `/editor` | The editor (dark workspace); opens a file dropped on the home page |
| `/account` | Profile, credits & history, password, sign out everywhere, delete account |
| `/terms`, `/privacy`, `/refunds`, `/contact` | Legal pages (Cashfree needs these before live payments). Review the wording before launch. |

Marketing media lives in `public/media` (videos) and `public/examples` (real before/after results made with this app).

## Stack

| Part | Tech |
|---|---|
| App | Next.js 16 (App Router) + React 19. Pages in `app/`, UI in `src/` (atoms → molecules → organisms → views) |
| API | `server/`, routes → services → repositories, served by one Next.js route (`app/api/[[...path]]/route.ts`) |
| Database | MongoDB (`users`, `sessions`, `ledger`, `orders`, `aiJobs`) |
| AI | OpenAI image edits + vision (server-side only) |
| Payments | Cashfree Orders + webhook |

Design notes: [docs/superpowers/specs/2026-10-08-production-launch-design.md](docs/superpowers/specs/2026-10-08-production-launch-design.md).

### How a request flows

| Request | Handled by |
|---|---|
| `/api/*` | `app/api/[[...path]]/route.ts` → `server/api.ts`: health/config → payment webhook (raw body) → CSRF check → JSON body → session → rate limit → route. Sets its own security headers. |
| Pages (`/`, `/editor`, …) | `proxy.ts` adds the security headers and a fresh CSP nonce per request → `app/<page>/page.tsx` renders the view from `src/views/`. Website pages render on the server; the editor only in the browser. |
| `/robots.txt`, `/sitemap.xml` | `app/robots.txt/route.ts`, `app/sitemap.xml/route.ts` |

## Run locally

Needs Node 20.9+ and MongoDB on `mongodb://127.0.0.1:27017` (e.g. `brew services start mongodb-community`).

```bash
npm install
echo "OPENAI_API_KEY=sk-..." > .env    # the only setting needed locally (Next.js reads .env by itself)
npm run dev                            # app + API on http://localhost:5173
```

Without Cashfree keys the app runs with payments switched off ("not set up yet").

```bash
npm test          # API tests against a throwaway local MongoDB database (fake OpenAI + Cashfree);
                  # page tests run against the built server, so run `npm run build` first
npm run lint
npm run typecheck
npm run build     # .next/standalone: one self-contained server for pages + API
npm start         # runs it on $PORT (production mode: needs https APP_ORIGIN and all production settings)
```

## Go live

1. **Database**: create a MongoDB Atlas cluster; allow your host's IPs; copy the connection string.
2. **Host**: any Docker host (Render, Railway, Fly.io, a VPS). Build with the included `Dockerfile`.
3. **Environment**: set the variables from `.env.example` in the host's settings (not in a file).
   - `NODE_ENV=production`, `APP_ORIGIN=https://your-domain` (must be https), `TRUST_PROXY=1`.
4. **Cashfree**: in the dashboard (Developers → API Keys) copy the App ID and Secret Key into `CASHFREE_APP_ID` and
   `CASHFREE_SECRET_KEY`; set `CASHFREE_ENV=sandbox` to test, `production` for real money (keys differ per mode).
   - Each order already tells Cashfree the webhook URL (`https://your-domain/api/payments/webhook`). Also add it under
     Developers → Webhooks (payment success event, version 2025-01-01 or later) so it shows in the dashboard. There is no
     separate webhook secret: Cashfree signs webhooks with the Secret Key.
   - Cashfree needs https for the return and webhook URLs, so on `http://localhost` payments work in the popup but the
     webhook and bank-page redirects only work on the deployed https site.
   - Test with test-mode keys first, then switch to live keys.
5. **Check**: `GET /api/health` returns `{"ok":true}`; sign up, run one AI edit, buy the smallest pack.

## Security

- Sessions: random token in an HttpOnly, Secure, SameSite=Lax `__Host-` cookie; only its hash is stored.
- Passwords: scrypt with per-user salt; generic sign-in errors (no account discovery).
- Every write request must come from `APP_ORIGIN` (CSRF protection); strict Content-Security-Policy.
- Rate limits on sign-in failures, sign-ups per network, API, AI and payments.
- Credits change atomically (balance can never go negative); purchases are credited exactly once,
  whether the browser or the webhook reports first. Every change is recorded in the `ledger` collection.
- Payments are confirmed by asking Cashfree directly, never trusting the browser; webhook signatures are verified with constant-time HMAC checks.
- OpenAI key and payment secrets exist only on the server; config is validated at start-up.

## Operating notes

- Logs are JSON lines (`event` field), e.g. `order_credited`, `openai_edit_failed`, `payment_signature_invalid`.
- Rate limits use in-memory counters: run **one** instance, or add a shared store before scaling out. For the same
  reason, don't deploy to serverless hosts (e.g. Vercel); use a Docker host.
- Client IPs come from `X-Forwarded-For`. Set `TRUST_PROXY` to the number of proxies in front of the app (1 on
  Render / Railway / Fly). With `TRUST_PROXY=0` and no proxy, a client could send a fake header to dodge IP limits.
- Not built yet: email verification / password reset (needs an email provider), saved projects, admin dashboard.
