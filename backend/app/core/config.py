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


settings = Settings()
