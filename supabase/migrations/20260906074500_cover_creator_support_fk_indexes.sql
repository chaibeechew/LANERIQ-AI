-- LANERIQ AI Supabase Advisor FK covering-index hardening.
-- Additive only: no table rewrites, no constraint changes, no index drops.
-- Covers the eight LIVE Advisor foreign-key findings around Creator Support and Buyout License.

create index if not exists app_licenses_issued_by_idx
  on public.app_licenses(issued_by);

create index if not exists creator_support_audit_actor_user_id_idx
  on public.creator_support_audit(actor_user_id);

create index if not exists creator_support_audit_request_id_idx
  on public.creator_support_audit(request_id);

create index if not exists creator_support_codes_issued_by_idx
  on public.creator_support_codes(issued_by);

create index if not exists creator_support_codes_revoked_by_idx
  on public.creator_support_codes(revoked_by);

create index if not exists creator_support_requests_decided_by_idx
  on public.creator_support_requests(decided_by);

create index if not exists creator_support_requests_unfinished_project_id_idx
  on public.creator_support_requests(unfinished_project_id);

create index if not exists creator_support_settings_updated_by_idx
  on public.creator_support_settings(updated_by);
