-- LANERIQ AI direct-platform commerce closure.
-- This migration is intentionally provider-scoped but customer-financial state remains server-only.
-- It does not apply LANERIQ's 5% app/game revenue-share rules to ordinary customer business transactions.

create table if not exists public.platform_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_code text not null check (offer_code in ('standard','professional','full_access')),
  request_key text not null,
  provider text not null default 'stripe' check (provider = 'stripe'),
  expected_amount_minor bigint not null check (expected_amount_minor >= 50),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  provider_checkout_session_id text,
  provider_payment_intent_id text,
  status text not null default 'pending' check (status in ('pending','checkout_created','paid','failed','expired','refunded','disputed','reconciliation_required')),
  paid_at timestamptz,
  reversed_at timestamptz,
  reconciliation_required boolean not null default false,
  last_provider_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, request_key),
  unique(provider, provider_checkout_session_id),
  unique(provider, provider_payment_intent_id)
);

create index if not exists platform_payment_orders_user_idx
  on public.platform_payment_orders(user_id, created_at desc);
create index if not exists platform_payment_orders_status_idx
  on public.platform_payment_orders(status, updated_at desc);

create table if not exists public.platform_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe' check (provider = 'stripe'),
  provider_event_id text not null,
  event_type text not null,
  order_id uuid references public.platform_payment_orders(id) on delete set null,
  provider_object_id text,
  provider_created_at timestamptz,
  payload_sha256 text not null check (payload_sha256 ~ '^[0-9a-f]{64}$'),
  processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
  processing_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(provider, provider_event_id)
);

create index if not exists platform_payment_events_order_idx
  on public.platform_payment_events(order_id, created_at desc);

create table if not exists public.platform_access_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.platform_payment_orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  offer_code text not null check (offer_code in ('standard','professional','full_access')),
  grant_kind text not null check (grant_kind in ('standard_project_credit','professional_access')),
  standard_credit_quantity integer not null default 0 check (standard_credit_quantity between 0 and 100),
  valid_from timestamptz,
  valid_until timestamptz,
  game_access_plan text check (game_access_plan is null or game_access_plan in ('professional','full')),
  active boolean not null default true,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_access_grants_user_idx
  on public.platform_access_grants(user_id, active, created_at desc);

alter table public.platform_payment_orders enable row level security;
alter table public.platform_payment_events enable row level security;
alter table public.platform_access_grants enable row level security;

revoke all on public.platform_payment_orders from public, anon, authenticated;
revoke all on public.platform_payment_events from public, anon, authenticated;
revoke all on public.platform_access_grants from public, anon, authenticated;
grant select on public.platform_payment_orders, public.platform_access_grants to authenticated;

drop policy if exists platform_payment_orders_select_own on public.platform_payment_orders;
create policy platform_payment_orders_select_own on public.platform_payment_orders
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists platform_access_grants_select_own on public.platform_access_grants;
create policy platform_access_grants_select_own on public.platform_access_grants
  for select to authenticated using (user_id = (select auth.uid()));

