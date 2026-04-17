from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    supabase_jwt_secret: str

    resend_api_key: str
    email_from: str
    email_from_name: str = "Plateforme SaaS"

    stripe_secret_key: str
    stripe_webhook_secret: str

    sentry_dsn: str = ""

    app_env: str = "development"
    app_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    secret_key: str


settings = Settings()
