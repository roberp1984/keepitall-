-- Follow-up emails and data retention.
alter table public.claims
  add column followups jsonb not null default '{}'::jsonb,
  add column followups_opt_out boolean not null default false,
  add column expired_at timestamptz;

alter table public.claims drop constraint claims_status_check;
alter table public.claims add constraint claims_status_check
  check (status in ('checkout_started', 'paid', 'pack_ready', 'refunded', 'expired'));

create index claims_status_pack_ready_at_idx on public.claims (status, pack_ready_at);
create index claims_status_created_at_idx on public.claims (status, created_at);
