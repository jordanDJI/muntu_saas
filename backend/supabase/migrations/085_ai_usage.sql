-- 085 — Consommation IA par tenant (KLT-0822).
--
-- Le chatbot vitrine est gratuit pour tous les plans et aucun appel Gemini
-- n'était rattaché à un tenant : le coût d'un tenant très actif, ou d'un abus,
-- était invisible. Une ligne par tenant, jour et fonctionnalité.

create table if not exists ai_usage_daily (
  tenant_id     uuid not null references tenant(id) on delete cascade,
  day           date not null,
  feature       text not null,           -- chatbot | agent_support | assistant | synthesis | other
  calls         integer not null default 0,
  input_tokens  bigint  not null default 0,
  output_tokens bigint  not null default 0,
  primary key (tenant_id, day, feature)
);

-- Table interne : RLS sans policy, service role uniquement.
alter table ai_usage_daily enable row level security;

create or replace function record_ai_usage(p_tenant uuid, p_feature text, p_input bigint, p_output bigint)
returns void
language sql
security definer
set search_path = public
as $$
  insert into ai_usage_daily (tenant_id, day, feature, calls, input_tokens, output_tokens)
  values (p_tenant, (now() at time zone 'utc')::date, p_feature, 1, greatest(p_input, 0), greatest(p_output, 0))
  on conflict (tenant_id, day, feature) do update
     set calls         = ai_usage_daily.calls + 1,
         input_tokens  = ai_usage_daily.input_tokens + excluded.input_tokens,
         output_tokens = ai_usage_daily.output_tokens + excluded.output_tokens;
$$;

revoke all on function record_ai_usage(uuid, text, bigint, bigint) from public, anon, authenticated;
