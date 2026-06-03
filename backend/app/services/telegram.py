"""Client Telegram Bot API — envoi de messages, téléchargement de fichiers, enregistrement webhook."""
import logging

import requests

logger = logging.getLogger(__name__)

_BASE = "https://api.telegram.org"


def send_message(bot_token: str, chat_id: int, text: str) -> bool:
    """Envoie un message texte au chat_id via le bot donné."""
    try:
        r = requests.post(
            f"{_BASE}/bot{bot_token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        r.raise_for_status()
        return True
    except Exception as exc:
        logger.error("Telegram send_message vers chat_id %s échoué : %s", chat_id, exc)
        return False


def download_file(bot_token: str, file_id: str) -> tuple[bytes, str]:
    """Télécharge un fichier (photo ou document) depuis les serveurs Telegram."""
    file_res = requests.get(
        f"{_BASE}/bot{bot_token}/getFile",
        params={"file_id": file_id},
        timeout=15,
    )
    file_res.raise_for_status()
    file_path = file_res.json()["result"]["file_path"]

    dl_res = requests.get(f"{_BASE}/file/bot{bot_token}/{file_path}", timeout=30)
    dl_res.raise_for_status()

    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    mime_map = {
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "pdf": "application/pdf",
        "webp": "image/webp",
    }
    return dl_res.content, mime_map.get(ext, "application/octet-stream")


def register_webhook(bot_token: str, webhook_url: str, secret_token: str = "") -> tuple[bool, str]:
    """
    Enregistre l'URL de webhook auprès de Telegram.
    secret_token : si fourni, Telegram inclut X-Telegram-Bot-Api-Secret-Token
    dans chaque update — permet de rejeter les appels non-Telegram.
    Retourne (True, "") en cas de succès, (False, description) en cas d'échec.
    """
    try:
        payload: dict = {"url": webhook_url, "allowed_updates": ["message"]}
        if secret_token:
            payload["secret_token"] = secret_token
        r = requests.post(
            f"{_BASE}/bot{bot_token}/setWebhook",
            json=payload,
            timeout=10,
        )
        data = r.json()
        if r.status_code == 401:
            desc = data.get("description", "Token invalide (401)")
            logger.error("Telegram setWebhook 401 pour token ...%s : %s", bot_token[-6:], desc)
            return False, desc
        if not r.ok:
            desc = data.get("description", f"HTTP {r.status_code}")
            logger.error("Telegram setWebhook %s pour token ...%s : %s", r.status_code, bot_token[-6:], desc)
            return False, desc
        if not data.get("ok"):
            desc = data.get("description", "Réponse ok=false")
            logger.error("Telegram setWebhook ok=false pour token ...%s : %s", bot_token[-6:], desc)
            return False, desc
        return True, ""
    except Exception as exc:
        logger.error("Telegram setWebhook exception pour token ...%s : %s", bot_token[-6:], exc)
        return False, str(exc)


def delete_webhook(bot_token: str) -> bool:
    """Supprime le webhook du bot (utile lors de la désinscription d'un tenant)."""
    try:
        r = requests.post(f"{_BASE}/bot{bot_token}/deleteWebhook", timeout=10)
        return r.ok
    except Exception:
        return False


def get_bot_info(bot_token: str) -> dict:
    """Retourne les informations du bot : username, first_name."""
    try:
        r = requests.get(f"{_BASE}/bot{bot_token}/getMe", timeout=10)
        r.raise_for_status()
        result = r.json().get("result", {})
        return {
            "username": result.get("username", ""),
            "first_name": result.get("first_name", ""),
        }
    except Exception as exc:
        logger.error("Telegram getMe échoué pour token ...%s : %s", bot_token[-6:], exc)
        return {"username": "", "first_name": ""}