-- Stripe webhook application is service-role only and idempotent by provider_event_id.
-- The function never trusts a client-supplied price. It validates the signed provider event
-- against the server-created order's amount/currency before granting access.
create or replace function public.server_apply_platform_payment_event(
  p_provider_event_id text,
  p_event_type text,
  p_order_id uuid default null,
  p_checkout_session_id text default null,
  p_payment_intent_id text default null,
  p_payment_status text default null,
  p_amount_minor bigint default null,
  p_currency text default null,
  p_provider_created_at timestamptz default null,
  p_payload_sha256 text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id text := left(coalesce(trim(p_provider_event_id), ''), 255);
  event_kind text := left(coalesce(trim(p_event_type), ''), 160);
  payload_hash text := lower(coalesce(trim(p_payload_sha256), ''));
  payment_state text := lower(coalesce(trim(p_payment_status), ''));
  currency_code text := upper(coalesce(trim(p_currency), ''));
  order_row public.platform_payment_orders%rowtype;
  account_row public.app_builder_account_access%rowtype;
  grant_row public.platform_access_grants%rowtype;
  access_from timestamptz;
  access_until timestamptz;
  access_days integer;
  desired_game_plan text;
  replay public.platform_payment_events%rowtype;
  note text := null;
begin
  if event_id = '' or event_kind = '' then raise exception 'Provider event identity is required'; end if;
  if payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'Provider payload digest is invalid'; end if;

  select * into replay
  from public.platform_payment_events
  where provider = 'stripe' and provider_event_id = event_id;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'status', replay.processing_status, 'orderId', replay.order_id);
  end if;

  insert into public.platform_payment_events(
    provider, provider_event_id, event_type, order_id, provider_object_id,
    provider_created_at, payload_sha256, processing_status
  ) values (
    'stripe', event_id, event_kind, p_order_id,
    coalesce(nullif(trim(p_checkout_session_id), ''), nullif(trim(p_payment_intent_id), '')),
    p_provider_created_at, payload_hash, 'received'
  );

  if p_order_id is not null then
    select * into order_row from public.platform_payment_orders where id = p_order_id for update;
  elsif nullif(trim(p_checkout_session_id), '') is not null then
    select * into order_row from public.platform_payment_orders
      where provider = 'stripe' and provider_checkout_session_id = trim(p_checkout_session_id) for update;
  elsif nullif(trim(p_payment_intent_id), '') is not null then
    select * into order_row from public.platform_payment_orders
      where provider = 'stripe' and provider_payment_intent_id = trim(p_payment_intent_id) for update;
  end if;

  if not found then
    update public.platform_payment_events
      set processing_status = 'ignored', processing_note = 'order_not_found', processed_at = now()
      where provider = 'stripe' and provider_event_id = event_id;
    return jsonb_build_object('ok', true, 'replayed', false, 'status', 'ignored', 'reason', 'order_not_found');
  end if;

  update public.platform_payment_events set order_id = order_row.id
    where provider = 'stripe' and provider_event_id = event_id;

  if event_kind = 'checkout.session.completed' then
    if payment_state <> 'paid' then
      note := 'checkout_not_paid';
    elsif p_amount_minor is null or p_amount_minor <> order_row.expected_amount_minor then
      note := 'amount_mismatch';
    elsif currency_code = '' or currency_code <> order_row.currency then
      note := 'currency_mismatch';
    else
      update public.platform_payment_orders set
        provider_checkout_session_id = coalesce(nullif(trim(p_checkout_session_id), ''), provider_checkout_session_id),
        provider_payment_intent_id = coalesce(nullif(trim(p_payment_intent_id), ''), provider_payment_intent_id),
        status = 'paid', paid_at = coalesce(paid_at, now()), reconciliation_required = false,
        last_provider_event_id = event_id, updated_at = now()
      where id = order_row.id;

      insert into public.app_builder_account_access(user_id)
        values(order_row.user_id) on conflict (user_id) do nothing;
      select * into account_row from public.app_builder_account_access where user_id = order_row.user_id for update;

      if order_row.offer_code = 'standard' then
        insert into public.platform_access_grants(order_id,user_id,offer_code,grant_kind,standard_credit_quantity)
          values(order_row.id,order_row.user_id,order_row.offer_code,'standard_project_credit',1)
          on conflict(order_id) do nothing;
        if found then
          update public.app_builder_account_access
            set standard_project_credits = least(10000, standard_project_credits + 1), updated_at = now()
            where user_id = order_row.user_id;
        end if;
      else
        access_days := 365;
        desired_game_plan := case when order_row.offer_code = 'full_access' then 'full' else 'professional' end;
        access_from := greatest(now(), coalesce(account_row.pro_valid_until, now()));
        access_until := access_from + make_interval(days => access_days);
        insert into public.platform_access_grants(
          order_id,user_id,offer_code,grant_kind,valid_from,valid_until,game_access_plan
        ) values(
          order_row.id,order_row.user_id,order_row.offer_code,'professional_access',access_from,access_until,desired_game_plan
        ) on conflict(order_id) do nothing returning * into grant_row;
        if found then
          update public.app_builder_account_access set
            pro_valid_from = coalesce(pro_valid_from, access_from),
            pro_valid_until = greatest(coalesce(pro_valid_until, access_until), access_until),
            game_access_plan = case when desired_game_plan = 'full' or game_access_plan = 'full' then 'full' else 'professional' end,
            updated_at = now()
          where user_id = order_row.user_id;
        end if;
      end if;

      update public.platform_payment_events
        set processing_status = 'processed', processing_note = 'access_granted', processed_at = now()
        where provider = 'stripe' and provider_event_id = event_id;
      return jsonb_build_object('ok', true, 'replayed', false, 'status', 'processed', 'orderId', order_row.id);
    end if;

    update public.platform_payment_orders set
      status = 'reconciliation_required', reconciliation_required = true,
      last_provider_event_id = event_id, updated_at = now()
      where id = order_row.id;
    update public.platform_payment_events set
      processing_status = 'failed', processing_note = note, processed_at = now()
      where provider = 'stripe' and provider_event_id = event_id;
    return jsonb_build_object('ok', false, 'status', 'failed', 'reason', note, 'orderId', order_row.id);
  end if;

  if event_kind in ('charge.refunded','charge.dispute.created') then
    select * into grant_row from public.platform_access_grants where order_id = order_row.id for update;
    if found and grant_row.active then
      if grant_row.grant_kind = 'standard_project_credit' then
        update public.app_builder_account_access
          set standard_project_credits = greatest(0, standard_project_credits - 1), updated_at = now()
          where user_id = order_row.user_id and standard_project_credits > 0;
        if not found then note := 'standard_credit_already_consumed'; end if;
      elsif grant_row.grant_kind = 'professional_access' then
        select * into account_row from public.app_builder_account_access where user_id = order_row.user_id for update;
        if account_row.pro_valid_until = grant_row.valid_until then
          update public.app_builder_account_access set
            pro_valid_until = grant_row.valid_from,
            game_access_plan = case
              when exists(select 1 from public.platform_access_grants g where g.user_id=order_row.user_id and g.active and g.order_id<>order_row.id and g.game_access_plan='full') then 'full'
              else 'professional'
            end,
            updated_at = now()
          where user_id = order_row.user_id;
        else
          note := 'later_or_external_access_requires_reconciliation';
        end if;
      end if;
      update public.platform_access_grants set active=false, revoked_at=now(), updated_at=now() where order_id=order_row.id;
    end if;

    update public.platform_payment_orders set
      status = case when event_kind='charge.refunded' then 'refunded' else 'disputed' end,
      reversed_at = now(), reconciliation_required = (note is not null),
      last_provider_event_id = event_id, updated_at = now()
      where id = order_row.id;
    update public.platform_payment_events set
      processing_status = 'processed', processing_note = coalesce(note,'access_reversed'), processed_at = now()
      where provider='stripe' and provider_event_id=event_id;
    return jsonb_build_object('ok', true, 'status', 'processed', 'reconciliationRequired', note is not null, 'orderId', order_row.id);
  end if;

  if event_kind = 'payment_intent.payment_failed' then
    update public.platform_payment_orders set status='failed', last_provider_event_id=event_id, updated_at=now()
      where id=order_row.id and status not in ('paid','refunded','disputed');
    update public.platform_payment_events set processing_status='processed', processing_note='payment_failed', processed_at=now()
      where provider='stripe' and provider_event_id=event_id;
    return jsonb_build_object('ok', true, 'status', 'processed', 'orderId', order_row.id);
  end if;

  if event_kind = 'checkout.session.expired' then
    update public.platform_payment_orders set status='expired', last_provider_event_id=event_id, updated_at=now()
      where id=order_row.id and status in ('pending','checkout_created');
    update public.platform_payment_events set processing_status='processed', processing_note='checkout_expired', processed_at=now()
      where provider='stripe' and provider_event_id=event_id;
    return jsonb_build_object('ok', true, 'status', 'processed', 'orderId', order_row.id);
  end if;

  update public.platform_payment_events set processing_status='ignored', processing_note='event_not_actionable', processed_at=now()
    where provider='stripe' and provider_event_id=event_id;
  return jsonb_build_object('ok', true, 'status', 'ignored', 'orderId', order_row.id);
end;
$$;

revoke all on function public.server_apply_platform_payment_event(text,text,uuid,text,text,text,bigint,text,timestamptz,text)
  from public, anon, authenticated;
grant execute on function public.server_apply_platform_payment_event(text,text,uuid,text,text,text,bigint,text,timestamptz,text)
  to service_role;
