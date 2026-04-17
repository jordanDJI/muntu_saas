from functools import lru_cache
from supabase import create_client, Client
from app.core.config import settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Client anon key — opérations soumises à RLS."""
    return create_client(settings.supabase_url, settings.supabase_anon_key)


@lru_cache(maxsize=1)
def get_supabase_admin() -> Client:
    """Client service role — bypass RLS, réservé aux workers et tâches admin."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
