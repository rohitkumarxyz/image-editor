# Product review: Image Text Editor

Date: 8 October 2026 · Reviewed: every page and state, desktop (1440×900) and mobile (390×844), signed out and signed in.

## Who we build for

| Persona | Typical job | What they care about |
|---|---|---|
| **Shop / café owner** (primary) | Change a price, offer or phone number on a poster, menu or shop board | Works on the phone, fast, cheap, Hindi + English |
| **Social media / freelancer** | Reuse one design for many posts (date, headline, name) | Quality that looks untouched, quick repeat edits |
| **Event / coaching / small org** | Update a banner or flyer when the source file is lost | Simple, no design skills needed |

Most of them are **not designers** and many will arrive **on a phone** from WhatsApp or Instagram. Every finding below is judged against that.

## Top issues (fix first)

| # | Issue | Why it matters |
|---|---|---|
| 1 | **The editor is unusable on mobile**: the toolbar wraps into 5 rows, the page scrolls sideways (69 px), the image is tiny, the inspector is far below | Most visitors are on phones; this loses them at the core moment |
| 2 | **The inspector shows ~20 technical controls** (letter spacing, padding, nudge X/Y, erase mode) before the user even types | Non-designers freeze; the two things they need (new text, AI match) are lost |
| 3 | **Intent is lost after sign-up**: clicking "AI exact match" or "Buy Pro" while signed out opens sign-up, and after signing up nothing happens | Highest-intent moment in the funnel; the user has to find the button again |
| 4 | **No way to recover a forgotten password** | Paying users get locked out of their credits |
| 5 | **Leaving the editor throws away all edits without a warning** | Data loss; people use the browser back button a lot |

## Findings by page

Priority: **P0** = blocks launch or core use · **P1** = clear conversion or usability loss · **P2** = polish.
Effort: S = under an hour · M = a few hours · L = a day or more.

### Editor (`/editor`)

| ID | Finding | Proposal | P | Effort |
|---|---|---|---|---|
| E1 | Mobile: toolbar wraps 5 rows, 69 px sideways scroll, inspector far below the image | Mobile layout: one scrollable toolbar row, image first, inspector as a panel under the image when a box is selected, sticky bottom bar with Detect and Download | P0 | M |
| E2 | Inspector shows Font, Background erase and Position (letter spacing, padding, nudge X/Y…) by default | Show only **New text**, **AI exact match** and **Apply**. Put Font / Erase / Position in a collapsed "Fine-tune" section | P1 | S |
| E3 | "Apply / erase box" is unclear; the typed text already applies live | Rename to "Apply", keep AI as the main call to action with its cost | P1 | S |
| E4 | After sign-up from the AI button, the user must click AI again | Remember the action and run it right after sign-up (if credits allow) | P1 | S |
| E5 | No warning when leaving with unsaved edits (tab close, back button) | `beforeunload` warning while there are edits not yet downloaded | P1 | S |
| E6 | Toolbar uses technical labels and bare symbols: "Lines", "Hold: original", "Clear boxes", ⟲ ⟳ ↶ ↷ | Clear labels ("Compare"), icons with text on wide screens, group rarely used tools | P1 | S |
| E7 | User must click "Detect text" after every upload | Detect automatically when an image opens | P1 | S |
| E8 | Guest detection lists noise ("ला चना" 43 %) and shows confidence % that means nothing to users | Hide boxes under 60 % confidence for guests; hide the % column | P2 | S |
| E9 | "Sign in to also find brush, script…" toast appears on every detect | Show it once per session | P2 | S |
| E10 | Progress text is technical ("Reading cleaned image (1/2)") | "Finding text… 40 %" | P2 | S |
| E11 | Empty editor screen is plain and offers no example | Reuse the home-page examples ("No image? Try one") | P2 | S |
| E12 | No paste support (Ctrl/⌘+V of a copied image) | Paste an image anywhere in the editor to open it | P2 | S |
| E13 | 32 font files (~1.3 MB) download before any text is detected | Fine for now; later load only the fonts the detected text needs | P2 | M |

### Home page (`/`)

| ID | Finding | Proposal | P | Effort |
|---|---|---|---|---|
| L1 | The how-it-works video (2 MB) downloads on page load though it is far below the fold; the page weighs 3 MB | Load and play the video only when it scrolls into view (page drops to ~1 MB) | P1 | S |
| L2 | "Buy Pro" when signed out opens sign-up, then nothing (same as E4) | After sign-up, open the buy dialog with that pack | P1 | S |
| L3 | Favicon is still the Vite logo | Brand favicon (a simple "T" mark in the brand blue) | P1 | S |
| L4 | Unknown URLs (e.g. `/pricing-old`) show the home page with status 200 | A small "Page not found" page with links home and to the editor | P2 | S |
| L5 | Every page loads 19 Google Font families' CSS (render-blocking), though only the editor needs them | Load the font stylesheet only when the editor opens | P2 | S |
| L6 | No `robots.txt` / `sitemap.xml`; social preview image URL is relative | Add both; make `og:image` absolute at deploy time | P2 | S |
| L7 | No "paste an image" hint in the hero | Mention Ctrl/⌘+V and support it (with E12) | P2 | S |

### Sign-in, buying, account

| ID | Finding | Proposal | P | Effort |
|---|---|---|---|---|
| A1 | No "Forgot password?" | Now: link to email support from the sign-in dialog. Next: real reset by email once an email provider (e.g. Resend) is chosen | P0 (now: S) | S / M |
| A2 | No "show password" toggle on the password fields | Add a show/hide toggle | P2 | S |
| A3 | Email address can't be changed | Needs email verification first; later | P2 | L |
| A4 | Free credits can be farmed with fake emails (3 free AI edits per account) | Email verification before free credits; until then the 5 sign-ups per hour per network limit stays | P1 (needs email) | M |

