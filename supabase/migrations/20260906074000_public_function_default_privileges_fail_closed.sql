-- LANERIQ AI Supabase function-default privilege hardening.
-- Existing functions are intentionally untouched by ALTER DEFAULT PRIVILEGES.
-- The connected migration runner executes as postgres. It can harden postgres-owned defaults directly.
-- supabase_admin defaults require elevated role authority; the guarded block applies them only when authorized.
-- Every future Data API RPC must opt in with an explicit GRANT in its own migration.

alter default privileges for role postgres in schema public
  revoke execute on functions from public;
alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
alter default privileges for role postgres in schema public
  revoke execute on functions from authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from service_role;

-- Do not make Production deployment depend on authority the standard migration runner does not have.
-- If a future migration session is supabase_admin (or a member of it), close that owner-specific default gap too.
do $$
begin
  if current_user = 'supabase_admin' or pg_has_role(current_user,'supabase_admin','MEMBER') then
    execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from public';
    execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from anon';
    execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from authenticated';
    execute 'alter default privileges for role supabase_admin in schema public revoke execute on functions from service_role';
  else
    raise notice 'LANERIQ: supabase_admin default function privileges unchanged; elevated supabase_admin authority is required for that owner-specific hardening.';
  end if;
end;
$$;

comment on schema public is
'LANERIQ AI exposed schema. Future postgres-created functions default to no API EXECUTE. supabase_admin-created function defaults require separate elevated-role verification. Every Data API RPC must grant only the minimum required role explicitly.';
