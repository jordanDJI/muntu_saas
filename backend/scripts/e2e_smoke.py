import os
import json
import secrets
import string
from datetime import datetime, timedelta, timezone

import httpx
from pathlib import Path
from dotenv import load_dotenv
import base64


def _env(name: str) -> str:
    v = os.getenv(name)
    if not v:
        raise RuntimeError(f"Variable manquante: {name}")
    return v


def _rand_slug(prefix: str = "tenant") -> str:
    suffix = "".join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(8))
    return f"{prefix}-{suffix}"


def _rand_email() -> str:
    suffix = "".join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(10))
    return f"e2e+{suffix}@example.com"


def supabase_admin_create_user(sb_url: str, service_role_key: str, email: str, password: str) -> str:
    # https://supabase.com/docs/reference/auth/admin-createuser (endpoint stable)
    url = f"{sb_url}/auth/v1/admin/users"
    headers = {
        "apikey": service_role_key,
        "Authorization": f"Bearer {service_role_key}",
        "Content-Type": "application/json",
    }
    payload = {"email": email, "password": password, "email_confirm": True}
    r = httpx.post(url, headers=headers, json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    user_id = data.get("id")
    if not user_id:
        raise RuntimeError(f"Création user Supabase: réponse inattendue: {data}")
    return user_id


def supabase_password_grant(sb_url: str, anon_key: str, email: str, password: str) -> str:
    # https://supabase.com/docs/reference/auth/signinwithpassword (token endpoint)
    url = f"{sb_url}/auth/v1/token?grant_type=password"
    headers = {"apikey": anon_key, "Content-Type": "application/json"}
    payload = {"email": email, "password": password}
    r = httpx.post(url, headers=headers, json=payload, timeout=30)
    r.raise_for_status()
    data = r.json()
    access_token = data.get("access_token")
    if not access_token:
        raise RuntimeError(f"Login Supabase: réponse inattendue: {data}")
    return access_token


def api_call(method: str, api_url: str, path: str, token: str | None = None, **kwargs):
    headers = kwargs.pop("headers", {})
    headers.setdefault("Content-Type", "application/json")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = api_url.rstrip("/") + path
    r = httpx.request(method, url, headers=headers, timeout=60, **kwargs)
    r.raise_for_status()
    if r.headers.get("content-type", "").startswith("application/json"):
        return r.json()
    return r.text


def main() -> None:
    # Charge automatiquement `SaaS/.env` (même si le script est lancé depuis `backend/`)
    load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)

    sb_url = _env("SUPABASE_URL")
    sb_anon = _env("SUPABASE_ANON_KEY")
    sb_service = _env("SUPABASE_SERVICE_ROLE_KEY")

    api_url = os.getenv("E2E_API_URL") or os.getenv("NEXT_PUBLIC_API_URL") or "http://localhost:8000"
    api_url = api_url.rstrip("/")

    email = _rand_email()
    password = "E2e!" + secrets.token_hex(10)

    print("== E2E: création user Supabase ==")
    user_id = supabase_admin_create_user(sb_url, sb_service, email, password)
    print("user_id:", user_id)

    print("\n== E2E: login (password grant) ==")
    token = supabase_password_grant(sb_url, sb_anon, email, password)
    print("token: OK")

    print("\n== E2E: health backend ==")
    health = api_call("GET", api_url, "/health", token=None)
    print("health:", health)

    print("\n== E2E: onboarding tenant + site + agents ==")
    tenant_slug = _rand_slug("muntu-cura")
    setup = api_call(
        "POST",
        api_url,
        "/api/v1/onboarding/setup",
        token=token,
        json={
            "first_name": "Yolande",
            "last_name": "NYA",
            "tenant_name": "Muntu Cura",
            "tenant_slug": tenant_slug,
            "sector": "health",
        },
    )
    print("setup:", setup)

    # Important: le token obtenu avant l'onboarding ne contient pas encore `app_metadata.tenant_id`.
    # On se re-connecte pour obtenir un JWT à jour (sinon middleware -> 403 sur les routes tenant).
    print("\n== E2E: re-login pour récupérer un JWT avec tenant_id ==")
    token = supabase_password_grant(sb_url, sb_anon, email, password)
    print("token: OK (post-onboarding)")

    print("\n== E2E: récupérer le site du tenant ==")
    sites = api_call("GET", api_url, "/api/v1/sites/", token=token)
    if not sites:
        raise RuntimeError("Aucun site trouvé après onboarding")
    site = sites[0]
    site_id = site["id"]
    print("site_id:", site_id)

    print("\n== E2E: remplir le wizard (patch site + zones + offres + témoignages) ==")
    api_call(
        "PATCH",
        api_url,
        f"/api/v1/sites/{site_id}",
        token=token,
        json={
            "title": "Muntu Cura",
            "tagline": "Soins à domicile avec cœur",
            "description": "Soins infirmiers à domicile, coordination et suivi.",
            "phone": "0491 23 45 67",
            "email_contact": email,
            "address": "Halle, Belgique",
            "audience_mode": "hybrid",
            "site_style": {
                "logo_option": "text_logo",
                "primary_color": "#4F46E5",
                "font_style": "modern",
                "photos_option": "has_photos",
                "photo_urls": {
                    "hero": "https://images.unsplash.com/photo-1526256262350-7da7584cf5eb",
                    "about": "https://images.unsplash.com/photo-1544005313-94ddf0286df2",
                    "services": "",
                    "contact": "",
                },
                "pages_enabled": ["home", "about", "services", "contact"],
                "social_links": {"facebook": "", "instagram": "", "linkedin": ""},
                "values_list": [
                    {"icon": "🏥", "title": "Soins certifiés", "description": "Agréée INAMI depuis 2015"},
                    {"icon": "🕐", "title": "Disponible 7j/7", "description": "Même le week-end"},
                ],
                "tracking": {"ga4_id": "G-TEST123456", "meta_pixel_id": "", "gtm_id": ""},
                "custom_css": "",
            },
        },
    )

    # zones (service_area): endpoint non décrit côté API; on vérifie juste que le modèle de doc correspond au schéma DB.
    # offres
    api_call(
        "PUT",
        api_url,
        f"/api/v1/sites/{site_id}/offers",
        token=token,
        json=[
            {
                "name": "Soins infirmiers à domicile",
                "description": "Pansements, injections, suivi post-opératoire.",
                "duration_min": 45,
                "price_eur": 35,
            },
            {
                "name": "Coordination avec maison de repos",
                "description": "Coordination et suivi des transmissions.",
                "duration_min": 60,
            },
        ],
    )

    # témoignages
    api_call(
        "PUT",
        api_url,
        f"/api/v1/sites/{site_id}/testimonials",
        token=token,
        json=[
            {"author_name": "Martine D.", "author_role": "Patiente", "content": "Très professionnelle.", "rating": 5},
            {"author_name": "Dr L.", "author_role": "Médecin", "content": "Suivi impeccable.", "rating": 5},
        ],
    )

    print("\n== E2E: publier le site ==")
    api_call("POST", api_url, f"/api/v1/sites/{site_id}/publish", token=token)

    print("\n== E2E: créer un lead public (formulaire) ==")
    lead = api_call(
        "POST",
        api_url,
        f"/api/v1/leads/public/{tenant_slug}",
        token=None,
        json={
            "first_name": "Martine",
            "last_name": "Dubois",
            "email": "martine.dubois@example.com",
            "phone": "0492 11 22 33",
            "source": "website",
            "audience_type": "b2c",
            "request_type": "contact",
        },
    )
    print("lead:", lead)

    print("\n== E2E: tester le chatbot public (Agent 1) ==")
    bot = api_call(
        "POST",
        api_url,
        f"/api/v1/chatbot/{tenant_slug}",
        token=None,
        json={
            "session_id": None,
            "messages": [
                {"role": "user", "content": "Bonjour, quels services proposez-vous ?"},
                {"role": "user", "content": "Et vos horaires ?"},
            ],
        },
    )
    print("chatbot_reply_len:", len(bot.get("reply", "")) if isinstance(bot, dict) else bot)

    print("\n== E2E: créer un rendez-vous (si endpoint actif) ==")
    # On tente un RDV minimal: nécessite contact_id et/ou lead_id selon l’API.
    # On récupère la liste des leads du tenant pour retrouver l’ID.
    leads = api_call("GET", api_url, "/api/v1/leads/", token=token)
    if not leads:
        raise RuntimeError("Aucun lead listé après création public")
    lead_id = leads[0]["id"]
    contact_id = leads[0].get("contact_id") or (leads[0].get("contact") or {}).get("id")
    if not contact_id:
        print("RDV: skip (contact_id introuvable dans la réponse lead)")
    else:
        start_dt = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0)
        end_dt = start_dt + timedelta(minutes=45)
        appt = api_call(
            "POST",
            api_url,
            "/api/v1/appointments/",
            token=token,
            json={
                "contact_id": contact_id,
                "lead_id": lead_id,
                "type": "consultation",
                "audience_type": "b2c",
                "scheduled_at": start_dt.isoformat().replace("+00:00", "Z"),
                "end_at": end_dt.isoformat().replace("+00:00", "Z"),
            },
        )
        print("appointment:", appt)

    print("\n== E2E: lister les agents ==")
    configs = api_call("GET", api_url, "/api/v1/agents/config", token=token)
    print("agent_configs_count:", len(configs) if isinstance(configs, list) else configs)

    if contact_id:
        print("\n== E2E: créer un lien agent (Agent 2) ==")
        link = api_call(
            "POST",
            api_url,
            "/api/v1/agents/links",
            token=token,
            json={"contact_id": contact_id, "channel": "whatsapp", "expiry_days": 7},
        )
        print("agent_link_id:", link.get("id") if isinstance(link, dict) else link)

        print("\n== E2E: lister les liens agent ==")
        links = api_call("GET", api_url, "/api/v1/agents/links", token=token)
        print("agent_links_count:", len(links) if isinstance(links, list) else links)

        print("\n== E2E: OCR (Agent 2) — envoi d'une image minimale ==")
        # tiny 1x1 PNG
        png_bytes = base64.b64decode(
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/UpkG4gAAAAASUVORK5CYII="
        )
        files = {"file": ("tiny.png", png_bytes, "image/png")}
        r = httpx.post(
            f"{api_url}/api/v1/agents/ocr",
            headers={"Authorization": f"Bearer {token}"},
            params={"contact_id": contact_id},
            files=files,
            timeout=120,
        )
        print("ocr_status:", r.status_code)
        # 201 attendu si Gemini OK; sinon 502/503 possibles selon quota/config

        print("\n== E2E: lister les synthèses (Worker 4) ==")
        synth = api_call("GET", api_url, "/api/v1/agents/synthesis", token=token)
        print("synthesis_count:", len(synth) if isinstance(synth, list) else synth)

    print("\n== OK: smoke test terminé ==")
    print(json.dumps({"tenant_slug": tenant_slug, "email": email}, indent=2))


if __name__ == "__main__":
    main()

