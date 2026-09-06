-- LANERIQ AI future public-object default privilege hardening.
-- Additive to existing security posture: this changes defaults only and does not revoke
-- privileges from any existing table or sequence.
-- Every future API-facing object must opt in explicitly after RLS/ownership intent is defined.

alter default privileges for role postgres in schema public
  revoke all on tables from public;
alter default privileges for role postgres in schema public
  revoke all on tables from anon;
alter default privileges for role postgres in schema public
  revoke all on tables from authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from public;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon;
alter default privileges for role postgres in schema public
  revoke all on sequences from authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from service_role;

-- Standard LANERIQ Production migrations run as postgres and are not allowed to pretend
-- they can mutate supabase_admin-owned defaults. Close that owner-specific gap only when
-- an actually authorized session executes this migration.
do $$
begin
  if current_user = 'supabase_admin' or pg_has_role(current_user,'supabase_admin','MEMBER') then
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from public';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from anon';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on tables from service_role';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from public';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from anon';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke all on sequences from service_role';
  else
    raise notice 'LANERIQ: supabase_admin table/sequence default privileges unchanged; elevated supabase_admin authority is required for owner-specific hardening.';
  end if;
end;
$$;

comment on schema public is
'LANERIQ AI exposed schema. Future postgres-created functions, tables and sequences require explicit API grants. supabase_admin-owned defaults require separate elevated-role verification.';
