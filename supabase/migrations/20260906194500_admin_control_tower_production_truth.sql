-- Persist the exact Production release truth that authorized a release promotion.

alter table public.control_tower_releases
  add column if not exists production_verified_at timestamptz,
  add column if not exists production_verified_by uuid,
  add column if not exists production_truth jsonb;

create or replace function public.control_tower_guard_production_truth()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.production_verified_at is not null then
    if new.production_verified_at is distinct from old.production_verified_at
       or new.production_verified_by is distinct from old.production_verified_by
       or new.production_truth is distinct from old.production_truth then
      raise exception 'Control Tower Production truth is immutable once recorded'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
  end if;

  if old.production_verified_at is null and new.production_verified_at is not null then
    if new.stage <> 'production' then
      raise exception 'Production truth may only be recorded when entering Production'
        using errcode = 'object_not_in_prerequisite_state';
    end if;
    if new.production_verified_by is null or new.production_truth is null then
      raise exception 'Production truth requires verifier and snapshot'
        using errcode = 'not_null_violation';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.control_tower_guard_production_truth() from public, anon, authenticated;

create trigger control_tower_production_truth_guard
before update of production_verified_at, production_verified_by, production_truth on public.control_tower_releases
for each row execute function public.control_tower_guard_production_truth();

create index if not exists control_tower_releases_production_verified_idx
  on public.control_tower_releases(production_verified_at desc)
  where production_verified_at is not null;
