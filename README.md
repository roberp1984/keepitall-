# KeepItAll

Self-serve flight compensation claims under **EU261** and **UK261**. Passengers check their flight for free, then buy a one-off claim pack (€19 / £17) and send it to the airline themselves — keeping 100% of the payout instead of paying a claim company 25–35%.

Product rules and scope live in [`CLAUDE.md`](./CLAUDE.md). The most important one: **eligibility and amounts are decided by deterministic code in `lib/rules/`, never by the LLM.**

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript (strict) · Tailwind 4 · shadcn/ui · Supabase · Lemon Squeezy · Anthropic API · Resend · `@react-pdf/renderer` · PostHog · Vitest · Vercel

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

Copy `.env.example` to `.env.local` (or set the variables in Vercel).

| Integration | Variables | Setup |
|---|---|---|
| Site | `NEXT_PUBLIC_SITE_URL` | Your public URL — used in emails, checkout redirects and the sitemap. Must be set **at build time** (the sitemap and robots.txt are prerendered). |
| Supabase | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Run every file in `supabase/migrations/` in order. All tables have RLS on with **no policies**: only the server (service role) can read or write. |
| Lemon Squeezy | `LEMONSQUEEZY_API_KEY`, `LEMONSQUEEZY_STORE_ID`, `LEMONSQUEEZY_VARIANT_ID_EUR`, `LEMONSQUEEZY_VARIANT_ID_GBP`, `LEMONSQUEEZY_WEBHOOK_SECRET` | One product with two variants (EUR 19, GBP 17). Webhook → `<site>/api/webhooks/lemonsqueezy`, events `order_created` and `order_refunded`. |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` | Verify your sending domain. Without it, nothing is emailed but the pack page still works. |
| Anthropic | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`) | Optional. Without it, the claim letter uses the static template. |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Enable **cookieless mode** in the project settings, or events are dropped. |
| Cron | `CRON_SECRET` | Vercel Cron calls `/api/cron/daily` (see `vercel.json`) with this as a bearer token. |

Before going live, do one test-mode purchase end to end: check → checkout → webhook → details → pack page, email and PDF.

## How it works

```
/check (wizard) ──► /result/<token>          token = base64url wizard answers, no personal data
                        │  "Get your claim pack"  (server action re-assesses server-side)
                        ▼
                  Supabase claim (unguessable 256-bit pack token) ──► Lemon Squeezy checkout
                                                                           │
   /api/webhooks/lemonsqueezy  ◄── order_created (HMAC-verified) ─────────┘
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
| `lib/payments/`, `lib/email/`, `lib/pdf/` | Lemon Squeezy, Resend + email templates, PDF document. |
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
- [ ] **Airline claim form URLs / emails** — `data/airlines.json` (all `null`, `verified: false`).
- [ ] **Enforcement bodies and ADR schemes** — `data/enforcement-bodies.json` (URLs for FR and GR missing; ADR membership is airline-specific).
- [ ] **Case-law references** in `lib/rules/config/extraordinary.json` and `lib/letters/citations.ts` (Sturgeon, Nelson, Wallentin-Hermann, etc.).
- [ ] **Terms and privacy pages** — `app/legal/terms`, `app/legal/privacy` are drafts.
- [ ] **Retention periods** — `lib/claims/lifecycle.json` (personal details currently kept 2 years).
- [ ] **Open legal questions**
  - UK261 inbound cover for Norwegian, Icelandic and Swiss carriers (currently *not* covered; `inboundCarrierGroups` in `rulesets.json`).
  - Delay of exactly 4h00 on flights over 3,500 km: Art. 7(2) "does not exceed" (reduced, current) vs Sturgeon "less than four hours" (full).

When EU261 reform is adopted, add a new version to `lib/rules/config/rulesets.json` with its `effectiveFrom` date and close the current one with `effectiveTo`.
