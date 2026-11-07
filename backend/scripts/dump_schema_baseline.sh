#!/usr/bin/env sh
# Génère le baseline exact du schéma de production (KLT-1922).
#
# Les migrations ne décrivent pas exactement la base (voir CLAUDE.md, « Schéma de
# base ») : seul un dump du schéma réel permet de recréer un environnement
# identique (recette, restauration après incident).
#
# Prérequis : Supabase CLI (https://supabase.com/docs/guides/cli) et l'URL de
# connexion de la base (Supabase → Project Settings → Database → Connection
# string, mode « Session »). Ne jamais commiter cette URL.
#
# Usage :
#   SUPABASE_DB_URL='postgresql://postgres.xxx:MOT_DE_PASSE@aws-0-eu-west-3.pooler.supabase.com:5432/postgres' \
#     sh scripts/dump_schema_baseline.sh
#
# Produit backend/supabase/baseline/schema.sql (structure, policies RLS,
# fonctions, triggers — sans aucune donnée). À régénérer après chaque migration.
set -eu

[ -n "${SUPABASE_DB_URL:-}" ] || { echo "SUPABASE_DB_URL manquante"; exit 1; }
command -v supabase >/dev/null || { echo "Supabase CLI absente"; exit 1; }

OUT_DIR="$(dirname "$0")/../supabase/baseline"
mkdir -p "$OUT_DIR"

supabase db dump --db-url "$SUPABASE_DB_URL" --schema public -f "$OUT_DIR/schema.sql"

{
  echo "-- Baseline du schéma public, généré le $(date -u +%Y-%m-%dT%H:%MZ)"
  echo "-- par scripts/dump_schema_baseline.sh. Ne pas modifier à la main."
  cat "$OUT_DIR/schema.sql"
} > "$OUT_DIR/schema.sql.tmp" && mv "$OUT_DIR/schema.sql.tmp" "$OUT_DIR/schema.sql"

echo "Écrit : $OUT_DIR/schema.sql"
echo "Recréer une base de recette : psql \"\$RECETTE_DB_URL\" -f $OUT_DIR/schema.sql"
