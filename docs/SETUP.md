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

## 4. Stripe: payments

The site uses **Stripe Managed Payments** by default: Stripe is the merchant of record, so it sells to the customer and handles VAT, fraud and disputes (about 3.5% on top of the normal Stripe fee). Choose it when setting up the account ("Let us handle it" / "Simplify digital sales"); Stripe may review the business first.

Without it (`STRIPE_MANAGED_PAYMENTS=false`, and `merchantOfRecord: false` in `lib/site.json` so the legal pages say you are the seller), VAT is your responsibility: register for EU VAT OSS and UK VAT with your tax adviser. Stripe Tax can calculate it at checkout (`STRIPE_AUTOMATIC_TAX=true`).

Do everything below in **test mode** first (toggle at the top of the dashboard), then repeat in live mode (step 11).

1. **Product catalog → Add product** "Claim pack", with two **one-time** prices in **EUR**, tax behaviour **inclusive**:
   - EU261 claim: 19.00
   - UK261 claim: 18.00

   The site shows exactly these prices, from `lib/pricing.json`. If you change one in Stripe, change it there too; `setup:check` fails if they differ.
2. Add the two price IDs (`price_…`) to Vercel: `STRIPE_PRICE_ID_EUR` (19.00) and `STRIPE_PRICE_ID_GBP` (18.00).
3. **Developers → API keys**: add the **secret key** (`sk_test_…`) to Vercel as `STRIPE_SECRET_KEY` (Sensitive).
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<your site>/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`
   - Save, then reveal the **signing secret** (`whsec_…`) and add it to Vercel as `STRIPE_WEBHOOK_SECRET` (Sensitive).
5. **Settings → Public details**: business name, support email and the links to your terms, privacy and refund pages. They appear on the checkout page and receipts.

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
2. Get the claim pack and pay with Stripe's test card `4242 4242 4242 4242`, any future expiry date, any CVC.
3. Confirm, in order:
   - You land on "Confirming your payment" and within seconds see the details form.
   - The "payment confirmed" email arrives.
   - Submitting the details shows the pack. Download the PDF.
   - The "pack ready" email arrives with the PDF attached.
   - In Supabase, `claims` has a row with status `pack_ready`, and `orders` has one paid order.
4. Refund the test payment in Stripe (Payments → the payment → Refund, full amount). The pack page should then say the order was refunded.

## 11. Go live

1. Activate your Stripe account (business details, ID, bank account) and switch to **live mode**.
2. Repeat step 4 in live mode: product and prices, secret key and webhook endpoint. Live IDs and secrets all differ from test ones.
3. Replace the four `STRIPE_*` variables in Vercel with the live values, then redeploy.
4. Run `npm run setup:check` again, then make one real low-value purchase and refund it.

Before launch, also work through **"Must be verified by a human"** in the [README](../README.md).
