create policy "deny direct anon evidence access"
on public.production_e2e_evidence_runs
as restrictive
for all
to anon
using (false)
with check (false);

create policy "deny direct authenticated evidence access"
on public.production_e2e_evidence_runs
as restrictive
for all
to authenticated
using (false)
with check (false);
