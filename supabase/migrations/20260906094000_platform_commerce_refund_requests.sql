-- LANERIQ AI refund-request ledger for direct platform access purchases.
-- Policy eligibility remains subject to mandatory law and qualified legal review.
-- Customers can read their own requests but cannot mutate financial/refund state directly.

create table if not exists public.platform_refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.platform_payment_orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 1000),
  status text not null default 'pending_review' check (status in (
    'pending_review','approved','declined','provider_pending','provider_submitted','provider_failed','completed','cancelled'
  )),
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_refund_id text,
  provider_refund_status text,
  admin_user_id uuid references auth.users(id) on delete set null,
  admin_note text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  provider_submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create unique index if not exists platform_refund_requests_one_open_per_order_idx
  on public.platform_refund_requests(order_id)
  where status in ('pending_review','approved','provider_pending','provider_submitted','provider_failed');
create index if not exists platform_refund_requests_user_idx
  on public.platform_refund_requests(user_id, requested_at desc);
create index if not exists platform_refund_requests_status_idx
  on public.platform_refund_requests(status, requested_at asc);

alter table public.platform_refund_requests enable row level security;
revoke all on public.platform_refund_requests from public, anon, authenticated;
grant select on public.platform_refund_requests to authenticated;

drop policy if exists platform_refund_requests_select_own on public.platform_refund_requests;
create policy platform_refund_requests_select_own on public.platform_refund_requests
  for select to authenticated using (user_id = (select auth.uid()));

comment on table public.platform_refund_requests is
  'Server-controlled refund review ledger. A request does not itself move money or revoke access; provider actions and signed webhooks remain authoritative.';
