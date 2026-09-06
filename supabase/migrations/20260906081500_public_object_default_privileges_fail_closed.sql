-- LANERIQ AI future public object default-deny hardening.
-- Existing tables/sequences are intentionally untouched.
-- This applies only to public-schema objects created later by postgres or supabase_admin.
-- Any Data API or service-role access must be granted explicitly in the creating migration.

alter default privileges for role postgres in schema public revoke all on tables from public;
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on tables from authenticated;
alter default privileges for role postgres in schema public revoke all on tables from service_role;
alter default privileges for role postgres in schema public revoke all on sequences from public;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
alter default privileges for role postgres in schema public revoke all on sequences from authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from service_role;

alter default privileges for role supabase_admin in schema public revoke all on tables from public;
alter default privileges for role supabase_admin in schema public revoke all on tables from anon;
alter default privileges for role supabase_admin in schema public revoke all on tables from authenticated;
alter default privileges for role supabase_admin in schema public revoke all on tables from service_role;
alter default privileges for role supabase_admin in schema public revoke all on sequences from public;
alter default privileges for role supabase_admin in schema public revoke all on sequences from anon;
alter default privileges for role supabase_admin in schema public revoke all on sequences from authenticated;
alter default privileges for role supabase_admin in schema public revoke all on sequences from service_role;

comment on schema public is
'LANERIQ AI exposed schema. Future postgres/supabase_admin functions, tables, and sequences default to no API/service-role access unless explicitly granted by migration.';
