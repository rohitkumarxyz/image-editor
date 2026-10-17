# Production launch — design

Date: 2026-10-08 · Status: approved to build ("go ahead, create everything")

## Goal

Take the image text editor live as a paid product: anyone can edit text in images for free with the
font-matching editor, and pay per **AI exact-match edit**. Make it secure enough to run on the public
internet with real money and a real OpenAI bill.

## Business rules

| Rule | Value (configurable via env) |
|---|---|
| Cost of one AI exact-match edit | 1 credit |
| Free credits on sign-up | 3 |
| Credit packs (INR) | starter 10 / ₹99 · pro 50 / ₹399 · studio 150 / ₹999 |
| AI text finder (vision detect) | free for signed-in users, 30 per user per day |
| Self-service refunds (all AI drafts failed quality checks) | max 5 per user per day, within 15 min of the edit |
| Automatic refund | OpenAI error / timeout |

Free without an account: upload, OCR (Tesseract), font-matched edits, crop, PNG/PDF download.

User images are **never stored**; they pass through to OpenAI only.

## Architecture

```
browser (Vite React SPA) ──/api──▶ Express 5 server ──▶ MongoDB
                                         │
                                         ├──▶ OpenAI (images/edits, responses)
                                         └──▶ Razorpay (orders, webhook)
```

- Dev: Vite on :5173 proxies `/api` to Express on :8787.
- Prod: one Node process serves `dist/` (SPA) and `/api`. Docker image; MongoDB Atlas.

### Server layout (`server/`)

| Path | Responsibility |
|---|---|
| `index.ts` | boot: config → db → app → listen, graceful shutdown |
| `app.ts` | express app: security middleware, routes, static, error handler |
| `config.ts` | env schema (zod), fail fast on boot |
| `db.ts` | Mongo client, collections, indexes |
| `lib/` | `errors.ts` (AppError + handler), `logger.ts`, `validate.ts`, `crypto.ts` |
| `middleware/` | `security.ts` (helmet/CSP, origin check), `auth.ts` (session → user), `rateLimits.ts` |
| `modules/auth` | routes, service, users repo, sessions repo, password hashing |
| `modules/credits` | routes (balance, history, refund), service, ledger repo |
| `modules/payments` | routes (packs, create order, verify, webhook), service, orders repo, Razorpay client |
| `modules/ai` | routes (edit, detect), service (charge → call → refund), jobs repo, OpenAI client |

Layers: routes (HTTP + validation only) → services (business rules) → repos (Mongo only).

### Data model

| Collection | Fields | Indexes |
|---|---|---|
| `users` | email, name, passwordHash, credits, createdAt | email unique |
| `sessions` | tokenHash, userId, createdAt, expiresAt | tokenHash unique, expiresAt TTL |
| `ledger` | userId, delta, reason, refId, balanceAfter, createdAt | userId+createdAt |
| `orders` | userId, packId, credits, amount, currency, razorpayOrderId, status, razorpayPaymentId, createdAt, paidAt | razorpayOrderId unique |
| `aiJobs` | userId, kind (edit/detect), cost, status (charged/succeeded/failed/refunded), createdAt | userId+createdAt |

Credits change only via one service function that does an atomic conditional `$inc` and writes a ledger
row. Paid orders grant credits exactly once (atomic `created → paid` transition), whether the browser
callback or the webhook arrives first.

## Security

- Sessions: random 32-byte token in an HttpOnly, Secure (prod), SameSite=Lax cookie; only its SHA-256 is
  stored; 30-day TTL; rotated on login; deleted on logout.
- Passwords: scrypt (N=2^15) with per-user salt, timing-safe compare, 8–128 chars.
- CSRF: every non-GET request must carry an `Origin` matching `APP_ORIGIN` (webhook excluded, it is
  signature-verified instead).
- helmet with a strict CSP (self + Google Fonts, jsDelivr for Tesseract, Razorpay checkout).
- Rate limits: auth 10 / 15 min / IP; API 300 / 15 min / IP; AI 20 / min / user.
- zod validation on every body; JSON limit 100 kB, AI routes 25 MB.
- No user enumeration; generic login error; no stack traces in production responses.
- Razorpay payment + webhook signatures verified with HMAC-SHA256 and timing-safe compare.
- Secrets only from environment; `.env` git-ignored; `.env.example` documents them.

## UX

Toolbar shows credit balance and account menu; sign-in dialog (sign in / create account); buy-credits
dialog with packs; usage history; toasts for success/errors; AI button shows its cost; "not enough
credits" opens the buy dialog; undo/redo (Ctrl+Z / Ctrl+Shift+Z) for text edits.

## Testing

`node:test` + tsx against a local MongoDB test database: password hashing, sessions, atomic credit
spend/refund, order idempotency, Razorpay signature verification, and HTTP-level auth/CSRF checks.
Manual end-to-end check of the full flow in a browser.

## Not in this round

Saved projects, email verification / password reset (needs an email provider), admin dashboard,
multi-instance rate-limit store.
