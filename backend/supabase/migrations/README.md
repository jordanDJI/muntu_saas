# Migrations SQL

Appliquées à la main dans l'éditeur SQL Supabase, **dans l'ordre des numéros**.

> Les migrations ne décrivent pas exactement la base de production : voir
> « Schéma de base : les migrations ne sont pas la source de vérité » dans
> `CLAUDE.md`, et les migrations de réconciliation `074` / `075`.

## Numéros en double

Trois numéros sont portés par deux fichiers. Ils ont déjà été appliqués et ne
doivent pas être renommés (un renommage ferait croire à une migration nouvelle).
L'ordre d'application a été l'ordre alphabétique :

| Numéro | 1er | 2e | Dépendance |
|---|---|---|---|
| `002` | `002_agents_schema.sql` | `002_seed.sql` | aucune |
| `027` | `027_directory_metier_label.sql` | `027_lead_appointment_notes.sql` | aucune |
| `055` | `055_content.sql` | `055_support_push.sql` | aucune |

## Règles pour les prochaines migrations

- Numéro suivant **unique** (la dernière est `082`), sur trois chiffres.
- Idempotente autant que possible (`if not exists`, `create or replace`).
- Une table interne (non lue par le frontend) : `enable row level security` sans policy.
- Une colonne utilisée dans un `on_conflict=` : la contrainte d'unicité va dans la même migration.
- Si une étape doit suivre l'application (script de rattrapage, variable d'environnement), l'écrire en tête du fichier.
