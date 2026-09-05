-- LANERIQ AI Supabase function-default privilege hardening.
-- Existing functions are intentionally untouched by ALTER DEFAULT PRIVILEGES.
-- This affects only functions created later by the postgres role in public.
-- Every future Data API RPC must opt in with an explicit GRANT in its own migration.

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from service_role;

comment on schema public is
'LANERIQ AI exposed schema. Future postgres-created functions default to no API EXECUTE; each RPC must grant only the minimum required role explicitly.';
