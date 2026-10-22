# Setting up accounts and keys

Follow these in order: later steps need the URL from step 1. Dashboards change, so menu names may differ slightly. `npm run setup:check` (step 9) confirms everything at the end.

**Never paste keys into chats, issues or code.** They go in Vercel's environment variables only. Locally, use `.env.local`, which git ignores.

## 1. Vercel: deploy the site

1. Sign in to Vercel with GitHub and **import** `roberp1984/keepitall-`. It detects Next.js automatically.
2. Production branch: `rules-engine` (the repo's only branch).
3. Deploy. The free check works with no keys.
4. Optionally add your own domain (Project → Domains).
5. Add the environment variable `NEXT_PUBLIC_SITE_URL` = your final URL, e.g. `https://keepitall.example`, with no trailing slash.

## 2. Cron secret

Generate a random secret on your computer and add it to Vercel as `CRON_SECRET`:

```bash
openssl rand -hex 32
```

Keep a copy in your password manager: you'll need it for step 9.

## 3. Supabase: database

1. Create a project in an **EU region** (e.g. Frankfurt) or London, for GDPR / UK GDPR.
2. **SQL Editor** → run, in this order:
   - `supabase/migrations/20261022000000_init.sql`
   - `supabase/migrations/20261022010000_lifecycle.sql`
3. **Project Settings → API**, then add to Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the **service_role** key. It's secret and server-only. The anon key is not used.

## 4. Lemon Squeezy: payments

1. Create a store. Lemon Squeezy must **activate the store** before it can take live payments, and that review can take a few days, so start it early. Test mode works straight away.
2. **Store currency.** A store charges in one currency. With a EUR store, the "£17" variant is charged in EUR (customers are shown a converted estimate). Decide whether that's acceptable, or set the GBP variant to the EUR amount closest to £17. `setup:check` shows exactly what each variant charges.
3. **Products → New product** "Claim pack", single payment, with two variants:
   - EUR: 19.00
   - GBP: see the note above
4. Add to Vercel:
   - `LEMONSQUEEZY_STORE_ID`: Settings → Stores
   - `LEMONSQUEEZY_VARIANT_ID_EUR` and `LEMONSQUEEZY_VARIANT_ID_GBP`: the variant IDs (shown in the product's variant settings)
   - `LEMONSQUEEZY_API_KEY`: Settings → API (create a key)
5. **Settings → Webhooks → add**:
   - URL: `https://<your site>/api/webhooks/lemonsqueezy`
   - Signing secret: a new random string (`openssl rand -hex 32`). Add the same value to Vercel as `LEMONSQUEEZY_WEBHOOK_SECRET`.
   - Events: `order_created` and `order_refunded`

Start in **test mode**. Test-mode and live-mode API keys and webhooks are separate (step 11).

## 5. Resend: email

1. **Domains → Add domain**. Use a subdomain such as `mail.keepitall.example`, and add the DNS records it shows (SPF/DKIM). Wait until it says *Verified*.
2. **API Keys** → create one with sending access.
3. Add to Vercel:
   - `RESEND_API_KEY`
   - `EMAIL_FROM` = `KeepItAll <claims@mail.keepitall.example>` (must be on the verified domain)

## 6. Anthropic: letter drafting (optional)

Without this, letters use the static template, which is complete on its own.

1. Console → API keys → create a key.
2. Add to Vercel `ANTHROPIC_API_KEY`, and `ANTHROPIC_MODEL` = `claude-sonnet-5-5`.

## 7. PostHog: analytics (optional)

1. Create a project on **EU Cloud**.
2. Project settings → enable **cookieless mode**. Without it, PostHog drops the site's events.
3. Add to Vercel `NEXT_PUBLIC_POSTHOG_KEY` (the project API key, `phc_…`) and `NEXT_PUBLIC_POSTHOG_HOST` = `https://eu.i.posthog.com`.

## 8. Redeploy

`NEXT_PUBLIC_*` variables are built into the site, so after adding or changing them, **redeploy** (Deployments → ⋯ → Redeploy).

## 9. Check the setup

On your computer, in the repo:

```bash
CRON_SECRET=<your cron secret> npm run setup:check -- https://<your site>
```

It runs read-only checks on the server, using the real Vercel environment, and prints ✔ / ! / ✖ for each service. Fix every ✖. A "!" is a warning to read; the GBP price warning is expected with a EUR store.

## 10. Test purchase (test mode)

1. On the live site, check an eligible flight, e.g. London Heathrow → New York JFK on British Airways, arrived 5 hours late.
2. Get the claim pack and pay with test card `4242 4242 4242 4242`, any future date, any CVC.
3. Confirm, in order:
   - You land on "Confirming your payment" and within seconds see the details form.
   - The "payment confirmed" email arrives.
   - Submitting the details shows the pack. Download the PDF.
   - The "pack ready" email arrives with the PDF attached.
   - In Supabase, `claims` has a row with status `pack_ready`, and `orders` has one paid order.
4. Refund the test order in Lemon Squeezy. The pack page should then say the order was refunded.

## 11. Go live

1. In Lemon Squeezy, switch to live mode once the store is activated.
2. Create a **live** API key and a **live** webhook (same URL and events, new signing secret).
3. Update `LEMONSQUEEZY_API_KEY` and `LEMONSQUEEZY_WEBHOOK_SECRET` in Vercel (variant IDs may differ in live mode too), then redeploy.
4. Run `npm run setup:check` again, then make one real low-value purchase and refund it.

Before launch, also work through **"Must be verified by a human"** in the [README](../README.md).
