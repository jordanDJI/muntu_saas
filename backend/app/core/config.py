from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

# config.py est dans backend/app/core/ — le .env est à la racine SaaS/ (3 niveaux au-dessus)
_ROOT_ENV = Path(__file__).parents[3] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(_ROOT_ENV), extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str

    resend_api_key: str
    email_from: str
    email_from_name: str = "Plateforme SaaS"

    stripe_secret_key: str
    stripe_webhook_secret: str

    sentry_dsn: str = ""

    app_env: str = "development"
    app_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    frontend_url_prod: str = ""
    secret_key: str

    # Agents IA — Gemini
    gemini_api_key: str = ""
    agent_link_secret: str = ""          # clé HMAC pour signer les tokens JWT agent_link
    agent_link_expiry_days: int = 90     # durée de validité des liens client converti
    agent_ocr_max_size_mb: int = 10      # taille max des fichiers envoyés pour OCR

    # Agent de contenu — proposition automatique d'articles de blog (cron externe)
    # Auth par secret partagé (pas un JWT admin) — l'endpoint force toujours status="draft"
    content_agent_secret: str = ""

    # Revalidation à la demande du cache Next.js frontend (même valeur des deux côtés)
    revalidate_secret: str = ""

    # Agents IA — 360dialog WhatsApp
    dialog360_api_key: str = ""          # clé API 360dialog (D360-API-KEY)
    dialog360_webhook_secret: str = ""   # secret HMAC pour vérifier les webhooks
    dialog360_verify_token: str = ""     # token de vérification webhook Meta

    # Domaines personnalisés — Vercel
    vercel_api_token: str = ""
    vercel_project_id: str = ""

    # Domaines personnalisés — OVH
    ovh_endpoint: str = "ovh-ca"
    ovh_app_key: str = ""
    ovh_app_secret: str = ""
    ovh_consumer_key: str = ""

    # Stripe — addon domaine (+5€/mois pour plans non-Business)
    stripe_domain_addon_price_id: str = ""

    # Marge sur la revente de domaines OVH (% appliqué sur le prix HT OVH)
    domain_markup_percent: float = 25.0

    # Google Indexing API — service account JSON (stringifié)
    google_service_account_json: str = ""

    # Google OAuth — connexion GA4 tenant (backend OAuth flow)
    google_client_id: str = ""
    google_client_secret: str = ""

    # Web Push — VAPID (générer avec: python -c "from py_vapid import Vapid; v=Vapid(); v.generate_keys(); print(v.private_pem().decode()); print(v.public_key.export_public())")
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_claims_email: str = "mailto:support@klientys.co"


settings = Settings()
