-- Batch 191: Market Sales Closure. Additive only; does not modify prior migrations.
-- Payment and market evidence are server-controlled. Client roles receive no mutation grants.

create table if not exists public.market_payment_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'stripe' check (provider='stripe'),
  provider_event_id text not null unique,
  event_type text not null,
  checkout_session_id text,
  payment_intent_id text,
  user_id uuid references auth.users(id) on delete set null,
  sku text,
  app_id uuid references public.apps(id) on delete set null,
  amount_minor bigint check (amount_minor is null or amount_minor>=0),
  currency text check (currency is null or currency ~ '^[a-z]{3}$'),
  livemode boolean not null default false,
  status text not null default 'received' check (status in ('received','processed','ignored','paid_pending_security','refunded','refund_review_required','failed')),
  payload_hash text check (payload_hash is null or payload_hash ~ '^[0-9a-f]{64}$'),
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists market_payment_events_user_idx on public.market_payment_events(user_id,created_at desc);
create index if not exists market_payment_events_payment_idx on public.market_payment_events(payment_intent_id,created_at desc) where payment_intent_id is not null;

create table if not exists public.market_access_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_event_id uuid not null references public.market_payment_events(id) on delete restrict,
  provider_payment_id text not null unique,
  sku text not null check (sku in ('standard','professional','full_access','buyout_personal','buyout_business','buyout_enterprise')),
  app_id uuid references public.apps(id) on delete set null,
  grant_type text not null check (grant_type in ('standard_credit','professional','full_access','buyout_pending')),
  amount_minor bigint not null check (amount_minor>=0),
  currency text not null default 'usd' check (currency ~ '^[a-z]{3}$'),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  state text not null default 'active' check (state in ('active','pending_security','revoked','refund_review_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists market_access_grants_user_idx on public.market_access_grants(user_id,created_at desc);

create table if not exists public.market_provider_evidence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_request_id text not null,
  media_task text not null,
  asset_id uuid not null references public.asset_library(id) on delete restrict,
  artifact_sha256 text not null check (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  quality_score numeric not null check (quality_score>=88 and quality_score<=100),
  safety_passed boolean not null check (safety_passed=true),
  provenance_verified boolean not null check (provenance_verified=true),
  output_validated boolean not null check (output_validated=true),
  durable_reopen_verified boolean not null check (durable_reopen_verified=true),
  production_sha text not null check (production_sha ~ '^[0-9a-f]{40}$'),
  runtime_sha text not null check (runtime_sha ~ '^[0-9a-f]{40}$' and runtime_sha=production_sha),
  evidence_class text not null check (evidence_class='PRODUCTION_REAL_OUTPUT'),
  created_at timestamptz not null default now(),
  unique(user_id,provider_request_id)
);
create index if not exists market_provider_evidence_sha_idx on public.market_provider_evidence(production_sha,created_at desc);

create table if not exists public.market_launch_evidence (
  id uuid primary key default gen_random_uuid(),
  evidence_kind text not null check (evidence_kind in ('production_release','production_security','provider_e2e','commercial_billing')),
  production_sha text not null check (production_sha ~ '^[0-9a-f]{40}$'),
  evidence_digest text not null check (char_length(evidence_digest)>=32 and char_length(evidence_digest)<=160),
  verified boolean not null default false,
  verified_at timestamptz,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(evidence_kind,production_sha),
  check ((verified=false) or verified_at is not null)
);

alter table public.market_payment_events enable row level security;
alter table public.market_access_grants enable row level security;
alter table public.market_provider_evidence enable row level security;
alter table public.market_launch_evidence enable row level security;
revoke all on public.market_payment_events,public.market_access_grants,public.market_provider_evidence,public.market_launch_evidence from public,anon,authenticated;
grant all on public.market_payment_events,public.market_access_grants,public.market_provider_evidence,public.market_launch_evidence to service_role;

create or replace function public.server_fulfill_market_payment(
  p_provider_event_id text,p_checkout_session_id text,p_payment_intent_id text,p_user_id uuid,p_sku text,p_app_id uuid,p_amount_minor bigint,p_currency text,p_livemode boolean,p_payload_hash text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
  event_row public.market_payment_events;
  existing_grant public.market_access_grants;
  expected_amount bigint;
  grant_kind text;
  expiry timestamptz;
  current_expiry timestamptz;
begin
  if p_user_id is null or coalesce(trim(p_provider_event_id),'')='' or coalesce(trim(p_checkout_session_id),'')='' or coalesce(trim(p_payment_intent_id),'')='' then raise exception 'Market payment identity is incomplete'; end if;
  if p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'Market payment payload hash is invalid'; end if;
  expected_amount:=case p_sku when 'standard' then 1000 when 'professional' then 6800 when 'full_access' then 19900 when 'buyout_personal' then 4900 when 'buyout_business' then 19900 when 'buyout_enterprise' then 49900 else null end;
  if expected_amount is null or p_amount_minor is distinct from expected_amount or lower(coalesce(p_currency,''))<>'usd' then raise exception 'Market payment does not match trusted catalog'; end if;
  select * into existing_grant from public.market_access_grants where provider_payment_id=p_payment_intent_id;
  if found then return jsonb_build_object('processed',false,'replayed',true,'grant_id',existing_grant.id,'state',existing_grant.state); end if;
  insert into public.market_payment_events(provider_event_id,event_type,checkout_session_id,payment_intent_id,user_id,sku,app_id,amount_minor,currency,livemode,status,payload_hash)
  values(left(p_provider_event_id,200),'checkout.payment_succeeded',left(p_checkout_session_id,200),left(p_payment_intent_id,200),p_user_id,p_sku,p_app_id,p_amount_minor,'usd',coalesce(p_livemode,false),'received',p_payload_hash)
  on conflict(provider_event_id) do nothing returning * into event_row;
  if not found then return jsonb_build_object('processed',false,'replayed',true); end if;
  if p_sku like 'buyout_%' then
    if p_app_id is null or not exists(select 1 from public.apps a where a.id=p_app_id and a.owner_id=p_user_id and coalesce(a.publish_status,'draft')<>'published') then raise exception 'Buyout project is not eligible'; end if;
    insert into public.market_access_grants(user_id,source_event_id,provider_payment_id,sku,app_id,grant_type,amount_minor,currency,state) values(p_user_id,event_row.id,p_payment_intent_id,p_sku,p_app_id,'buyout_pending',p_amount_minor,'usd','pending_security') returning * into existing_grant;
    update public.market_payment_events set status='paid_pending_security',processed_at=now() where id=event_row.id;
    return jsonb_build_object('processed',true,'access_granted',false,'state','paid_pending_security','grant_id',existing_grant.id);
  end if;
  insert into public.app_builder_account_access(user_id) values(p_user_id) on conflict(user_id) do nothing;
  if p_sku='standard' then
    update public.app_builder_account_access set standard_project_credits=least(10000,standard_project_credits+1),updated_at=now() where user_id=p_user_id;
    grant_kind:='standard_credit';expiry:=null;
  else
    select pro_valid_until into current_expiry from public.app_builder_account_access where user_id=p_user_id for update;
    expiry:=greatest(now(),coalesce(current_expiry,now()))+interval '365 days';
    grant_kind:=case when p_sku='full_access' then 'full_access' else 'professional' end;
    update public.app_builder_account_access set pro_valid_from=coalesce(pro_valid_from,now()),pro_valid_until=expiry,game_access_plan=case when p_sku='full_access' then 'full' else case when game_access_plan='full' then 'full' else 'professional' end end,updated_at=now() where user_id=p_user_id;
  end if;
  insert into public.market_access_grants(user_id,source_event_id,provider_payment_id,sku,grant_type,amount_minor,currency,valid_until,state) values(p_user_id,event_row.id,p_payment_intent_id,p_sku,grant_kind,p_amount_minor,'usd',expiry,'active') returning * into existing_grant;
  update public.market_payment_events set status='processed',processed_at=now() where id=event_row.id;
  return jsonb_build_object('processed',true,'access_granted',true,'grant_id',existing_grant.id,'grant_type',grant_kind,'valid_until',expiry);
exception when others then
  if event_row.id is not null then update public.market_payment_events set status='failed',processed_at=now() where id=event_row.id; end if;raise;
end;$$;

create or replace function public.server_revoke_market_payment(p_provider_event_id text,p_payment_intent_id text,p_payload_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare grant_row public.market_access_grants;event_row public.market_payment_events;remaining integer;
begin
  if coalesce(trim(p_provider_event_id),'')='' or coalesce(trim(p_payment_intent_id),'')='' or p_payload_hash !~ '^[0-9a-f]{64}$' then raise exception 'Refund evidence is invalid'; end if;
  if exists(select 1 from public.market_payment_events where provider_event_id=p_provider_event_id) then return jsonb_build_object('processed',false,'replayed',true); end if;
  select * into grant_row from public.market_access_grants where provider_payment_id=p_payment_intent_id for update;
  if not found then
    insert into public.market_payment_events(provider_event_id,event_type,payment_intent_id,status,payload_hash,processed_at) values(left(p_provider_event_id,200),'refund',left(p_payment_intent_id,200),'ignored',p_payload_hash,now());
    return jsonb_build_object('processed',false,'reason','grant_not_found');
  end if;
  insert into public.market_payment_events(provider_event_id,event_type,payment_intent_id,user_id,sku,app_id,amount_minor,currency,status,payload_hash,processed_at) values(left(p_provider_event_id,200),'refund',left(p_payment_intent_id,200),grant_row.user_id,grant_row.sku,grant_row.app_id,grant_row.amount_minor,grant_row.currency,'refund_review_required',p_payload_hash,now()) returning * into event_row;
  if grant_row.grant_type='standard_credit' then
    select standard_project_credits into remaining from public.app_builder_account_access where user_id=grant_row.user_id for update;
    if coalesce(remaining,0)>0 then update public.app_builder_account_access set standard_project_credits=greatest(0,standard_project_credits-1),updated_at=now() where user_id=grant_row.user_id;update public.market_access_grants set state='revoked',updated_at=now() where id=grant_row.id;update public.market_payment_events set status='refunded' where id=event_row.id;return jsonb_build_object('processed',true,'state','revoked','destructive_project_delete',false); end if;
  end if;
  if grant_row.grant_type='buyout_pending' then update public.market_access_grants set state='revoked',updated_at=now() where id=grant_row.id;update public.market_payment_events set status='refunded' where id=event_row.id;return jsonb_build_object('processed',true,'state','revoked','license_issued',false); end if;
  update public.market_access_grants set state='refund_review_required',updated_at=now() where id=grant_row.id;
  return jsonb_build_object('processed',true,'state','refund_review_required','automatic_access_removal',false,'customer_project_preserved',true);
end;$$;

revoke all on function public.server_fulfill_market_payment(text,text,text,uuid,text,uuid,bigint,text,boolean,text) from public,anon,authenticated;
revoke all on function public.server_revoke_market_payment(text,text,text) from public,anon,authenticated;
grant execute on function public.server_fulfill_market_payment(text,text,text,uuid,text,uuid,bigint,text,boolean,text) to service_role;
grant execute on function public.server_revoke_market_payment(text,text,text) to service_role;
