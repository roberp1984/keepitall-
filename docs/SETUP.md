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

1. Create a project in **London (eu-west-2)**, matching the site's function region (`lhr1` in `vercel.json`), for GDPR / UK GDPR and low latency. If you pick Frankfurt instead, change `vercel.json` `regions` to `fra1`.
2. **SQL Editor** → run, in this order:
   - `supabase/migrations/20261022000000_init.sql`
   - `supabase/migrations/20261022010000_lifecycle.sql`
3. **Project Settings → API**, then add to Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the **service_role** key. It's secret and server-only. The anon key is not used.

## 4. Paddle: payments

Paddle is the merchant of record: it charges the customer, handles VAT and pays you out. It has two separate accounts: **sandbox** (test payments, works straight away, sandbox-vendors.paddle.com) and **live** (needs Paddle's business verification, which can take a few days, so start it early). Do everything below in sandbox first, then repeat in live (step 11).

1. **Catalog → Products → New product** "Claim pack", tax category *Standard digital goods*, with two **one-time** prices in **EUR**:
   - EU261 claim: 19.00
   - UK261 claim: 18.00

   The site shows exactly these prices, from `lib/pricing.json`. If you change one in Paddle, change it there too; `setup:check` fails if they differ.
2. **Checkout → Checkout settings → Default payment link**: `https://<your site>/pay`.
3. **Developer tools → Authentication**:
   - **API keys → New API key** with permissions to write transactions and read customers, prices and notification settings. Add it to Vercel as `PADDLE_API_KEY` (Sensitive).
   - **Client-side tokens → New client-side token**. Add it to Vercel as `PADDLE_CLIENT_TOKEN`. It's not secret: Paddle.js uses it in the browser.
4. Add the two price IDs (`pri_…`) to Vercel: `PADDLE_PRICE_ID_EUR` (19.00) and `PADDLE_PRICE_ID_GBP` (18.00).
5. **Developer tools → Notifications → New destination**:
   - Type: webhook. URL: `https://<your site>/api/webhooks/paddle`
   - Events: `transaction.completed`, `adjustment.created`, `adjustment.updated`
   - Save, then copy its **secret key** to Vercel as `PADDLE_WEBHOOK_SECRET` (Sensitive).

The environment is detected from the API key (sandbox keys contain `_sdbx_`); `PADDLE_ENVIRONMENT=sandbox|production` overrides it.

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

## 7. Umami: analytics

Already set up in `lib/site.json` (`analytics`): Umami Cloud website ID and the hostnames to track. To use another Umami account, change the website ID there. Umami is cookieless; the site sends pageviews and the funnel events manually so that `/pack/…` and `/result/…` tokens never reach it.

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
2. Get the claim pack and pay with Paddle's test card `4242 4242 4242 4242`, any future expiry date, CVC `100`.
3. Confirm, in order:
   - You land on "Confirming your payment" and within seconds see the details form.
   - The "payment confirmed" email arrives.
   - Submitting the details shows the pack. Download the PDF.
   - The "pack ready" email arrives with the PDF attached.
   - In Supabase, `claims` has a row with status `pack_ready`, and `orders` has one paid order.
4. Refund the test transaction in Paddle (Transactions → the order → Refund), then approve it if asked. The pack page should then say the order was refunded.

## 11. Go live

1. Once Paddle has verified your live account, repeat step 4 there: product and prices, default payment link, API key, client-side token and notification destination. Live IDs, keys and tokens all differ from sandbox ones.
2. Replace the five `PADDLE_*` variables in Vercel with the live values, then redeploy.
3. Run `npm run setup:check` again, then make one real low-value purchase and refund it.

Before launch, also work through **"Must be verified by a human"** in the [README](../README.md).
