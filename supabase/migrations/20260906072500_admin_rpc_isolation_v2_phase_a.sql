-- LANERIQ AI Supabase privileged Admin RPC isolation v2 — Phase A1.
-- Additive only: create server-only v2 RPCs and keep legacy authenticated RPCs intact.
-- Phase A2 switches server callers after these functions are verified LIVE.
-- Phase B revokes authenticated EXECUTE from the legacy v1 Admin RPCs after rollback safety is proven.

create or replace function public.admin_review_creator_support_v2(
  p_admin_id uuid,
  p_request_id uuid,
  p_decision text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := p_admin_id;
  req public.creator_support_requests;
  settings_row public.creator_support_settings;
  code_value text;
  code_until timestamptz;
begin
  if admin_id is null or lower(coalesce((select raw_app_meta_data->>'role' from auth.users where id=admin_id),'')) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_decision not in ('approve','reject') then raise exception 'Invalid decision'; end if;
  select * into req from public.creator_support_requests where id=p_request_id for update;
  if not found or req.status<>'pending' then raise exception 'Request is not pending'; end if;
  if p_decision='reject' then
    update public.creator_support_requests
      set status='rejected',decided_at=now(),decided_by=admin_id,
          decision_reason=nullif(left(trim(coalesce(p_reason,'')),500),'')
      where id=req.id;
    insert into public.creator_support_audit(user_id,request_id,actor_type,actor_user_id,action,metadata)
      values(req.user_id,req.id,'admin',admin_id,'creator_support.reject',jsonb_build_object('reason',p_reason,'rpcVersion','v2-service-role'));
    return jsonb_build_object('success',true,'status','rejected');
  end if;
  select * into settings_row from public.creator_support_settings where singleton_id=1;
  code_value:='CREATOR-'||upper(encode(gen_random_bytes(6),'hex'));
  code_until:=now()+make_interval(days=>settings_row.code_valid_days);
  update public.creator_support_requests
    set status='approved',approval_mode='manual',decided_at=now(),decided_by=admin_id,
        decision_reason=nullif(left(trim(coalesce(p_reason,'Approved by Admin')),500),'')
    where id=req.id;
  insert into public.creator_support_codes(request_id,user_id,code,issued_mode,issued_by,valid_until)
    values(req.id,req.user_id,code_value,'manual',admin_id,code_until);
  insert into public.creator_support_audit(user_id,request_id,actor_type,actor_user_id,action,metadata)
    values(req.user_id,req.id,'admin',admin_id,'creator_support.approve',jsonb_build_object('codeValidUntil',code_until,'rpcVersion','v2-service-role'));
  return jsonb_build_object('success',true,'status','approved','verifyCode',code_value,'verifyCodeValidUntil',code_until,'userId',req.user_id);
end;
$$;

create or replace function public.admin_set_creator_support_mode_v2(
  p_admin_id uuid,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := p_admin_id;
begin
  if admin_id is null or lower(coalesce((select raw_app_meta_data->>'role' from auth.users where id=admin_id),'')) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if p_mode not in ('auto','manual') then raise exception 'Invalid approval mode'; end if;
  update public.creator_support_settings
    set approval_mode=p_mode,updated_by=admin_id,updated_at=now()
    where singleton_id=1;
  insert into public.admin_audit_log(admin_user_id,action,target_type,metadata)
    values(admin_id,'creator_support.mode_change','creator_support_settings',jsonb_build_object('approvalMode',p_mode,'rpcVersion','v2-service-role'));
  return jsonb_build_object('success',true,'approvalMode',p_mode);
end;
$$;

create or replace function public.admin_issue_buyout_license_v2(
  p_admin_id uuid,
  p_app_id uuid,
  p_tier text,
  p_payment_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin_id uuid := p_admin_id;
  app_row public.apps;
  existing_row public.app_licenses;
  tier_value text := lower(trim(coalesce(p_tier,'')));
  price_value numeric(12,2);
  new_id uuid := gen_random_uuid();
  new_license_number text;
begin
  if admin_id is null or lower(coalesce((select raw_app_meta_data->>'role' from auth.users where id=admin_id),'')) <> 'admin' then
    raise exception 'Admin access required';
  end if;
  if tier_value not in ('personal','business','enterprise') then raise exception 'Invalid Buyout License tier'; end if;
  if p_payment_reference is null or char_length(trim(p_payment_reference)) < 3 or char_length(trim(p_payment_reference)) > 200 then
    raise exception 'Payment reference is required';
  end if;

  select * into app_row from public.apps where id=p_app_id for update;
  if not found then raise exception 'Project not found'; end if;
  if coalesce(app_row.publish_status,'draft')='published' then raise exception 'Buyout License must be selected before publish'; end if;

  if exists(
    select 1 from public.creator_support_requests r
    where r.unfinished_project_id=p_app_id and r.status='redeemed'
  ) then
    raise exception 'This project used Encourage Creator support and is not eligible for Buyout License';
  end if;

  if lower(coalesce(app_row.source_prompt,'')) ~ '(^|[^a-z])(game|gaming)([^a-z]|$)'
     or coalesce(app_row.source_prompt,'') ~ '(游戏|遊戲|手游)' then
    raise exception 'Game projects do not offer Buyout License';
  end if;

  select * into existing_row from public.app_licenses where app_id=p_app_id;
  if found then
    return jsonb_build_object(
      'success',true,'replayed',true,'licenseId',existing_row.id,'licenseNumber',existing_row.license_number,
      'projectId',existing_row.app_id,'tier',existing_row.license_tier,'priceUsd',existing_row.license_price,
      'status',existing_row.status,'issuedAt',existing_row.issued_at
    );
  end if;

  price_value := case tier_value when 'personal' then 49 when 'business' then 199 when 'enterprise' then 499 end;
  new_license_number := 'LQ-BUYOUT-' || upper(substr(replace(new_id::text,'-',''),1,16));

  insert into public.app_licenses(
    id,app_id,owner_id,license_price,currency,terms_version,status,
    license_number,license_tier,certificate_version,issued_at,issued_by,
    project_name_snapshot,payment_reference,email_delivery_status
  ) values(
    new_id,p_app_id,app_row.owner_id,price_value,'USD','LANERIQ-BUYOUT-LICENSE-v1-DRAFT','active',
    new_license_number,tier_value,'LANERIQ-BUYOUT-CERT-v1',now(),admin_id,
    app_row.name,trim(p_payment_reference),'not_attempted'
  );

  insert into public.admin_audit_log(admin_user_id,action,target_type,target_id,metadata)
    values(admin_id,'buyout_license.issue','app_license',new_id,jsonb_build_object(
      'appId',p_app_id,'tier',tier_value,'priceUsd',price_value,'licenseNumber',new_license_number,
      'paymentReferenceRecorded',true,'encourageCreatorExcluded',true,'gameExcluded',true,'rpcVersion','v2-service-role'
    ));

  return jsonb_build_object(
    'success',true,'replayed',false,'licenseId',new_id,'licenseNumber',new_license_number,
    'projectId',p_app_id,'tier',tier_value,'priceUsd',price_value,'currency','USD',
    'status','active','issuedAt',now(),'certificateVersion','LANERIQ-BUYOUT-CERT-v1',
    'termsVersion','LANERIQ-BUYOUT-LICENSE-v1-DRAFT','futureLaneriqRevenueSharePercent',0
  );
end;
$$;

-- Defense in depth: v2 is not callable with anon/authenticated credentials.
revoke all on function public.admin_review_creator_support_v2(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.admin_set_creator_support_mode_v2(uuid,text) from public,anon,authenticated;
revoke all on function public.admin_issue_buyout_license_v2(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_review_creator_support_v2(uuid,uuid,text,text) to service_role;
grant execute on function public.admin_set_creator_support_mode_v2(uuid,text) to service_role;
grant execute on function public.admin_issue_buyout_license_v2(uuid,uuid,text,text) to service_role;

comment on function public.admin_review_creator_support_v2(uuid,uuid,text,text) is 'LANERIQ server-only Admin RPC v2. Phase A1 additive; legacy v1 retained temporarily for rollback.';
comment on function public.admin_set_creator_support_mode_v2(uuid,text) is 'LANERIQ server-only Admin RPC v2. Phase A1 additive; legacy v1 retained temporarily for rollback.';
comment on function public.admin_issue_buyout_license_v2(uuid,uuid,text,text) is 'LANERIQ server-only Admin RPC v2. Phase A1 additive; legacy v1 retained temporarily for rollback.';
