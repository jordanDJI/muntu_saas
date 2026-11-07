-- 084 — Décompte des valeurs par champ de contact en SQL (KLT-0631).
--
-- GET /contact-fields/usage parcourait les contacts en Python, et sans
-- pagination : PostgREST plafonnant une réponse à 1 000 lignes, les décomptes
-- étaient faux au-delà — y compris le 409 qui protège la suppression d'un champ.
-- Le backend retombe sur l'ancien calcul si la fonction est absente.

create or replace function contact_custom_field_usage(p_tenant uuid)
returns table (field_key text, n bigint)
language sql
stable
security definer
set search_path = public
as $$
  select kv.key, count(*)
    from contact c,
         lateral jsonb_each(coalesce(c.custom_fields, '{}'::jsonb)) as kv(key, value)
   where c.tenant_id = p_tenant
     and c.deleted_at is null
     and kv.value not in ('null'::jsonb, '""'::jsonb, '[]'::jsonb, '{}'::jsonb)
   group by kv.key;
$$;

revoke all on function contact_custom_field_usage(uuid) from public, anon, authenticated;
