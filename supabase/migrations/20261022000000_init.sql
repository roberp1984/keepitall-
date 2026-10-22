-- KeepItAll: claims, orders and post-payment claim details.
-- Access is server-side only (service role). RLS is enabled with no policies,
-- so the anon/public key can read or write nothing.

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  -- Unguessable secret in the /pack/<token> URL and the emailed link.
  pack_token text not null unique,
  status text not null default 'checkout_started'
    check (status in ('checkout_started', 'paid', 'pack_ready', 'refunded')),
  -- Wizard answers and the deterministic assessment the customer paid for (no personal data).
  answers jsonb not null,
  claim_input jsonb not null,
  assessment jsonb not null,
  regime text not null check (regime in ('EU261', 'UK261')),
  ruleset_version text not null,
  currency text not null check (currency in ('EUR', 'GBP')),
  total_amount numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  pack_ready_at timestamptz,
  refunded_at timestamptz
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.claims (id) on delete cascade,
  provider text not null default 'lemonsqueezy',
  provider_order_id text not null unique,
  status text not null check (status in ('paid', 'refunded')),
  email text not null,
  amount_cents integer not null,
  currency text not null,
  test_mode boolean not null default false,
  created_at timestamptz not null default now()
);
create index orders_claim_id_idx on public.orders (claim_id);

-- Personal data, collected only after payment. Delete per the retention policy.
create table public.claim_details (
  claim_id uuid primary key references public.claims (id) on delete cascade,
  details jsonb not null,
  pack jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.claims enable row level security;
alter table public.orders enable row level security;
alter table public.claim_details enable row level security;
