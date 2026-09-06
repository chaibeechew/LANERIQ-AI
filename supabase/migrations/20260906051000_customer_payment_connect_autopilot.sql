-- Batch 192: Customer Payment Autopilot / Stripe Connect.
-- Stores only connected-account identifiers and non-sensitive readiness status.
-- Identity documents, raw bank details, beneficial-owner data and KYC payloads remain at Stripe.

create table if not exists public.customer_payment_connect_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_account_id text not null unique check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean not null default false,
  onboarding_state text not null default 'incomplete' check (onboarding_state in ('incomplete','action_required','under_review','ready')),
  card_payments_status text not null default 'unknown' check (card_payments_status in ('active','pending','restricted','unsupported','unknown')),
  requirements_status text not null default 'none' check (char_length(requirements_status) between 1 and 80),
  future_requirements_status text not null default 'none' check (char_length(future_requirements_status) between 1 and 80),
  minimum_deadline timestamptz,
  last_stripe_sync_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists customer_payment_connect_state_idx on public.customer_payment_connect_accounts(onboarding_state,last_stripe_sync_at desc);

create table if not exists public.customer_payment_connect_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique check (char_length(stripe_event_id) between 3 and 200),
  event_type text not null check (char_length(event_type) between 3 and 200),
  stripe_account_id text not null check (stripe_account_id ~ '^acct_[A-Za-z0-9]+$'),
  livemode boolean not null default false,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists customer_payment_connect_events_account_idx on public.customer_payment_connect_events(stripe_account_id,processed_at desc);

alter table public.customer_payment_connect_accounts enable row level security;
alter table public.customer_payment_connect_events enable row level security;
revoke all on public.customer_payment_connect_accounts,public.customer_payment_connect_events from public,anon,authenticated;
grant select on public.customer_payment_connect_accounts to authenticated;
grant all on public.customer_payment_connect_accounts,public.customer_payment_connect_events to service_role;

drop policy if exists "customer reads own connected payment status" on public.customer_payment_connect_accounts;
create policy "customer reads own connected payment status" on public.customer_payment_connect_accounts for select to authenticated using ((select auth.uid())=user_id);

comment on table public.customer_payment_connect_accounts is 'LANERIQ stores Stripe connected-account id and readiness only; no KYC documents or raw bank details.';
comment on table public.customer_payment_connect_events is 'Server-only deduplicated Stripe Connect account-status event ledger.';
