from typing import Any, Dict, Optional
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.admin import get_current_admin

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _log(admin: dict, action: str, tenant_id: str = None, tenant_name: str = None, payload: dict = None):
    get_supabase_admin().table("admin_action_log").insert({
        "admin_user_id": admin["sub"],
        "admin_email": admin.get("email"),
        "action_type": action,
        "target_tenant_id": tenant_id,
        "target_tenant_name": tenant_name,
        "payload": payload,
    }).execute()


async def _supabase_user_patch(user_id: str, body: dict) -> httpx.Response:
    async with httpx.AsyncClient() as c:
        return await c.patch(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            json=body,
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
            timeout=10,
        )


async def _supabase_user_get(user_id: str) -> dict | None:
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
            headers={
                "apikey": settings.supabase_service_role_key,
                "Authorization": f"Bearer {settings.supabase_service_role_key}",
            },
            timeout=10,
        )
        return r.json() if r.status_code == 200 else None


def _parse_dt(s: str) -> datetime:
    dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


def _compute_status(tenant: dict, sub_map: dict, now: datetime) -> str:
    if tenant.get("suspended_at"):
        return "suspended"
    sub = sub_map.get(tenant["id"])
    if sub:
        return sub.get("status", "active")
    ext = tenant.get("trial_extended_until")
    end = _parse_dt(ext) if ext else _parse_dt(tenant["created_at"]) + timedelta(days=14)
    return "trial" if now < end else "trial_expired"


# ─── Métriques ────────────────────────────────────────────────────────────────

@router.get("/metrics")
async def get_metrics(admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    now = datetime.now(timezone.utc)

    tenants = sb.table("tenant").select("id, created_at, suspended_at, trial_extended_until").execute().data or []
    subs = sb.table("subscription").select("tenant_id, status").in_("status", ["active", "trialing"]).execute().data or []
    sub_map = {s["tenant_id"]: s for s in subs}

    counts: dict[str, int] = {"total": len(tenants), "trial": 0, "trial_expired": 0, "active": 0, "trialing": 0, "suspended": 0}
    for t in tenants:
        st = _compute_status(t, sub_map, now)
        counts[st] = counts.get(st, 0) + 1

    seven_ago  = (now - timedelta(days=7)).isoformat()
    thirty_ago = (now - timedelta(days=30)).isoformat()

    published = sb.table("site").select("id", count="exact").eq("status", "published").execute()
    appts     = sb.table("appointment").select("id", count="exact").gte("created_at", thirty_ago).execute()
    domains   = sb.table("custom_domain").select("status").execute().data or []

    paid    = counts["active"] + counts["trialing"]
    expired = counts["trial_expired"]
    conv    = round(paid / (paid + expired) * 100, 1) if (paid + expired) > 0 else 0.0

    # MRR — somme des prix mensuels des abonnements actifs
    paid_subs = sb.table("subscription").select("plan:plan_id(price_monthly)").in_("status", ["active", "trialing"]).execute().data or []
    mrr = sum(
        s["plan"]["price_monthly"] for s in paid_subs
        if s.get("plan") and s["plan"].get("price_monthly")
    )

    return {
        "tenants": counts,
        "new_signups": {
            "last_7d":  sum(1 for t in tenants if t["created_at"] > seven_ago),
            "last_30d": sum(1 for t in tenants if t["created_at"] > thirty_ago),
        },
        "sites_published":       published.count or 0,
        "appointments_30d":      appts.count or 0,
        "custom_domains_active": sum(1 for d in domains if d.get("status") == "active"),
        "trial_to_paid_rate":    conv,
        "mrr":                   mrr,
    }


# ─── Liste des tenants ────────────────────────────────────────────────────────

@router.get("/tenants")
async def list_tenants(
    admin=Depends(get_current_admin),
    search: Optional[str] = None,
    status: Optional[str] = Query(None),
    page: int = 1,
    page_size: int = 25,
):
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc)

    q = sb.table("tenant").select("id, name, slug, sector, country, created_at, suspended_at, trial_extended_until, is_active")
    if search:
        q = q.or_(f"name.ilike.%{search}%,slug.ilike.%{search}%")
    tenants = q.order("created_at", desc=True).execute().data or []

    subs = sb.table("subscription").select("tenant_id, status, plan_id").execute().data or []
    sub_map = {s["tenant_id"]: s for s in subs}

    owners = sb.table("membership").select("tenant_id, user_id").eq("role", "owner").execute().data or []
    owner_map = {m["tenant_id"]: m["user_id"] for m in owners}

    # Récupère les emails en batch depuis Supabase Auth
    email_map: dict[str, str] = {}
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(
                f"{settings.supabase_url}/auth/v1/admin/users?per_page=1000",
                headers={"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}"},
                timeout=15,
            )
            if r.status_code == 200:
                email_map = {u["id"]: u.get("email", "") for u in r.json().get("users", [])}
    except Exception:
        pass

    result = []
    for t in tenants:
        st = _compute_status(t, sub_map, now)
        if status and st != status:
            continue
        uid = owner_map.get(t["id"])
        result.append({**t, "computed_status": st, "owner_user_id": uid, "owner_email": email_map.get(uid) if uid else None})

    total = len(result)
    s = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size, "items": result[s: s + page_size]}