### Launch / business (not code)

| ID | Item | Owner |
|---|---|---|
| B1 | Real logo and brand name | Rohit |
| B2 | Legal pages reviewed (terms, privacy, refunds: the 7-day refund promise and "reply within one working day" are proposals) | Rohit / advisor |
| B3 | GST: check whether registration and GST on credit packs are needed | Rohit / CA |
| B4 | Razorpay live account (needs the legal pages and a support email) | Rohit |
| B5 | Email provider for password reset and verification (A1, A4) | Rohit picks; then engineering |

## Test results

Run on 8 October 2026 against the production build (`npm run build`, served by the Node server) in headless Chrome.

| Area | Result |
|---|---|
| Typecheck, lint | ✅ clean |
| API tests (`npm test`, 31 tests: auth, CSRF, rate limits, account settings, credits, parallel spending, refunds, payments) | ✅ 31 / 31 pass |
| Main flow: sign up → 3 credits → detect (8 lines found) → AI edit → 2 credits → history → buy dialog → sign out | ✅ pass |
| Undo / redo of typed edits | ✅ pass |
| Crop: rectangle, circle, polygon, freehand (size + transparency checked) | ✅ pass |
| PDF download | ✅ valid PDF |
| Content-Security-Policy violations (all pages, incl. OCR worker and fonts) | ✅ none |
| Keyboard: Tab order through the home page, visible focus ring | ✅ pass |
| Basic accessibility: alt text, button names, form labels, one H1, `lang` | ✅ pass |
| Mobile (390 px): home, account, legal | ✅ no sideways scroll |
| Mobile (390 px): editor | ❌ 69 px sideways scroll, 5-row toolbar (E1) |
| Page weight (production) | Home 3.0 MB (2 MB is the video, L1) · Account/legal 0.3 MB · Editor 1.6 MB (fonts, E13) |

### Bug found and fixed during testing

| ID | Bug | Fix |
|---|---|---|
| T1 | **Good AI edits were rejected as "different text colour"** for thin text in a widened edit area (e.g. "BIG DREAMS" → "BIG DREAMS EVERY DAY"). The check compared the darkest 12 % of pixels, which depends on how much text the area holds, so the same ink read lighter or darker. It wasted the user's daily refunds. | The check now compares the colour of the **stroke cores** (pixels close to the strongest contrast), which doesn't depend on text length or weight. Verified: same colour with longer / thinner text passes; green or red instead of black is still rejected; the real edit now passes first time. |

## Build plan and status

Updated after the engineering round on 8 October 2026. Re-tested: typecheck, lint, 34 / 34 API tests (3 new: page status codes, robots, sitemap), main flow, crop + PDF, mobile and desktop screenshots.

| ID | Item | Status |
|---|---|---|
| T1 | AI colour check rejected good edits | ✅ Fixed (stroke-core colour) |
| E1 | Mobile editor | ✅ One scrolling toolbar row with Detect + Download first, image sized to its shape, panel below, no sideways scroll |
| E2, E3 | Simpler inspector | ✅ Text + AI button + Erase / Reset / Delete; font, erase and position folded into "Fine-tune" (panel height 1,544 → ~850 px) |
| E4, L2 | Continue after sign-up | ✅ AI edit runs, or the buy dialog opens, right after sign-up; closing the dialog cancels it |
| E5 | Leave warning | ✅ Tab close / reload, in-app links and the back button, while edits aren't downloaded |
| E6 | Clearer toolbar | ✅ One row on desktop (89 → 47 px): icons, "Compare", zoom and boxes moved to a floating bar on the image, line/word choice and "Remove all" moved to the text list |
| E7 | Auto-detect | ✅ Text is found as soon as an image opens (about 3 s) |
| E8 | Guest detection noise | ✅ Boxes under 60 % confidence hidden without the AI finder; % column removed |
| E9, E10 | Toast once, friendly progress | ✅ |
| E11 | Examples on the empty editor | ✅ |
| E12, L7 | Paste an image (Ctrl/⌘+V) | ✅ Editor and home page |
| L1 | Lazy video | ✅ Video loads only when scrolled into view (home page ~3.0 → ~1.0 MB on first load) |
| L3 | Favicon | ✅ Brand mark (unused Vite `icons.svg` removed) |
| L4 | 404 page | ✅ "Page not found" page, and the server answers 404 for unknown paths |
| L5 | Editor fonts only in the editor | ✅ Home, account and legal pages no longer load the font stylesheet |
| L6 | robots.txt, sitemap.xml, absolute social image URL | ✅ Generated from `APP_ORIGIN` |
| A1 | Forgot password | ✅ For now: "Forgot password?" emails support. Real reset needs an email provider (B5) |
| A2 | Show password | ✅ All password fields |

**Still open**

| ID | Item | Blocked by |
|---|---|---|
| E13 | Load only the fonts the detected text needs | Engineering, later |
| A3 | Change email | Email verification (B5) |
| A4 | Email verification before free credits | Email provider (B5) |
| B1–B5 | Logo, legal review, GST, Razorpay live, email provider | Rohit |
| — | Tesseract misreads some brush words for guests ("Th", "A"); signed-in users get the AI finder, which reads them correctly | Product decision: offer the AI finder to guests (costs ~₹1 per detect)? |

