# KeepItAll

Self-serve flight compensation claims under **EU261** and **UK261**. Passengers check their flight for free, then buy a one-off claim pack (€19 for EU261 claims, €18 for UK261 claims) and send it to the airline themselves — keeping 100% of the payout instead of paying a claim company 25–35%.

Product rules and scope live in [`CLAUDE.md`](./CLAUDE.md). The most important one: **eligibility and amounts are decided by deterministic code in `lib/rules/`, never by the LLM.**

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript (strict) · Tailwind 4 · shadcn/ui · Supabase · Stripe · Anthropic API · Resend · `@react-pdf/renderer` · Umami · Vitest · Vercel

## Getting started

Requires Node 22.18+.

```bash
npm install
npm run dev            # http://localhost:3000
```

The free check works with **no configuration**. Each integration switches on when its environment variables are set (see below); without them the site degrades gracefully (e.g. checkout shows "opens soon").

```bash
npm run lint           # ESLint
npm run typecheck      # next typegen + tsc
npm test               # Vitest (PDF text checks need `pdftotext` from poppler-utils)
npm run build
npm run airports:generate   # rebuild data/airports.json from OurAirports
```

CI (`.github/workflows/ci.yml`) runs all four checks on every push.

## Configuration

**Step-by-step account setup: [`docs/SETUP.md`](docs/SETUP.md).** Copy `.env.example` to `.env.local` for local development, or set the variables in Vercel.

| Integration | Variables | Setup |
|---|---|---|
| Site | `NEXT_PUBLIC_SITE_URL` | Your public URL — used in emails, checkout redirects and the sitemap. Must be set **at build time** (the sitemap and robots.txt are prerendered). |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Run every file in `supabase/migrations/` in order. All tables have RLS on with **no policies**: only the server (service role) can read or write. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID_EUR`, `STRIPE_PRICE_ID_GBP`, `STRIPE_WEBHOOK_SECRET` (optional `STRIPE_AUTOMATIC_TAX`) | One product with two one-time, tax-inclusive EUR prices: EU261 claims 19.00, UK261 claims 18.00 (must match `lib/pricing.json`). Webhook → `<site>/api/webhooks/stripe`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`. Managed Payments (Stripe as merchant of record, handles VAT) is on by default; `STRIPE_MANAGED_PAYMENTS=false` makes you the seller, responsible for VAT. |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Verify your sending domain. Without it, nothing is emailed but the pack page still works. |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`) | Optional. Without it, the claim letter uses the static template. |
| Umami | none (`analytics` in `lib/site.json`) | Cookieless analytics. Only the production hostnames are tracked; pack and result tokens are stripped from URLs. |
| Cron | `CRON_SECRET` | Vercel Cron calls `/api/cron/daily` (see `vercel.json`) with this as a bearer token. |

Check a deployment with `CRON_SECRET=… npm run setup:check -- https://your-site` (read-only checks of every integration), then do one test-mode purchase end to end.

## How it works

```
/check (wizard) ──► /result/<token>          token = base64url wizard answers, no personal data
                        │  "Get your claim pack"  (server action re-assesses server-side)
                        ▼
                  Supabase claim (unguessable 256-bit pack token) ──► Stripe Checkout (hosted page)
                                                                           │
   /api/webhooks/stripe  ◄── checkout.session.completed (signature-verified) ────┘
        marks paid (single source of truth), emails the private /pack/<token> link
                        ▼
   /pack/<token>  waits for payment → details form → builds pack once → stored,
                  shown, emailed with PDF  (/pack/<token>/pdf)
                        ▼
   /api/cron/daily  follow-up emails (reply check, escalate) + data retention
```

### Code map

| Path | What |
|---|---|
| `lib/rules/` | Rules engine: scope, distance, amounts, extraordinary circumstances, deadlines, `assessClaim`. Data in `lib/rules/config/*.json`, versioned by flight date. |
| `lib/letters/` | Claim facts, deterministic templates, LLM drafting with placeholder validation and template fallback, claim pack assembly. |
| `lib/check/`, `lib/result/` | Wizard answers, URL token, step validation, result-screen view model. |
| `lib/claims/` | Claim store (Supabase + in-memory), checkout/payment/details service, follow-ups and retention (`lifecycle.json`). |
| `lib/payments/`, `lib/email/`, `lib/pdf/` | Stripe, Resend + email templates, PDF document. |
| `lib/server/deps.ts` | Builds real dependencies from env (the only place integrations are wired). |
| `data/` | `airports.json` (generated), `airlines.json`, `enforcement-bodies.json`. |
| `app/`, `components/` | Pages, routes and UI. No business logic in components. |

## Privacy

- The free check collects no personal data.
- Personal details are collected only after payment, stored separately (`claim_details`), and deleted after the retention period in `lib/claims/lifecycle.json`.
- The LLM never receives names, emails, addresses or booking references — it writes the letter body with placeholders that code fills in.
- Analytics are cookieless, with no autocapture, session recording or person profiles.
- Pack URLs are secrets: they send no `Referer`, are `noindex` and uncached.

## Must be verified by a human before launch

Nothing below is shown to users until marked verified, but launch depends on it:

- [ ] **Limitation periods** — `lib/rules/config/deadlines.json` (all `verified: false`).
- [ ] **Airline claim form URLs** — `data/airlines.json`: links found on official sites (29 of 30), all `verified: false`. Check them with [`docs/airline-claim-links.md`](docs/airline-claim-links.md).
- [ ] **Enforcement bodies and ADR schemes** — `data/enforcement-bodies.json` (URLs for FR and GR missing; ADR membership is airline-specific).
- [ ] **Case-law references** in `lib/rules/config/extraordinary.json` and `lib/letters/citations.ts` (Sturgeon, Nelson, Wallentin-Hermann, etc.).
- [ ] **Legal pages** — `app/legal/{terms,privacy,refunds}` are complete but need a lawyer's review.
- [ ] **Retention periods** — `lib/claims/lifecycle.json` (personal details currently kept 2 years).
- [ ] **Open legal questions**
  - UK261 inbound cover for Norwegian, Icelandic and Swiss carriers (currently *not* covered; `inboundCarrierGroups` in `rulesets.json`).
  - Delay of exactly 4h00 on flights over 3,500 km: Art. 7(2) "does not exceed" (reduced, current) vs Sturgeon "less than four hours" (full).

When EU261 reform is adopted, add a new version to `lib/rules/config/rulesets.json` with its `effectiveFrom` date and close the current one with `effectiveTo`.