# ─── Détail d'un tenant ───────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, admin=Depends(get_current_admin)):
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc)

    tenant = sb.table("tenant").select("*").eq("id", tenant_id).single().execute().data
    if not tenant:
        raise HTTPException(404, "Tenant introuvable")

    sub_rows = sb.table("subscription").select("*, plan:plan_id(name, price_monthly)").eq("tenant_id", tenant_id).limit(1).execute().data
    sub = sub_rows[0] if sub_rows else None

    owner_row = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
    owner_user_id = owner_row[0]["user_id"] if owner_row else None
    owner_email = None
    if owner_user_id:
        u = await _supabase_user_get(owner_user_id)
        if u:
            owner_email = u.get("email")

    site_row = sb.table("site").select("id, title, status").eq("tenant_id", tenant_id).limit(1).execute().data
    site = site_row[0] if site_row else None

    domain_row = sb.table("custom_domain").select("domain, status").eq("tenant_id", tenant_id).limit(1).execute().data
    domain = domain_row[0] if domain_row else None

    cal_row  = sb.table("calendar").select("id").eq("tenant_id", tenant_id).limit(1).execute().data
    cal_id   = cal_row[0]["id"] if cal_row else None
    appts    = sb.table("appointment").select("id", count="exact").eq("calendar_id", cal_id).execute() if cal_id else type("R", (), {"count": 0})()
    contacts = sb.table("contact").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    leads    = sb.table("lead").select("id", count="exact").eq("tenant_id", tenant_id).execute()

    overrides = sb.table("tenant_feature_override").select("*").eq("tenant_id", tenant_id).execute().data or []
    logs = sb.table("admin_action_log").select("*").eq("target_tenant_id", tenant_id).order("created_at", desc=True).limit(30).execute().data or []

    sub_map = {tenant_id: sub} if sub else {}
    return {
        "tenant": {**tenant, "computed_status": _compute_status(tenant, sub_map, now)},
        "owner":  {"user_id": owner_user_id, "email": owner_email},
        "subscription": sub,
        "site":   site,
        "domain": domain,
        "counts": {"appointments": appts.count or 0, "contacts": contacts.count or 0, "leads": leads.count or 0},
        "overrides": overrides,
        "action_log": logs,
    }


# ─── Modifier un tenant ───────────────────────────────────────────────────────

class TenantPatch(BaseModel):
    name:    Optional[str] = None
    slug:    Optional[str] = None
    sector:  Optional[str] = None
    country: Optional[str] = None

@router.patch("/tenants/{tenant_id}")
async def patch_tenant(tenant_id: str, body: TenantPatch, admin=Depends(get_current_admin)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "Aucun champ à modifier")
    get_supabase_admin().table("tenant").update(data).eq("id", tenant_id).execute()
    _log(admin, "patch_tenant", tenant_id, payload=data)
    return {"ok": True}


# ─── Supprimer un tenant ──────────────────────────────────────────────────────

@router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    t  = sb.table("tenant").select("name").eq("id", tenant_id).single().execute().data
    if not t:
        raise HTTPException(404, "Tenant introuvable")
    sb.table("tenant").delete().eq("id", tenant_id).execute()
    _log(admin, "delete_tenant", tenant_id, t["name"])
    return {"ok": True}


# ─── Étendre le trial ─────────────────────────────────────────────────────────

