-- LANERIQ AI privileged Admin RPC isolation v2 — Phase B legacy decommission.
-- Apply only after Phase A2 callers are Production-verified on exact main/runtime SHA.
-- Legacy v1 Admin RPCs become owner-only; no API role keeps EXECUTE.

revoke all on function public.admin_review_creator_support(uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.admin_set_creator_support_mode(text) from public,anon,authenticated,service_role;
revoke all on function public.admin_issue_buyout_license(uuid,text,text) from public,anon,authenticated,service_role;

comment on function public.admin_review_creator_support(uuid,text,text) is
'LANERIQ legacy Admin RPC v1. API execution disabled after service-role v2 Production verification.';
comment on function public.admin_set_creator_support_mode(text) is
'LANERIQ legacy Admin RPC v1. API execution disabled after service-role v2 Production verification.';
comment on function public.admin_issue_buyout_license(uuid,text,text) is
'LANERIQ legacy Admin RPC v1. API execution disabled after service-role v2 Production verification.';
