import logging
from app.core.supabase import get_supabase_admin

logger = logging.getLogger(__name__)


def log_activity(tenant_id: str, user_id: str, action: str, detail: str | None = None) -> None:
    try:
        sb = get_supabase_admin()
        sb.table("activity_log").insert({
            "tenant_id": tenant_id,
            "user_id": user_id,
            "action": action,
            "detail": detail,
        }).execute()
    except Exception as e:
        logger.warning(f"activity log failed: {e}")