class ExtendTrialIn(BaseModel):
    days: int = 7

@router.post("/tenants/{tenant_id}/extend-trial")
async def extend_trial(tenant_id: str, body: ExtendTrialIn, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    t  = sb.table("tenant").select("name, created_at, trial_extended_until").eq("id", tenant_id).single().execute().data
    if not t:
        raise HTTPException(404, "Tenant introuvable")
    now = datetime.now(timezone.utc)
    ext = t.get("trial_extended_until")
    base = _parse_dt(ext) if ext else _parse_dt(t["created_at"]) + timedelta(days=14)
    new_end = (max(base, now) + timedelta(days=body.days)).isoformat()
    sb.table("tenant").update({"trial_extended_until": new_end}).eq("id", tenant_id).execute()
    _log(admin, "extend_trial", tenant_id, t["name"], {"days": body.days, "new_end": new_end})
    return {"ok": True, "trial_extended_until": new_end}


# ─── Suspendre / réactiver ────────────────────────────────────────────────────

class SuspendIn(BaseModel):
    reason: Optional[str] = None

@router.post("/tenants/{tenant_id}/suspend")
async def suspend_tenant(tenant_id: str, body: SuspendIn, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    t  = sb.table("tenant").select("name").eq("id", tenant_id).single().execute().data
    if not t:
        raise HTTPException(404, "Tenant introuvable")
    sb.table("tenant").update({"suspended_at": datetime.now(timezone.utc).isoformat(), "suspended_reason": body.reason, "is_active": False}).eq("id", tenant_id).execute()
    _log(admin, "suspend", tenant_id, t["name"], {"reason": body.reason})
    return {"ok": True}

@router.post("/tenants/{tenant_id}/unsuspend")
async def unsuspend_tenant(tenant_id: str, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    t  = sb.table("tenant").select("name").eq("id", tenant_id).single().execute().data
    if not t:
        raise HTTPException(404, "Tenant introuvable")
    sb.table("tenant").update({"suspended_at": None, "suspended_reason": None, "is_active": True}).eq("id", tenant_id).execute()
    _log(admin, "unsuspend", tenant_id, t["name"])
    return {"ok": True}


# ─── Forcer l'activation (sans Stripe) ───────────────────────────────────────

class ForceActivateIn(BaseModel):
    plan_id: Optional[str] = None

@router.post("/tenants/{tenant_id}/force-activate")
async def force_activate(tenant_id: str, body: ForceActivateIn, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    t  = sb.table("tenant").select("name").eq("id", tenant_id).single().execute().data
    if not t:
        raise HTTPException(404, "Tenant introuvable")

    plan_id = body.plan_id
    if not plan_id:
        plans = sb.table("plan_subscription").select("id, name").execute().data or []
        pro   = next((p for p in plans if "pro" in p.get("name", "").lower()), None) or (plans[0] if plans else None)
        if not pro:
            raise HTTPException(400, "Aucun plan trouvé en base")
        plan_id = pro["id"]

    existing = sb.table("subscription").select("id").eq("tenant_id", tenant_id).limit(1).execute().data
    if existing:
        sb.table("subscription").update({"status": "active", "plan_id": plan_id}).eq("tenant_id", tenant_id).execute()
    else:
        sb.table("subscription").insert({"tenant_id": tenant_id, "plan_id": plan_id, "status": "active", "stripe_subscription_id": f"manual_{tenant_id[:8]}"}).execute()

    _log(admin, "force_activate", tenant_id, t["name"], {"plan_id": plan_id})
    return {"ok": True}


# ─── Vider le cache ROI ───────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/clear-cache")
async def clear_cache(tenant_id: str, admin=Depends(get_current_admin)):
    get_supabase_admin().table("tenant_roi_cache").delete().eq("tenant_id", tenant_id).execute()
    _log(admin, "clear_cache", tenant_id)
    return {"ok": True}


# ─── Confirmer l'email ────────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/confirm-email")
async def confirm_email(tenant_id: str, admin=Depends(get_current_admin)):
    sb    = get_supabase_admin()
    owner = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
    if not owner:
        raise HTTPException(404, "Propriétaire introuvable")
    r = await _supabase_user_patch(owner[0]["user_id"], {"email_confirm": True})
    if r.status_code != 200:
        raise HTTPException(502, f"Erreur Supabase Auth: {r.text}")
    _log(admin, "confirm_email", tenant_id)
    return {"ok": True}


# ─── Envoyer un reset de mot de passe ────────────────────────────────────────

@router.post("/tenants/{tenant_id}/reset-password")
async def reset_password(tenant_id: str, admin=Depends(get_current_admin)):
    sb    = get_supabase_admin()
    owner = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
    if not owner:
        raise HTTPException(404, "Propriétaire introuvable")

    user = await _supabase_user_get(owner[0]["user_id"])
    if not user:
        raise HTTPException(502, "Impossible de récupérer l'utilisateur")
    email = user.get("email")

    async with httpx.AsyncClient() as c:
        await c.post(
            f"{settings.supabase_url}/auth/v1/recover",
            json={"email": email},
            headers={"apikey": settings.supabase_anon_key, "Content-Type": "application/json"},
            timeout=10,
        )
    _log(admin, "reset_password", tenant_id, payload={"email": email})
    return {"ok": True}


# ─── Feature flags ────────────────────────────────────────────────────────────

class FlagIn(BaseModel):
    key:         str
    name:        str
    description: Optional[str] = None
    enabled:     bool = False

class FlagPatch(BaseModel):
    enabled:     Optional[bool] = None
    name:        Optional[str]  = None
    description: Optional[str]  = None

@router.get("/feature-flags")
async def list_flags(admin=Depends(get_current_admin)):
    return get_supabase_admin().table("feature_flag").select("*").order("key").execute().data or []

@router.post("/feature-flags")
async def create_flag(body: FlagIn, admin=Depends(get_current_admin)):
    row = get_supabase_admin().table("feature_flag").insert(body.model_dump()).execute().data[0]
    _log(admin, "create_feature_flag", payload={"key": body.key})
    return row

@router.patch("/feature-flags/{key}")
async def update_flag(key: str, body: FlagPatch, admin=Depends(get_current_admin)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not data:
        raise HTTPException(400, "Aucun champ")
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    get_supabase_admin().table("feature_flag").update(data).eq("key", key).execute()
    _log(admin, "update_feature_flag", payload={"key": key, **data})
    return {"ok": True}

@router.delete("/feature-flags/{key}")
async def delete_flag(key: str, admin=Depends(get_current_admin)):
    get_supabase_admin().table("feature_flag").delete().eq("key", key).execute()
    _log(admin, "delete_feature_flag", payload={"key": key})
    return {"ok": True}


# ─── Overrides par tenant ─────────────────────────────────────────────────────

class OverrideIn(BaseModel):
    feature_key: str
    enabled:     bool
    note:        Optional[str] = None

@router.post("/tenants/{tenant_id}/overrides")
async def set_override(tenant_id: str, body: OverrideIn, admin=Depends(get_current_admin)):
    get_supabase_admin().table("tenant_feature_override").upsert(
        {"tenant_id": tenant_id, **body.model_dump()},
        on_conflict="tenant_id,feature_key",
    ).execute()
    _log(admin, "set_override", tenant_id, payload=body.model_dump())
    return {"ok": True}

@router.delete("/tenants/{tenant_id}/overrides/{feature_key}")
async def delete_override(tenant_id: str, feature_key: str, admin=Depends(get_current_admin)):
    get_supabase_admin().table("tenant_feature_override").delete().eq("tenant_id", tenant_id).eq("feature_key", feature_key).execute()
    _log(admin, "delete_override", tenant_id, payload={"feature_key": feature_key})
    return {"ok": True}


# ─── Configuration système ────────────────────────────────────────────────────

@router.get("/system-config")
async def get_config(admin=Depends(get_current_admin)):
    rows = get_supabase_admin().table("system_config").select("*").execute().data or []
    return {r["key"]: r["value"] for r in rows}

@router.patch("/system-config")
async def update_config(body: Dict[str, Any] = Body(...), admin=Depends(get_current_admin)):
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()
    for key, value in body.items():
        sb.table("system_config").upsert({"key": key, "value": value, "updated_at": now}).execute()
    _log(admin, "update_system_config", payload=body)
    return {"ok": True}


# ─── Log des actions ──────────────────────────────────────────────────────────

@router.get("/action-log")
async def get_action_log(
    admin=Depends(get_current_admin),
    page: int = 1,
    page_size: int = 50,
    action_type: Optional[str] = None,
    admin_email: Optional[str] = None,
):
    sb = get_supabase_admin()
    offset = (page - 1) * page_size

    q = sb.table("admin_action_log").select("*", count="exact").order("created_at", desc=True)
    if action_type:
        q = q.eq("action_type", action_type)
    if admin_email:
        q = q.eq("admin_email", admin_email)
    res = q.range(offset, offset + page_size - 1).execute()
    return {"items": res.data or [], "total": res.count or 0}


# ─── Croissance (graphique) ───────────────────────────────────────────────────

@router.get("/metrics/growth")
async def get_growth(admin=Depends(get_current_admin), days: int = 30):
    from collections import defaultdict
    sb    = get_supabase_admin()
    now   = datetime.now(timezone.utc)
    since = (now - timedelta(days=days)).isoformat()
    tenants = sb.table("tenant").select("created_at").gte("created_at", since).execute().data or []
    counts: dict[str, int] = defaultdict(int)
    for t in tenants:
        counts[t["created_at"][:10]] += 1
    return [
        {"date": (now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d"),
         "count": counts.get((now - timedelta(days=days - 1 - i)).strftime("%Y-%m-%d"), 0)}
        for i in range(days)
    ]


# ─── Créer un tenant manuellement ────────────────────────────────────────────

class CreateTenantIn(BaseModel):
    email:        str
    name:         str
    slug:         str
    sector:       str = "other"
    country:      str = "BE"
    send_invite:  bool = True
    password:     Optional[str] = None

@router.post("/tenants")
async def create_tenant(body: CreateTenantIn, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()

    if sb.table("tenant").select("id").eq("slug", body.slug).limit(1).execute().data:
        raise HTTPException(400, f"Slug '{body.slug}' déjà utilisé")

    user_payload: dict = {"email": body.email, "email_confirm": True}
    if body.password:
        user_payload["password"] = body.password

    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            json=user_payload,
            headers={"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}"},
            timeout=10,
        )
        if r.status_code not in (200, 201):
            raise HTTPException(400, f"Erreur création user: {r.json().get('message', r.text)}")
        user_id = r.json()["id"]

    tenant = sb.table("tenant").insert({"name": body.name, "slug": body.slug, "sector": body.sector, "country": body.country, "is_active": True}).execute().data[0]
    sb.table("membership").insert({"tenant_id": tenant["id"], "user_id": user_id, "role": "owner"}).execute()
    sb.table("calendar").insert({"tenant_id": tenant["id"]}).execute()
    await _supabase_user_patch(user_id, {"app_metadata": {"tenant_id": tenant["id"]}})

    if body.send_invite and not body.password:
        async with httpx.AsyncClient() as c:
            await c.post(f"{settings.supabase_url}/auth/v1/recover", json={"email": body.email},
                         headers={"apikey": settings.supabase_anon_key}, timeout=10)

    _log(admin, "create_tenant", tenant["id"], body.name, {"email": body.email})
    return {"ok": True, "tenant_id": tenant["id"]}


# ─── Impersonation ────────────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/impersonate")
async def impersonate(tenant_id: str, admin=Depends(get_current_admin)):
    sb    = get_supabase_admin()
    owner = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
    if not owner:
        raise HTTPException(404, "Propriétaire introuvable")

    user = await _supabase_user_get(owner[0]["user_id"])
    if not user:
        raise HTTPException(502, "Utilisateur introuvable")

    redirect = f"{settings.frontend_url or settings.frontend_url_prod}/dashboard"
    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{settings.supabase_url}/auth/v1/admin/generate_link",
            json={"type": "magiclink", "email": user["email"], "redirect_to": redirect},
            headers={"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}"},
            timeout=10,
        )
        if r.status_code != 200:
            raise HTTPException(502, f"Erreur génération lien: {r.text}")
        link = r.json().get("action_link") or r.json().get("properties", {}).get("action_link")

    _log(admin, "impersonate", tenant_id, payload={"email": user["email"]})
    return {"link": link}


# ─── Changer l'email du propriétaire ─────────────────────────────────────────

class ChangeEmailIn(BaseModel):
    email: str

@router.patch("/tenants/{tenant_id}/owner-email")
async def change_owner_email(tenant_id: str, body: ChangeEmailIn, admin=Depends(get_current_admin)):
    sb    = get_supabase_admin()
    owner = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
    if not owner:
        raise HTTPException(404, "Propriétaire introuvable")
    r = await _supabase_user_patch(owner[0]["user_id"], {"email": body.email, "email_confirm": True})
    if r.status_code != 200:
        raise HTTPException(502, f"Erreur Supabase Auth: {r.text}")
    _log(admin, "change_email", tenant_id, payload={"new_email": body.email})
    return {"ok": True}


# ─── Synchroniser depuis Stripe ───────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/sync-stripe")
async def sync_stripe(tenant_id: str, admin=Depends(get_current_admin)):
    import stripe as stripe_lib
    stripe_lib.api_key = settings.stripe_secret_key.strip() if settings.stripe_secret_key else ""

    sb      = get_supabase_admin()
    sub_row = sb.table("subscription").select("stripe_subscription_id, status").eq("tenant_id", tenant_id).limit(1).execute().data
    if not sub_row or not sub_row[0].get("stripe_subscription_id"):
        raise HTTPException(404, "Aucun abonnement Stripe trouvé")

    stripe_id = sub_row[0]["stripe_subscription_id"]
    if stripe_id.startswith("manual_"):
        raise HTTPException(400, "Abonnement créé manuellement — sync impossible")

    try:
        stripe_sub = stripe_lib.Subscription.retrieve(stripe_id)
        sb.table("subscription").update({"status": stripe_sub.status}).eq("tenant_id", tenant_id).execute()
        _log(admin, "sync_stripe", tenant_id, payload={"status": stripe_sub.status})
        return {"ok": True, "status": stripe_sub.status}
    except stripe_lib.error.InvalidRequestError:
        raise HTTPException(404, "Abonnement introuvable sur Stripe")
    except stripe_lib.error.AuthenticationError:
        raise HTTPException(503, "Clé Stripe non configurée")


# ─── Reset du domaine custom ──────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/reset-domain")
async def reset_domain(tenant_id: str, admin=Depends(get_current_admin)):
    sb  = get_supabase_admin()
    row = sb.table("custom_domain").select("id, domain").eq("tenant_id", tenant_id).limit(1).execute().data
    if not row:
        raise HTTPException(404, "Aucun domaine trouvé")
    sb.table("custom_domain").update({"status": "pending", "vercel_status": None}).eq("tenant_id", tenant_id).execute()
    _log(admin, "reset_domain", tenant_id, payload={"domain": row[0]["domain"]})
    return {"ok": True}


# ─── Gestion des secteurs ─────────────────────────────────────────────────────

@router.get("/sectors")
async def get_sectors(admin=Depends(get_current_admin)):
    from app.services.trends import SECTOR_KEYWORDS as DEFAULT_KW
    sb      = get_supabase_admin()
    kw_row  = sb.table("system_config").select("value").eq("key", "sector_keywords").limit(1).execute().data
    lbl_row = sb.table("system_config").select("value").eq("key", "sector_labels").limit(1).execute().data
    keywords = {**DEFAULT_KW, **(kw_row[0]["value"] if kw_row else {})}
    labels   = lbl_row[0]["value"] if lbl_row else {}
    return [{"key": k, "label": labels.get(k, k), "keywords": v} for k, v in keywords.items()]

class SectorPatch(BaseModel):
    keywords: list[str]
    label:    Optional[str] = None

@router.patch("/sectors/{key}")
async def update_sector(key: str, body: SectorPatch, admin=Depends(get_current_admin)):
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()

    kw_row  = sb.table("system_config").select("value").eq("key", "sector_keywords").limit(1).execute().data
    current = kw_row[0]["value"] if kw_row else {}
    current[key] = body.keywords
    sb.table("system_config").upsert({"key": "sector_keywords", "value": current, "updated_at": now}).execute()

    if body.label:
        lbl_row  = sb.table("system_config").select("value").eq("key", "sector_labels").limit(1).execute().data
        labels   = lbl_row[0]["value"] if lbl_row else {}
        labels[key] = body.label
        sb.table("system_config").upsert({"key": "sector_labels", "value": labels, "updated_at": now}).execute()

    _log(admin, "update_sector", payload={"key": key})
    return {"ok": True}
