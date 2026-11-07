-- 082 — Verrou des tâches planifiées (KLT-1923).
--
-- APScheduler tourne dans chaque process de l'API. Avec deux réplicas ou
-- plusieurs workers, chaque rappel de RDV, rappel d'essai et rapport mensuel
-- partait autant de fois. Chaque exécution réserve d'abord un bail : seule
-- l'instance qui l'obtient exécute la tâche.
--
-- Un bail (et non pg_advisory_lock) : PostgREST passe par un pool de
-- connexions, un verrou de session n'y survit pas d'un appel à l'autre.

create table if not exists scheduler_lease (
  job          text primary key,
  holder       text not null,
  leased_until timestamptz not null
);

-- Table interne : RLS sans policy, service role uniquement.
alter table scheduler_lease enable row level security;

create or replace function claim_scheduler_lease(p_job text, p_holder text, p_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean;
begin
  insert into scheduler_lease (job, holder, leased_until)
  values (p_job, p_holder, now() + make_interval(secs => p_seconds))
  on conflict (job) do update
     set holder = excluded.holder,
         leased_until = excluded.leased_until
   where scheduler_lease.leased_until < now()
  returning true into claimed;
  return coalesce(claimed, false);
end;
$$;

revoke all on function claim_scheduler_lease(text, text, integer) from public, anon, authenticated;
