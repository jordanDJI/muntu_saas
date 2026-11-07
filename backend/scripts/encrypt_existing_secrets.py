"""
Chiffre les secrets encore stockés en clair (migration 081, KLT-1820 / KLT-0820),
ou les rechiffre avec la nouvelle clé après une rotation.

Colonnes traitées :
  site.paypal_client_secret
  google_analytics_connection.access_token, refresh_token
  agent_config.telegram_bot_token (+ telegram_bot_token_hash)
  ocr_summary.summary_encrypted

Prérequis : migration 081 appliquée, DATA_ENCRYPTION_KEY posée (et, pour une
rotation, l'ancienne clé dans DATA_ENCRYPTION_KEY_PREVIOUS). Mêmes variables
d'environnement que le backend.

Usage (depuis backend/) :
    python scripts/encrypt_existing_secrets.py            # simulation : compte seulement
    python scripts/encrypt_existing_secrets.py --apply    # écrit
    python scripts/encrypt_existing_secrets.py --apply --rotate   # rechiffre aussi l'existant
"""
import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.crypto import _fernet, decrypt, encrypt, is_encrypted, lookup_hash, rotate
from app.core.supabase import get_supabase_admin

TARGETS = [
    ("site", "id", ["paypal_client_secret"]),
    ("google_analytics_connection", "tenant_id", ["access_token", "refresh_token"]),
    ("agent_config", "id", ["telegram_bot_token"]),
    ("ocr_summary", "id", ["summary_encrypted"]),
]
PAGE = 500


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true", help="écrire en base (sinon simulation)")
    parser.add_argument("--rotate", action="store_true", help="rechiffrer aussi les valeurs déjà chiffrées")
    args = parser.parse_args()

    if _fernet() is None:
        print("DATA_ENCRYPTION_KEY absente : rien à faire.")
        sys.exit(1)

    sb = get_supabase_admin()
    for table, key, cols in TARGETS:
        changed = 0
        start = 0
        while True:
            rows = (
                sb.table(table).select(", ".join([key, *cols]))
                .order(key).range(start, start + PAGE - 1).execute().data or []
            )
            for row in rows:
                patch = {}
                for col in cols:
                    v = row.get(col)
                    if not v:
                        continue
                    if not is_encrypted(v):
                        patch[col] = encrypt(v)
                    elif args.rotate:
                        patch[col] = rotate(v)
                    if col == "telegram_bot_token" and col in patch:
                        patch["telegram_bot_token_hash"] = lookup_hash(decrypt(patch[col]))
                if patch:
                    changed += 1
                    if args.apply:
                        sb.table(table).update(patch).eq(key, row[key]).execute()
            if len(rows) < PAGE:
                break
            start += PAGE
        verb = "mises à jour" if args.apply else "à mettre à jour"
        print(f"{table:32} {changed} ligne(s) {verb}")

    if not args.apply:
        print("\nSimulation — relancer avec --apply pour écrire.")


if __name__ == "__main__":
    main()
