"""
Republie le webhook Telegram (avec secret_token) pour tous les tenants ayant un
bot configuré — à lancer une fois après le déploiement du fix webhook.py qui
rejette désormais les updates sans secret_token.

Les bots enregistrés avant l'introduction du secret_token sur Telegram (côté
serveurs Telegram, pas en base) ne le renvoient pas forcément : ce script force
un nouveau setWebhook pour que Telegram le pose, quel que soit l'état actuel.

Usage (depuis backend/, avec les mêmes variables d'env que le backend en prod
— SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL, AGENT_LINK_SECRET) :

    python scripts/resync_telegram_webhooks.py
"""
import hashlib
import hmac
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.services.telegram import register_webhook, get_bot_info


def main() -> None:
    if not settings.app_url.startswith("https://"):
        print(f"APP_URL invalide : '{settings.app_url}' — doit être une URL HTTPS publique.")
        sys.exit(1)

    sb = get_supabase_admin()
    rows = (
        sb.table("agent_config")
        .select("tenant_id, telegram_bot_token, tenant(name, slug)")
        .eq("agent_type", "support_client")
        .not_.is_("telegram_bot_token", "null")
        .neq("telegram_bot_token", "")
        .execute()
    ).data or []

    if not rows:
        print("Aucun tenant avec un bot Telegram configuré.")
        return

    secret_key = settings.agent_link_secret or settings.secret_key
    ok_count, fail_count = 0, 0

    for row in rows:
        tenant = row.get("tenant") or {}
        bot_token = row["telegram_bot_token"]
        name = tenant.get("name", "?")
        slug = tenant.get("slug", "?")

        webhook_url = f"{settings.app_url}/api/v1/webhook/telegram/{bot_token}"
        webhook_secret = hmac.new(
            secret_key.encode(), bot_token.encode(), hashlib.sha256
        ).hexdigest()[:64]

        ok, err = register_webhook(bot_token, webhook_url, secret_token=webhook_secret)
        if ok:
            info = get_bot_info(bot_token)
            print(f"OK   {name} ({slug}) — bot @{info.get('username', '?')}")
            ok_count += 1
        else:
            print(f"FAIL {name} ({slug}) — {err}")
            fail_count += 1

    print(f"\n{ok_count} ok, {fail_count} échec(s) sur {len(rows)} tenant(s).")


if __name__ == "__main__":
    main()
