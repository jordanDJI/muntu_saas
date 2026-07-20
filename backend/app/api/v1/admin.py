import logging
from typing import Any, Dict, Optional
from datetime import datetime, timedelta, timezone
import stripe as stripe_lib

logger = logging.getLogger(__name__)

import httpx
from fastapi import APIRouter, BackgroundTasks, Body, Depends, HTTPException, Query
from pydantic import BaseModel

import secrets

from app.core.config import settings
from app.core.supabase import get_supabase_admin
from app.middleware.admin import get_current_admin, viewer_or_above, support_or_above
from app.middleware.rate_limit import check_rate_by_key
from app.services import email as email_svc

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


def _get_owner_info(supabase, tenant_id: str) -> dict:
    """Retourne {email, name, tenant_name, country} du propriétaire d'un tenant."""
    import logging as _logging
    try:
        tenant = supabase.table("tenant").select("name, country").eq("id", tenant_id).single().execute().data or {}
        owner_m = supabase.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute()
        if not owner_m.data:
            return {}
        user_id = owner_m.data[0]["user_id"]
        user_res = supabase.auth.admin.get_user_by_id(user_id)
        user = user_res.user if user_res else None
        email = user.email if user else None
        name = ((user.user_metadata or {}).get("full_name") or (user.user_metadata or {}).get("name") or "") if user else ""
        return {"email": email, "name": name, "tenant_name": tenant.get("name", ""), "country": tenant.get("country", "BE")}
    except Exception as exc:
        _logging.getLogger(__name__).warning("_get_owner_info failed for tenant %s: %s", tenant_id, exc)
        return {}


def _compute_status(tenant: dict, sub_map: dict, now: datetime, included_set: set | None = None) -> str:
    if tenant.get("suspended_at"):
        return "suspended"
    sub = sub_map.get(tenant["id"])
    if sub:
        return sub.get("status", "active")
    if included_set and tenant["id"] in included_set:
        return "included"
    ext = tenant.get("trial_extended_until")
    end = _parse_dt(ext) if ext else _parse_dt(tenant["created_at"]) + timedelta(days=14)
    return "trial" if now < end else "trial_expired"


def _compute_included_set(subs_with_plan: list, owner_memberships: list, all_tenant_dates: list) -> set:
    """Calcule en bulk les tenant_ids 'inclus' dans un Business (max 2 par owner).
    subs_with_plan : [{tenant_id, status, plan:{name}}] — abonnements actifs/trialing uniquement.
    owner_memberships : [{tenant_id, user_id}] — memberships role=owner.
    all_tenant_dates : [{id, created_at}] — tous les tenants (pour l'ordre d'ancienneté).
    """
    from app.services.subscription import BUSINESS_INCLUDED_MAX

    tenant_plan_map: dict[str, str] = {}
    tenants_with_sub: set = set()
    for sub in subs_with_plan:
        t_id = sub["tenant_id"]
        tenants_with_sub.add(t_id)
        plan_name = (sub.get("plan") or {}).get("name")
        if plan_name:
            tenant_plan_map[t_id] = plan_name

    user_tenants: dict[str, list] = {}
    for m in owner_memberships:
        user_tenants.setdefault(m["user_id"], []).append(m["tenant_id"])

    created_map = {t["id"]: t.get("created_at", "") for t in all_tenant_dates}

    included: set = set()
    for tenant_ids in user_tenants.values():
        business_tid = next((t for t in tenant_ids if tenant_plan_map.get(t) == "Business"), None)
        if not business_tid:
            continue
        candidates = [t for t in tenant_ids if t != business_tid and t not in tenants_with_sub]
        candidates.sort(key=lambda t: created_map.get(t, ""))
        for t in candidates[:BUSINESS_INCLUDED_MAX]:
            included.add(t)

    return included


def _compute_profile_score(sb, tenant_id: str, site: dict | None) -> dict:
    """Score de complétion du profil (0-100) — même logique que /profile/completion."""
    s = site or {}
    site_style = s.get("site_style") or {}
    site_id = s.get("id")

    has_title   = bool((s.get("title") or "").strip())
    photo_urls  = site_style.get("photo_urls") or {}
    has_photos  = bool(site_style.get("logo_url")) or any(v for v in photo_urls.values() if v)
    is_pub      = s.get("status") == "published"

    has_slots = False
    cal = sb.table("calendar").select("id").eq("tenant_id", tenant_id).maybe_single().execute()
    if cal.data:
        sl = sb.table("availability_slot").select("id", count="exact").eq("calendar_id", cal.data["id"]).execute()
        has_slots = (sl.count or 0) > 0

    has_offers = False
    if site_id:
        of = sb.table("service_offer").select("id", count="exact").eq("site_id", site_id).execute()
        has_offers = (of.count or 0) > 0

    steps = [
        {"key": "title",     "done": has_title},
        {"key": "photos",    "done": has_photos},
        {"key": "slots",     "done": has_slots},
        {"key": "offers",    "done": has_offers},
        {"key": "published", "done": is_pub},
    ]
    return {"score": int(sum(1 for st in steps if st["done"]) / len(steps) * 100), "steps": steps}


def _auto_unpublish_expired_sites(sb, now: datetime) -> int:
    """Dépublie automatiquement les sites des tenants expirés depuis 90+ jours.
    Appelé en tâche de fond lors du chargement de la page Relances.
    Retourne le nombre de sites dépubliés."""

    # Tenants créés il y a 104+ jours (14j essai + 90j de grâce)
    grace_cutoff = now - timedelta(days=104)
    old_tenants = (
        sb.table("tenant")
        .select("id, name, created_at, trial_extended_until, suspended_at")
        .lt("created_at", grace_cutoff.isoformat())
        .execute().data or []
    )
    # Exclure suspendus (leur statut n'est pas trial_expired)
    old_tenants = [t for t in old_tenants if not t.get("suspended_at")]
    if not old_tenants:
        return 0

    paid_ids = {
        s["tenant_id"] for s in (
            sb.table("subscription").select("tenant_id")
            .in_("status", ["active", "trialing"]).execute().data or []
        )
    }

    # Tenants réellement expirés depuis 90+ jours (respecte trial_extended_until)
    expired_90_ids = set()
    for t in old_tenants:
        if t["id"] in paid_ids:
            continue
        ext      = t.get("trial_extended_until")
        exp_date = _parse_dt(ext) if ext else _parse_dt(t["created_at"]) + timedelta(days=14)
        if exp_date + timedelta(days=90) < now:
            expired_90_ids.add(t["id"])

    if not expired_90_ids:
        return 0

    pub_sites = (
        sb.table("site").select("id, tenant_id")
        .eq("status", "published")
        .in_("tenant_id", list(expired_90_ids))
        .execute().data or []
    )
    if not pub_sites:
        return 0

    # Dépublication
    sb.table("site").update({"status": "draft"}) \
        .in_("tenant_id", [s["tenant_id"] for s in pub_sites]).execute()

    # Audit log en batch
    tenant_names = {t["id"]: t["name"] for t in old_tenants}
    sb.table("admin_action_log").insert([
        {
            "admin_user_id":     "system",
            "admin_email":       "system@klientys.co",
            "action_type":       "auto_unpublish_site",
            "target_tenant_id":  s["tenant_id"],
            "target_tenant_name": tenant_names.get(s["tenant_id"], "?"),
            "payload":           {"reason": "trial_expired_90d"},
        }
        for s in pub_sites
    ]).execute()

    return len(pub_sites)


# ─── Métriques ────────────────────────────────────────────────────────────────

@router.get("/metrics")
async def get_metrics(admin=Depends(viewer_or_above)):
    sb = get_supabase_admin()
    now = datetime.now(timezone.utc)

    tenants = sb.table("tenant").select("id, created_at, suspended_at, trial_extended_until").execute().data or []
    subs = sb.table("subscription").select("tenant_id, status, plan:plan_id(name)").in_("status", ["active", "trialing"]).execute().data or []
    sub_map = {s["tenant_id"]: s for s in subs}

    owner_memberships = sb.table("membership").select("tenant_id, user_id").eq("role", "owner").execute().data or []
    included_set = _compute_included_set(subs, owner_memberships, tenants)

    counts: dict[str, int] = {"total": len(tenants), "trial": 0, "trial_expired": 0, "active": 0, "trialing": 0, "suspended": 0, "included": 0}
    for t in tenants:
        st = _compute_status(t, sub_map, now, included_set)
        counts[st] = counts.get(st, 0) + 1

    seven_ago  = (now - timedelta(days=7)).isoformat()
    thirty_ago = (now - timedelta(days=30)).isoformat()

    published = sb.table("site").select("id", count="exact").eq("status", "published").execute()
    appts     = sb.table("appointment").select("id", count="exact").gte("created_at", thirty_ago).execute()
    domains   = sb.table("custom_domain").select("status").execute().data or []

    paid    = counts["active"] + counts["trialing"]
    expired = counts["trial_expired"]
    conv    = round(paid / (paid + expired) * 100, 1) if (paid + expired) > 0 else 0.0

    # MRR + plan distribution
    paid_subs = sb.table("subscription").select("plan:plan_id(name, price_monthly)").in_("status", ["active", "trialing"]).execute().data or []
    mrr = sum(
        s["plan"]["price_monthly"] for s in paid_subs
        if s.get("plan") and s["plan"].get("price_monthly")
    )
    plan_dist: dict[str, int] = {}
    for s in paid_subs:
        name = (s.get("plan") or {}).get("name") or "Autre"
        plan_dist[name] = plan_dist.get(name, 0) + 1

    # Contacts total
    contacts_total = sb.table("contact").select("id", count="exact").execute().count or 0

    # Campagnes email (30j)
    campaigns_30d = sb.table("email_campaign").select("id", count="exact").gte("created_at", thirty_ago).execute().count or 0

    # Demandes en attente (logo + design)
    logo_pending   = sb.table("logo_request").select("id", count="exact").eq("status", "pending").execute().count or 0
    design_pending = sb.table("design_request").select("id", count="exact").eq("status", "pending").execute().count or 0

    # Relances CRM en retard (due_date dépassée, non terminées)
    reminders_overdue = sb.table("contact_reminder").select("id", count="exact") \
        .lt("due_date", now.date().isoformat()).eq("done", False).execute().count or 0

    # Churn rate (essai expiré sans conversion / total des tenants arrivés à terme)
    expired_or_paid = paid + expired
    churn_rate = round(expired / max(1, expired_or_paid) * 100, 1)

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
        "arr":                   mrr * 12,
        "churn_rate":            churn_rate,
        "contacts_total":        contacts_total,
        "campaigns_30d":           campaigns_30d,
        "logo_requests_pending":   logo_pending,
        "design_requests_pending": design_pending,
        "reminders_overdue":       reminders_overdue,
        "plan_distribution":       plan_dist,
    }


# ─── Liste des tenants ────────────────────────────────────────────────────────

@router.get("/tenants")
async def list_tenants(
    admin=Depends(viewer_or_above),
    search: Optional[str] = None,
    status: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    page: int = 1,
    page_size: int = 25,
):
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc)

    q = sb.table("tenant").select("id, name, slug, sector, country, created_at, suspended_at, trial_extended_until, is_active")
    if search:
        q = q.or_(f"name.ilike.%{search}%,slug.ilike.%{search}%")
    if sector:
        q = q.eq("sector", sector)
    tenants = q.order("created_at", desc=True).execute().data or []

    subs = sb.table("subscription").select("tenant_id, status, plan_id, plan:plan_id(name)").execute().data or []
    sub_map = {s["tenant_id"]: s for s in subs}

    owners = sb.table("membership").select("tenant_id, user_id").eq("role", "owner").execute().data or []
    owner_map = {m["tenant_id"]: m["user_id"] for m in owners}

    # Pour l'included_set on a besoin des dates de tous les tenants (pas seulement la page courante)
    all_tenant_dates = sb.table("tenant").select("id, created_at").execute().data or []
    active_subs = [s for s in subs if s.get("status") in ("active", "trialing")]
    included_set = _compute_included_set(active_subs, owners, all_tenant_dates)

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
        st = _compute_status(t, sub_map, now, included_set)
        if status and st != status:
            continue
        uid = owner_map.get(t["id"])
        result.append({**t, "computed_status": st, "owner_user_id": uid, "owner_email": email_map.get(uid) if uid else None})

    total = len(result)
    s = (page - 1) * page_size
    return {"total": total, "page": page, "page_size": page_size, "items": result[s: s + page_size]}


# ─── Détail d'un tenant ───────────────────────────────────────────────────────

@router.get("/tenants/{tenant_id}")
async def get_tenant(tenant_id: str, admin=Depends(viewer_or_above)):
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

    cal_row     = sb.table("calendar").select("id").eq("tenant_id", tenant_id).limit(1).execute().data
    cal_id      = cal_row[0]["id"] if cal_row else None
    appts       = sb.table("appointment").select("id", count="exact").eq("calendar_id", cal_id).execute() if cal_id else type("R", (), {"count": 0})()
    contacts    = sb.table("contact").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    leads       = sb.table("lead").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    campaigns   = sb.table("email_campaign").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    reminders   = sb.table("contact_reminder").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    attachments = sb.table("contact_attachment").select("id", count="exact").eq("tenant_id", tenant_id).execute()
    tags        = sb.table("contact_tag").select("id", count="exact").eq("tenant_id", tenant_id).execute()

    # Rappels d'essai déjà envoyés (seuils en jours)
    trial_reminders = [
        r["days_before"]
        for r in (sb.table("trial_reminder_log").select("days_before").eq("tenant_id", tenant_id).execute().data or [])
    ]

    overrides = sb.table("tenant_feature_override").select("*").eq("tenant_id", tenant_id).execute().data or []
    logs = sb.table("admin_action_log").select("*").eq("target_tenant_id", tenant_id).order("created_at", desc=True).limit(30).execute().data or []

    profile = _compute_profile_score(sb, tenant_id, site)

    sub_map = {tenant_id: sub} if sub else {}
    return {
        "tenant": {**tenant, "computed_status": _compute_status(tenant, sub_map, now)},
        "owner":  {"user_id": owner_user_id, "email": owner_email},
        "subscription": sub,
        "site":   site,
        "domain": domain,
        "counts": {
            "appointments": appts.count or 0,
            "contacts":     contacts.count or 0,
            "leads":        leads.count or 0,
            "campaigns":    campaigns.count or 0,
            "reminders":    reminders.count or 0,
            "attachments":  attachments.count or 0,
            "tags":         tags.count or 0,
        },
        "profile": profile,
        "trial_reminders_sent": sorted(trial_reminders),
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
    _log(admin, "delete_tenant", tenant_id, t["name"])
    sb.table("tenant").delete().eq("id", tenant_id).execute()
    return {"ok": True}


# ─── Étendre le trial ─────────────────────────────────────────────────────────

class ExtendTrialIn(BaseModel):
    days: int = 7

@router.post("/tenants/{tenant_id}/extend-trial")
async def extend_trial(tenant_id: str, body: ExtendTrialIn, admin=Depends(support_or_above)):
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
        sb.table("subscription").insert({"tenant_id": tenant_id, "plan_id": plan_id, "status": "active"}).execute()

    _log(admin, "force_activate", tenant_id, t["name"], {"plan_id": plan_id})
    return {"ok": True}


# ─── Vider le cache ROI ───────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/clear-cache")
async def clear_cache(tenant_id: str, admin=Depends(support_or_above)):
    get_supabase_admin().table("tenant_roi_cache").delete().eq("tenant_id", tenant_id).execute()
    _log(admin, "clear_cache", tenant_id)
    return {"ok": True}


# ─── Confirmer l'email ────────────────────────────────────────────────────────

@router.post("/tenants/{tenant_id}/confirm-email")
async def confirm_email(tenant_id: str, admin=Depends(support_or_above)):
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
async def reset_password(tenant_id: str, admin=Depends(support_or_above)):
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
    value_int:   Optional[int] = None  # pour les features numériques (max_contacts, etc.)
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
    admin=Depends(viewer_or_above),
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
async def get_growth(admin=Depends(viewer_or_above), days: int = 30):
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


# ─── Top customers ───────────────────────────────────────────────────────────

@router.get("/metrics/top-customers")
async def get_top_customers(admin=Depends(viewer_or_above), limit: int = 10):
    sb = get_supabase_admin()

    subs = sb.table("subscription")\
        .select("tenant_id, status, plan:plan_id(name, price_monthly)")\
        .in_("status", ["active", "trialing"])\
        .execute().data or []

    if not subs:
        return []

    tenant_ids = [s["tenant_id"] for s in subs]
    tenants_data = sb.table("tenant").select("id, name").in_("id", tenant_ids).execute().data or []
    tenant_map = {t["id"]: t["name"] for t in tenants_data}

    sites = sb.table("site").select("tenant_id").in_("tenant_id", tenant_ids).execute().data or []
    site_map: dict[str, int] = {}
    for si in sites:
        tid = si["tenant_id"]; site_map[tid] = site_map.get(tid, 0) + 1

    contacts = sb.table("contact").select("tenant_id").in_("tenant_id", tenant_ids).execute().data or []
    contact_map: dict[str, int] = {}
    for c in contacts:
        tid = c["tenant_id"]; contact_map[tid] = contact_map.get(tid, 0) + 1

    result = []
    for s in subs:
        plan = s.get("plan") or {}
        tid = s["tenant_id"]
        result.append({
            "tenant_id": tid,
            "name": tenant_map.get(tid, "—"),
            "status": s.get("status", "active"),
            "plan": plan.get("name", "—"),
            "mrr": plan.get("price_monthly") or 0,
            "sites_built": site_map.get(tid, 0),
            "crm_contacts": contact_map.get(tid, 0),
        })

    result.sort(key=lambda x: x["mrr"], reverse=True)
    return result[:limit]


# ─── Funnel de conversion ────────────────────────────────────────────────────

@router.get("/metrics/funnel")
async def get_funnel(admin=Depends(viewer_or_above)):
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc)
    ninety_ago = (now - timedelta(days=90)).isoformat()

    tenants = sb.table("tenant").select("id, created_at, suspended_at, trial_extended_until").execute().data or []
    subs    = sb.table("subscription").select("tenant_id, status").in_("status", ["active", "trialing"]).execute().data or []
    sub_map = {s["tenant_id"]: s for s in subs}

    total         = len(tenants)
    in_trial_ids  = {t["id"] for t in tenants if _compute_status(t, sub_map, now) in ["trial", "active", "trialing"]}
    in_trial      = len(in_trial_ids)
    paid          = sum(1 for t in tenants if _compute_status(t, sub_map, now) in ["active", "trialing"])
    retained      = sum(1 for t in tenants if _compute_status(t, sub_map, now) in ["active", "trialing"] and t["created_at"] < ninety_ago)
    # Tenants non-expirés ayant publié leur site — garanti ≤ in_trial
    pub_rows  = sb.table("site").select("tenant_id").eq("status", "published").execute().data or []
    sites_pub = len({r["tenant_id"] for r in pub_rows} & in_trial_ids)

    return [
        {"label": "Inscriptions",  "value": total},
        {"label": "Essai activé",  "value": in_trial},
        {"label": "Site publié",   "value": sites_pub},
        {"label": "Payant",        "value": paid},
        {"label": "Après 3 mois",  "value": retained},
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
    from app.api.v1.calendar import _ensure_calendar
    _ensure_calendar(sb, tenant["id"])
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
    # 3 impersonations max par admin par tranche de 5 minutes
    check_rate_by_key(admin["sub"], "impersonate", max_calls=3, window_seconds=300)

    sb    = get_supabase_admin()
    owner = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
    if not owner:
        raise HTTPException(404, "Propriétaire introuvable")

    user = await _supabase_user_get(owner[0]["user_id"])
    if not user:
        raise HTTPException(502, "Utilisateur introuvable")

    base = settings.frontend_url_prod or settings.frontend_url
    if base == "http://localhost:3000":
        base = "https://klientys.co"
    redirect = f"{base}/auth/callback"

    async with httpx.AsyncClient() as c:
        r = await c.post(
            f"{settings.supabase_url}/auth/v1/admin/generate_link",
            json={"type": "magiclink", "email": user["email"], "redirect_to": redirect},
            headers={"apikey": settings.supabase_service_role_key, "Authorization": f"Bearer {settings.supabase_service_role_key}"},
            timeout=10,
        )
        if r.status_code != 200:
            raise HTTPException(502, f"Erreur génération lien: {r.text}")
        data = r.json()
        email_otp = data.get("email_otp") or data.get("properties", {}).get("email_otp")
        if not email_otp:
            raise HTTPException(502, "Impossible d'extraire l'OTP Supabase")

    _log(admin, "impersonate", tenant_id, payload={"email": user["email"]})

    # Notification transparente au tenant (non bloquante)
    tenant_row = sb.table("tenant").select("name").eq("id", tenant_id).limit(1).execute().data
    tenant_name = tenant_row[0]["name"] if tenant_row else "votre espace"
    accessed_at = datetime.now(timezone.utc).strftime("%d/%m/%Y à %H:%M UTC")
    try:
        email_svc.send_impersonation_notice(
            tenant_email=user["email"],
            tenant_name=tenant_name,
            admin_email=admin.get("email", ""),
            accessed_at=accessed_at,
        )
    except Exception:
        pass  # non bloquant — l'impersonation continue même si l'email échoue

    return {"email": user["email"], "otp": email_otp}


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
async def sync_stripe(tenant_id: str, admin=Depends(support_or_above)):
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
async def reset_domain(tenant_id: str, admin=Depends(support_or_above)):
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

class SectorCreate(BaseModel):
    key:      str
    keywords: list[str] = []
    label:    Optional[str] = None

@router.post("/sectors")
async def create_sector(body: SectorCreate, admin=Depends(get_current_admin)):
    from app.services.trends import SECTOR_KEYWORDS as DEFAULT_KW
    if not body.key or not body.key.replace("_", "").isalnum():
        raise HTTPException(400, "Clé invalide — uniquement lettres, chiffres, underscores")
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc).isoformat()

    kw_row  = sb.table("system_config").select("value").eq("key", "sector_keywords").limit(1).execute().data
    current = kw_row[0]["value"] if kw_row else {}
    if body.key in DEFAULT_KW and body.key not in current:
        current[body.key] = body.keywords or DEFAULT_KW[body.key]
    else:
        current[body.key] = body.keywords
    sb.table("system_config").upsert({"key": "sector_keywords", "value": current, "updated_at": now}).execute()

    if body.label:
        lbl_row = sb.table("system_config").select("value").eq("key", "sector_labels").limit(1).execute().data
        labels  = lbl_row[0]["value"] if lbl_row else {}
        labels[body.key] = body.label
        sb.table("system_config").upsert({"key": "sector_labels", "value": labels, "updated_at": now}).execute()

    _log(admin, "create_sector", payload={"key": body.key})
    return {"ok": True, "key": body.key}

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


# ─── Comptes support ──────────────────────────────────────────────────────────

VALID_SUPPORT_ROLES = ("viewer", "support")

class SupportAccountIn(BaseModel):
    email: str
    role:  str  # "viewer" | "support"

class SupportRolePatch(BaseModel):
    role: str


def _sb_headers() -> dict:
    return {
        "apikey": settings.supabase_service_role_key,
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
    }


@router.get("/support-accounts")
async def list_support_accounts(admin=Depends(get_current_admin)):
    """Retourne tous les comptes avec un support_role dans app_metadata."""
    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{settings.supabase_url}/auth/v1/admin/users?per_page=1000",
            headers=_sb_headers(),
            timeout=15,
        )
    if r.status_code != 200:
        raise HTTPException(502, "Erreur récupération utilisateurs Supabase")
    users = r.json().get("users", [])
    return [
        {
            "id":              u["id"],
            "email":           u.get("email"),
            "role":            u.get("app_metadata", {}).get("support_role"),
            "created_at":      u.get("created_at"),
            "last_sign_in_at": u.get("last_sign_in_at"),
        }
        for u in users
        if u.get("app_metadata", {}).get("support_role") in VALID_SUPPORT_ROLES
    ]


@router.post("/support-accounts")
async def create_support_account(body: SupportAccountIn, admin=Depends(get_current_admin)):
    if body.role not in VALID_SUPPORT_ROLES:
        raise HTTPException(400, "Rôle invalide — valeurs acceptées : viewer, support")

    async with httpx.AsyncClient() as c:
        # Crée l'utilisateur Supabase avec email confirmé et un mot de passe aléatoire
        r = await c.post(
            f"{settings.supabase_url}/auth/v1/admin/users",
            json={
                "email":         body.email,
                "password":      secrets.token_hex(32),
                "email_confirm": True,
                "app_metadata":  {"support_role": body.role},
            },
            headers=_sb_headers(),
            timeout=10,
        )
        if r.status_code not in (200, 201):
            detail = r.json().get("msg") or r.json().get("message") or r.text
            raise HTTPException(502, f"Erreur création compte : {detail}")
        user_id = r.json()["id"]

        # Génère un lien de définition de mot de passe (type recovery)
        r2 = await c.post(
            f"{settings.supabase_url}/auth/v1/admin/generate_link",
            json={"type": "recovery", "email": body.email},
            headers=_sb_headers(),
            timeout=10,
        )
        setup_link = r2.json().get("action_link", "") if r2.status_code == 200 else ""

    try:
        email_svc.send_support_account_invite(
            email=body.email,
            role=body.role,
            setup_link=setup_link,
        )
    except Exception:
        pass  # non bloquant

    _log(admin, "create_support_account", payload={"email": body.email, "role": body.role})
    return {"id": user_id, "email": body.email, "role": body.role}


@router.patch("/support-accounts/{user_id}")
async def update_support_account(user_id: str, body: SupportRolePatch, admin=Depends(get_current_admin)):
    if body.role not in VALID_SUPPORT_ROLES:
        raise HTTPException(400, "Rôle invalide")
    # Fusionne avec le metadata existant pour ne pas écraser les autres clés (ex: tenant_id)
    user = await _supabase_user_get(user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")
    new_meta = {**(user.get("app_metadata") or {}), "support_role": body.role}
    r = await _supabase_user_patch(user_id, {"app_metadata": new_meta})
    if r.status_code != 200:
        raise HTTPException(502, "Erreur mise à jour Supabase")
    _log(admin, "update_support_account", payload={"user_id": user_id, "role": body.role})
    return {"ok": True}


@router.delete("/support-accounts/{user_id}")
async def delete_support_account(user_id: str, admin=Depends(get_current_admin)):
    user = await _supabase_user_get(user_id)
    if not user:
        raise HTTPException(404, "Utilisateur introuvable")

    current_meta = user.get("app_metadata") or {}
    has_tenant   = bool(current_meta.get("tenant_id"))

    if has_tenant:
        # L'utilisateur est aussi tenant — on retire uniquement support_role
        # en reconstruisant le metadata complet sans cette clé (Supabase ignore les null)
        new_meta = {k: v for k, v in current_meta.items() if k != "support_role"}
        r = await _supabase_user_patch(user_id, {"app_metadata": new_meta})
        if r.status_code != 200:
            raise HTTPException(502, "Erreur révocation Supabase")
    else:
        # Compte purement support → suppression complète du compte Supabase
        async with httpx.AsyncClient() as c:
            r = await c.delete(
                f"{settings.supabase_url}/auth/v1/admin/users/{user_id}",
                headers=_sb_headers(),
                timeout=10,
            )
        if r.status_code not in (200, 204):
            raise HTTPException(502, f"Erreur suppression Supabase : {r.text}")

    _log(admin, "delete_support_account", payload={"user_id": user_id})
    return {"ok": True}


# ─── Tenants inactifs (relances) ─────────────────────────────────────────────

@router.get("/inactive-tenants")
async def get_inactive_tenants(admin=Depends(viewer_or_above), days: int = 30):
    sb  = get_supabase_admin()
    now = datetime.now(timezone.utc)

    # Nettoyage automatique avant de construire la liste
    _auto_unpublish_expired_sites(sb, now)

    cutoff = (now - timedelta(days=days)).isoformat()

    tenants = sb.table("tenant").select("id, name, slug, created_at, suspended_at, trial_extended_until").execute().data or []
    subs    = sb.table("subscription").select("tenant_id, status").in_("status", ["active", "trialing"]).execute().data or []
    sub_map = {s["tenant_id"]: s for s in subs}

    # Seuls les tenants non-suspendus créés il y a plus de `days` jours
    eligible = [t for t in tenants if not t.get("suspended_at") and t["created_at"] < cutoff]
    all_ids  = {t["id"] for t in eligible}

    owners    = sb.table("membership").select("tenant_id, user_id").eq("role", "owner").execute().data or []
    owner_map = {m["tenant_id"]: m["user_id"] for m in owners if m["tenant_id"] in all_ids}

    async with httpx.AsyncClient() as c:
        r = await c.get(
            f"{settings.supabase_url}/auth/v1/admin/users?per_page=1000",
            headers=_sb_headers(), timeout=15,
        )
        users = r.json().get("users", []) if r.status_code == 200 else []
    user_map = {u["id"]: u for u in users}

    site_rows = sb.table("site").select("tenant_id, id, status").execute().data or []
    site_map  = {s["tenant_id"]: s for s in site_rows}

    result = []
    for t in eligible:
        owner_id = owner_map.get(t["id"])
        if not owner_id:
            continue
        user         = user_map.get(owner_id, {})
        last_sign_in = user.get("last_sign_in_at")
        # Actif récemment → skip
        if last_sign_in and last_sign_in > cutoff:
            continue
        site = site_map.get(t["id"])
        result.append({
            "tenant_id":       t["id"],
            "tenant_name":     t["name"],
            "tenant_slug":     t["slug"],
            "owner_email":     user.get("email"),
            "last_sign_in_at": last_sign_in,
            "created_at":      t["created_at"],
            "computed_status": _compute_status(t, sub_map, now),
            "site_published":  site is not None and site.get("status") == "published",
            "site_id":         site["id"] if site else None,
        })

    # Plus longtemps inactif en premier (None = jamais connecté → tout en haut)
    result.sort(key=lambda x: x["last_sign_in_at"] or "0000")
    return result


@router.post("/tenants/{tenant_id}/relance")
async def relance_tenant(tenant_id: str, admin=Depends(support_or_above)):
    sb = get_supabase_admin()
    tenant = sb.table("tenant").select("name, slug").eq("id", tenant_id).single().execute().data
    if not tenant:
        raise HTTPException(404, "Tenant introuvable")

    owner = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
    owner_id = owner[0]["user_id"] if owner else None
    if not owner_id:
        raise HTTPException(400, "Propriétaire introuvable")

    u = await _supabase_user_get(owner_id)
    owner_email = u.get("email") if u else None
    if not owner_email:
        raise HTTPException(400, "Email introuvable")

    email_svc.send_reactivation_relance(
        email=owner_email,
        tenant_name=tenant["name"],
        tenant_slug=tenant["slug"],
        dashboard_url=f"{settings.frontend_url}/dashboard",
        site_url=f"{settings.frontend_url}/{tenant['slug']}",
    )
    _log(admin, "relance", tenant_id, tenant["name"], {"owner_email": owner_email})
    return {"ok": True}


# ─── Design Requests ──────────────────────────────────────────────────────────

@router.get("/design-requests")
async def list_design_requests(
    status: str | None = Query(None),
    admin=Depends(viewer_or_above),
):
    sb = get_supabase_admin()
    q = sb.table("design_request").select("*").order("created_at", desc=True)
    if status:
        q = q.eq("status", status)
    return q.execute().data or []


class DesignRequestUpdate(BaseModel):
    status: str | None = None
    admin_notes: str | None = None


@router.patch("/design-requests/{request_id}")
async def update_design_request(
    request_id: str,
    body: DesignRequestUpdate,
    admin=Depends(support_or_above),
):
    sb = get_supabase_admin()
    patch: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if body.status is not None:
        patch["status"] = body.status
    if body.admin_notes is not None:
        patch["admin_notes"] = body.admin_notes
    res = sb.table("design_request").update(patch).eq("id", request_id).execute()
    if not res.data:
        raise HTTPException(404, "Demande introuvable")
    _log(admin, "design_request_update", payload={"request_id": request_id, **patch})
    return res.data[0]


@router.post("/tenants/{tenant_id}/unpublish-site")
async def unpublish_site(tenant_id: str, admin=Depends(support_or_above)):
    sb = get_supabase_admin()
    tenant = sb.table("tenant").select("name").eq("id", tenant_id).single().execute().data
    if not tenant:
        raise HTTPException(404, "Tenant introuvable")

    site = sb.table("site").select("id").eq("tenant_id", tenant_id).limit(1).execute().data
    if not site:
        raise HTTPException(404, "Site introuvable")

    sb.table("site").update({"status": "draft"}).eq("tenant_id", tenant_id).execute()
    _log(admin, "unpublish_site", tenant_id, tenant["name"])
    return {"ok": True}


# ── Facturation SaaS ───────────────────────────────────────────────────────────

stripe_lib.api_key = settings.stripe_secret_key.strip()


@router.get("/billing")
async def get_billing_overview(admin=Depends(get_current_admin)):
    """Vue d'ensemble de la facturation Klientys : MRR, ARR, past_due, nouveaux, churnés."""
    sb = get_supabase_admin()
    now = datetime.now(timezone.utc)
    thirty_ago = (now - timedelta(days=30)).isoformat()

    # Plans — lookup dict {id: {name, price_eur}}
    plans_raw = sb.table("plan_subscription").select("id, name, price_eur").execute().data or []
    plan_map: dict[str, dict] = {p["id"]: p for p in plans_raw}

    # Toutes les subscriptions (sans FK join — plus compatible)
    # Colonnes réelles : tenant_id, plan_id, stripe_subscription_id, status, start_date, expires_at
    all_subs = sb.table("subscription").select(
        "tenant_id, status, start_date, plan_id, stripe_subscription_id"
    ).execute().data or []

    # Enrichir chaque sub avec les infos du plan
    for s in all_subs:
        s["_plan"] = plan_map.get(s.get("plan_id") or "", {})

    active_subs  = [s for s in all_subs if s["status"] in ("active", "trialing")]
    past_due     = [s for s in all_subs if s["status"] == "past_due"]
    new_subs_30d = [s for s in active_subs if (s.get("start_date") or "") >= thirty_ago]
    churned_30d  = [s for s in all_subs if s["status"] == "canceled" and (s.get("start_date") or "") >= thirty_ago]

    # MRR
    mrr = sum((s["_plan"].get("price_eur") or 0) for s in active_subs)

    # Répartition par plan
    plan_dist: dict[str, dict] = {}
    for s in active_subs:
        name  = s["_plan"].get("name") or "Autre"
        price = s["_plan"].get("price_eur") or 0
        if name not in plan_dist:
            plan_dist[name] = {"name": name, "count": 0, "mrr": 0}
        plan_dist[name]["count"] += 1
        plan_dist[name]["mrr"] = round(plan_dist[name]["mrr"] + price, 2)

    # Tenant names — bulk fetch pour éviter N+1
    all_tenant_ids = list({s["tenant_id"] for s in all_subs if s.get("tenant_id")})
    tenant_name_map: dict[str, str] = {}
    owner_email_map: dict[str, str] = {}
    if all_tenant_ids:
        t_res = sb.table("tenant").select("id, name").in_("id", all_tenant_ids).execute().data or []
        tenant_name_map = {t["id"]: t["name"] for t in t_res}
        # Memberships owners
        m_res = sb.table("membership").select("tenant_id, user_id") \
            .in_("tenant_id", all_tenant_ids).eq("role", "owner").execute().data or []
        for m in m_res:
            try:
                u = sb.auth.admin.get_user_by_id(m["user_id"])
                if u and u.user:
                    owner_email_map[m["tenant_id"]] = u.user.email or ""
            except Exception:
                pass

    def _enrich(items: list) -> list:
        result = []
        for s in items:
            t_id = s.get("tenant_id", "")
            result.append({
                "tenant_id":    t_id,
                "tenant_name":  tenant_name_map.get(t_id, ""),
                "owner_email":  owner_email_map.get(t_id, ""),
                "plan":         s["_plan"].get("name", ""),
                "status":       s.get("status", ""),
                "start_date":   s.get("start_date"),
                "stripe_subscription_id": s.get("stripe_subscription_id"),
            })
        return result

    # ── Stats Stripe temps réel (paiements par statut, 30 derniers jours) ────
    thirty_ago_ts = int((now - timedelta(days=30)).timestamp())
    stripe_stats = {
        "revenue_30d":       0.0,
        "revenue_onetime_30d": 0.0,
        "pending_count":     0,
        "pending_amount":    0.0,
        "paid_30d_count":    0,
        "paid_30d_amount":   0.0,
        "voided_30d":        0,
        "draft_count":       0,
    }
    try:
        recent_inv = stripe_lib.Invoice.list(limit=100, created={"gte": thirty_ago_ts}).data
        recent_sess = stripe_lib.checkout.Session.list(limit=100, created={"gte": thirty_ago_ts}).data
        one_time_sess = [s for s in recent_sess if s.get("mode") == "payment"]

        paid_inv  = [i for i in recent_inv if i["status"] == "paid"]
        paid_sess = [s for s in one_time_sess if s.get("payment_status") == "paid"]
        open_inv  = [i for i in recent_inv if i["status"] == "open"]
        void_inv  = [i for i in recent_inv if i["status"] in ("void", "uncollectible")]
        draft_inv = [i for i in recent_inv if i["status"] == "draft"]
        exp_sess  = [s for s in one_time_sess if s.get("status") == "expired"]

        stripe_stats["revenue_30d"]         = round(sum(i.get("amount_paid", 0) for i in paid_inv) / 100 +
                                                     sum(s.get("amount_total", 0) for s in paid_sess) / 100, 2)
        stripe_stats["revenue_onetime_30d"] = round(sum(s.get("amount_total", 0) for s in paid_sess) / 100, 2)
        stripe_stats["pending_count"]       = len(open_inv)
        stripe_stats["pending_amount"]      = round(sum(i.get("amount_due", 0) for i in open_inv) / 100, 2)
        stripe_stats["paid_30d_count"]      = len(paid_inv) + len(paid_sess)
        stripe_stats["paid_30d_amount"]     = stripe_stats["revenue_30d"]
        stripe_stats["voided_30d"]          = len(void_inv) + len(exp_sess)
        stripe_stats["draft_count"]         = len(draft_inv)
    except stripe_lib.error.StripeError as exc:
        logger.warning("stripe stats failed: %s", exc)

    return {
        "mrr":              mrr,
        "arr":              mrr * 12,
        "active_count":     len(active_subs),
        "past_due_count":   len(past_due),
        "churned_30d":      len(churned_30d),
        "plan_breakdown":   sorted(plan_dist.values(), key=lambda x: -x["mrr"]),
        "past_due_tenants": _enrich(past_due),
        "new_subscribers":  _enrich(new_subs_30d),
        "churned":          _enrich(churned_30d),
        **stripe_stats,
    }


@router.post("/billing/past-due/{tenant_id}/send-reminder")
async def billing_send_reminder(tenant_id: str, admin=Depends(get_current_admin)):
    """Renvoie l'email de paiement échoué au propriétaire du tenant."""
    sb = get_supabase_admin()
    owner = _get_owner_info(sb, tenant_id)
    if not owner.get("email"):
        raise HTTPException(404, "Email propriétaire introuvable")
    try:
        from app.services.email import send_subscription_payment_failed
        send_subscription_payment_failed(
            owner_email=owner["email"],
            owner_name=owner["name"],
            tenant_name=owner["tenant_name"],
            country=owner["country"],
            billing_portal_url=f"{settings.frontend_url}/dashboard/settings?section=abonnement",
        )
    except Exception as exc:
        raise HTTPException(500, f"Erreur envoi email : {exc}")
    _log(admin, "billing_send_reminder", tenant_id, owner.get("tenant_name"))
    return {"ok": True}


@router.post("/billing/payments/{payment_id}/void")
async def void_payment(payment_id: str, admin=Depends(get_current_admin)):
    """Annule (void) une facture Stripe ouverte ou un brouillon."""
    try:
        if payment_id.startswith("in_"):
            inv = stripe_lib.Invoice.retrieve(payment_id)
            if inv["status"] == "draft":
                stripe_lib.Invoice.delete(payment_id)
                action = "deleted"
            else:
                stripe_lib.Invoice.void_invoice(payment_id)
                action = "voided"
        elif payment_id.startswith("cs_"):
            stripe_lib.checkout.Session.expire(payment_id)
            action = "expired"
        else:
            raise HTTPException(400, "ID non reconnu")
    except stripe_lib.error.InvalidRequestError as exc:
        raise HTTPException(400, str(exc.user_message or exc))
    except stripe_lib.error.StripeError as exc:
        raise HTTPException(502, str(exc.user_message or exc))
    _log(admin, "void_payment", payload={"payment_id": payment_id, "action": action})
    return {"ok": True, "action": action}


@router.post("/billing/payments/{payment_id}/mark-paid")
async def mark_payment_paid(payment_id: str, admin=Depends(get_current_admin)):
    """Marque une facture Stripe ouverte comme payée hors-bande (sans débiter la carte)."""
    if not payment_id.startswith("in_"):
        raise HTTPException(400, "Action disponible uniquement sur les factures (in_*)")
    try:
        stripe_lib.Invoice.pay(payment_id, paid_out_of_band=True)
    except stripe_lib.error.InvalidRequestError as exc:
        raise HTTPException(400, str(exc.user_message or exc))
    except stripe_lib.error.StripeError as exc:
        raise HTTPException(502, str(exc.user_message or exc))
    _log(admin, "mark_payment_paid", payload={"payment_id": payment_id})
    return {"ok": True}


@router.post("/billing/payments/{payment_id}/send")
async def send_invoice_to_customer(payment_id: str, admin=Depends(get_current_admin)):
    """Finalise et envoie une facture Stripe draft ou ouverte au client."""
    if not payment_id.startswith("in_"):
        raise HTTPException(400, "Action disponible uniquement sur les factures (in_*)")
    try:
        inv = stripe_lib.Invoice.retrieve(payment_id)
        if inv["status"] == "draft":
            stripe_lib.Invoice.finalize_invoice(payment_id)
        stripe_lib.Invoice.send_invoice(payment_id)
    except stripe_lib.error.InvalidRequestError as exc:
        raise HTTPException(400, str(exc.user_message or exc))
    except stripe_lib.error.StripeError as exc:
        raise HTTPException(502, str(exc.user_message or exc))
    _log(admin, "send_invoice", payload={"payment_id": payment_id})
    return {"ok": True}


_PAYMENT_TYPE_LABELS: dict[str, str] = {
    "subscription":   "Abonnement",
    "domain_purchase":"Achat domaine",
    "custom_domain":  "Addon domaine",
    "logo_request":   "Création logo",
    "design_request": "Design personnalisé",
    "other":          "Paiement ponctuel",
}


def _fmt_ts(ts: int | None, fmt: str = "iso") -> str:
    if not ts:
        return ""
    dt = datetime.fromtimestamp(ts, tz=timezone.utc)
    return dt.isoformat() if fmt == "iso" else dt.strftime("%d/%m/%Y")


@router.get("/billing/payments")
async def list_all_payments(limit: int = 50, admin=Depends(get_current_admin)):
    """Tous les paiements Klientys : abonnements récurrents + achats ponctuels (domaines, logos…)."""
    sb = get_supabase_admin()
    all_payments: list[dict] = []

    # ── 1. Factures d'abonnement (récurrentes via Stripe Invoices) ────────────
    try:
        stripe_invoices = stripe_lib.Invoice.list(limit=min(limit, 100)).data
        sub_ids = list({i["subscription"] for i in stripe_invoices if i.get("subscription")})
        sub_tenant_map: dict[str, dict] = {}
        if sub_ids:
            rows = sb.table("subscription").select("tenant_id, stripe_subscription_id, plan_id") \
                .in_("stripe_subscription_id", sub_ids).execute().data or []
            plan_ids = list({r["plan_id"] for r in rows if r.get("plan_id")})
            plan_name_map: dict[str, str] = {}
            if plan_ids:
                p_rows = sb.table("plan_subscription").select("id, name").in_("id", plan_ids).execute().data or []
                plan_name_map = {p["id"]: p["name"] for p in p_rows}
            t_ids = list({r["tenant_id"] for r in rows if r.get("tenant_id")})
            t_name_map: dict[str, str] = {}
            if t_ids:
                t_rows = sb.table("tenant").select("id, name").in_("id", t_ids).execute().data or []
                t_name_map = {t["id"]: t["name"] for t in t_rows}
            for r in rows:
                sub_tenant_map[r["stripe_subscription_id"]] = {
                    "tenant_id":   r["tenant_id"],
                    "tenant_name": t_name_map.get(r["tenant_id"], ""),
                    "plan":        plan_name_map.get(r.get("plan_id") or "", ""),
                }
        for inv in stripe_invoices:
            info  = sub_tenant_map.get(inv.get("subscription") or "", {})
            plan  = info.get("plan", "")
            amount = (inv.get("amount_paid") or inv.get("amount_due") or 0) / 100
            all_payments.append({
                "id":           inv["id"],
                "type":         "subscription",
                "label":        f"Abonnement {plan}".strip(),
                "number":       inv.get("number") or inv["id"],
                "amount":       amount,
                "currency":     (inv.get("currency") or "eur").upper(),
                "status":       inv.get("status", ""),
                "created_ts":   inv.get("created") or 0,
                "created":      _fmt_ts(inv.get("created")),
                "period_start": _fmt_ts(inv.get("period_start"), "date"),
                "period_end":   _fmt_ts(inv.get("period_end"), "date"),
                "pdf_url":      inv.get("invoice_pdf") or "",
                "customer_email": inv.get("customer_email") or "",
                "tenant_id":    info.get("tenant_id", ""),
                "tenant_name":  info.get("tenant_name", ""),
                "plan":         plan,
            })
    except stripe_lib.error.StripeError as exc:
        logger.warning("stripe invoices fetch failed: %s", exc)

    # ── 2. Achats ponctuels (Stripe Checkout Sessions mode=payment) ───────────
    try:
        sessions = stripe_lib.checkout.Session.list(limit=min(limit, 100)).data
        one_time = [s for s in sessions if s.get("mode") == "payment"]
        meta_tenant_ids = list({
            (s.get("metadata") or {}).get("tenant_id")
            for s in one_time
            if (s.get("metadata") or {}).get("tenant_id")
        })
        t_name_map2: dict[str, str] = {}
        if meta_tenant_ids:
            t_rows2 = sb.table("tenant").select("id, name").in_("id", meta_tenant_ids).execute().data or []
            t_name_map2 = {t["id"]: t["name"] for t in t_rows2}

        for s in one_time:
            meta       = s.get("metadata") or {}
            tenant_id  = meta.get("tenant_id", "")
            raw_type   = meta.get("type") or meta.get("addon_type") or "other"
            domain     = meta.get("domain", "")
            label      = _PAYMENT_TYPE_LABELS.get(raw_type, "Paiement ponctuel")
            if domain:
                label = f"Achat domaine — {domain}"

            pay_status = s.get("payment_status", "")
            session_status = s.get("status", "")
            if pay_status == "paid":
                status = "paid"
            elif session_status == "expired":
                status = "void"
            else:
                status = "open"

            all_payments.append({
                "id":           s["id"],
                "type":         raw_type,
                "label":        label,
                "number":       s["id"][:16],
                "amount":       (s.get("amount_total") or 0) / 100,
                "currency":     (s.get("currency") or "eur").upper(),
                "status":       status,
                "created_ts":   s.get("created") or 0,
                "created":      _fmt_ts(s.get("created")),
                "period_start": "",
                "period_end":   "",
                "pdf_url":      "",
                "customer_email": s.get("customer_email") or "",
                "tenant_id":    tenant_id,
                "tenant_name":  t_name_map2.get(tenant_id, ""),
                "plan":         "",
            })
    except stripe_lib.error.StripeError as exc:
        logger.warning("stripe sessions fetch failed: %s", exc)

    # Tri anti-chronologique
    all_payments.sort(key=lambda x: x.pop("created_ts", 0), reverse=True)
    return all_payments[:limit]


@router.post("/billing/payments/{payment_id}/resend")
async def resend_payment(payment_id: str, admin=Depends(get_current_admin)):
    """Renvoie le reçu de paiement — gère les factures d'abonnement (in_*) et les achats ponctuels (cs_*)."""
    sb   = get_supabase_admin()
    from app.services.email import send_stripe_receipt

    tenant_id    = None
    owner: dict  = {}
    target_email = ""
    plan_name    = ""
    amount       = 0.0
    currency     = "EUR"
    period_start = ""
    period_end   = ""
    inv_number   = payment_id
    pdf_url      = ""
    description  = "Paiement Klientys"

    if payment_id.startswith("in_"):
        # ── Facture d'abonnement Stripe ────────────────────────────────────────
        try:
            inv = stripe_lib.Invoice.retrieve(payment_id)
        except stripe_lib.error.StripeError as exc:
            raise HTTPException(404, f"Facture introuvable : {exc}")

        stripe_sub_id = inv.get("subscription")
        plan_id = None
        if stripe_sub_id:
            row = sb.table("subscription").select("tenant_id, plan_id") \
                .eq("stripe_subscription_id", stripe_sub_id).maybe_single().execute()
            if row.data:
                tenant_id = row.data["tenant_id"]
                plan_id   = row.data.get("plan_id")
        if tenant_id:
            owner = _get_owner_info(sb, tenant_id)
        if plan_id:
            p = sb.table("plan_subscription").select("name").eq("id", plan_id).maybe_single().execute()
            plan_name = (p.data or {}).get("name", "Pro")

        target_email = owner.get("email") or inv.get("customer_email", "")
        amount       = (inv.get("amount_paid") or inv.get("amount_due") or 0) / 100
        currency     = (inv.get("currency") or "eur").upper()
        period_start = _fmt_ts(inv.get("period_start"), "date")
        period_end   = _fmt_ts(inv.get("period_end"), "date")
        inv_number   = inv.get("number") or payment_id
        pdf_url      = inv.get("invoice_pdf") or ""
        description  = f"Abonnement {plan_name}".strip()

    elif payment_id.startswith("cs_"):
        # ── Achat ponctuel (Checkout Session) ─────────────────────────────────
        try:
            session = stripe_lib.checkout.Session.retrieve(payment_id)
        except stripe_lib.error.StripeError as exc:
            raise HTTPException(404, f"Session introuvable : {exc}")

        meta      = session.get("metadata") or {}
        tenant_id = meta.get("tenant_id")
        raw_type  = meta.get("type") or meta.get("addon_type") or "other"
        domain    = meta.get("domain", "")
        if tenant_id:
            owner = _get_owner_info(sb, tenant_id)

        target_email = owner.get("email") or session.get("customer_email", "")
        amount       = (session.get("amount_total") or 0) / 100
        currency     = (session.get("currency") or "eur").upper()
        inv_number   = payment_id[:16]
        description  = _PAYMENT_TYPE_LABELS.get(raw_type, "Paiement ponctuel")
        if domain:
            description = f"Achat de domaine — {domain}"
        plan_name = description

    else:
        raise HTTPException(400, "ID de paiement non reconnu (attendu in_* ou cs_*)")

    if not target_email:
        raise HTTPException(404, "Email destinataire introuvable")

    try:
        send_stripe_receipt(
            owner_email=target_email,
            owner_name=owner.get("name", ""),
            tenant_name=owner.get("tenant_name", ""),
            country=owner.get("country", "BE"),
            plan_name=plan_name or description,
            amount=amount,
            currency=currency,
            period_start=period_start,
            period_end=period_end,
            invoice_number=inv_number,
            pdf_url=pdf_url,
        )
    except Exception as exc:
        raise HTTPException(500, f"Erreur envoi email : {exc}")

    _log(admin, "resend_payment", tenant_id, owner.get("tenant_name"),
         {"payment_id": payment_id, "email": target_email, "description": description})
    return {"ok": True, "sent_to": target_email}


# ─── Campagnes email (vue admin) ─────────────────────────────────────────────

@router.get("/campaigns")
async def admin_list_campaigns(
    admin=Depends(viewer_or_above),
    tenant_id: Optional[str] = None,
    days: int = 30,
    status: Optional[str] = None,
    page: int = 1,
    per_page: int = 50,
):
    """Liste toutes les campagnes email avec métriques, tous tenants confondus."""
    sb = get_supabase_admin()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    try:
        query = (
            sb.table("email_campaign")
            .select("id, tenant_id, name, subject, segment, status, sent_count, failed_count, open_count, click_count, unsubscribed_count, sent_at, created_at")
            .gte("sent_at", cutoff)
            .order("sent_at", desc=True)
        )
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
        if status:
            query = query.eq("status", status)
        rows = query.limit(per_page).offset((page - 1) * per_page).execute().data or []
    except Exception:
        query = (
            sb.table("email_campaign")
            .select("id, tenant_id, name, subject, segment, status, sent_count, failed_count, sent_at, created_at")
            .gte("sent_at", cutoff)
            .order("sent_at", desc=True)
        )
        if tenant_id:
            query = query.eq("tenant_id", tenant_id)
        if status:
            query = query.eq("status", status)
        rows = query.limit(per_page).offset((page - 1) * per_page).execute().data or []

    tenant_ids = list({r["tenant_id"] for r in rows if r.get("tenant_id")})
    tenant_info: dict[str, dict] = {}
    if tenant_ids:
        tenants = (
            sb.table("tenant").select("id, name, slug")
            .in_("id", tenant_ids).execute().data or []
        )
        tenant_info = {t["id"]: {"name": t["name"], "slug": t.get("slug", "")} for t in tenants}

    result = []
    total_sent = total_open = total_click = total_unsub = 0

    for r in rows:
        sent    = r.get("sent_count") or 0
        open_c  = r.get("open_count") or 0
        click_c = r.get("click_count") or 0
        unsub   = r.get("unsubscribed_count") or 0
        t_info  = tenant_info.get(r["tenant_id"]) or {}
        result.append({
            **r,
            "tenant_name": t_info.get("name", ""),
            "tenant_slug": t_info.get("slug", ""),
            "open_rate":   round(open_c / sent * 100) if sent else 0,
            "click_rate":  round(click_c / sent * 100) if sent else 0,
        })
        total_sent  += sent
        total_open  += open_c
        total_click += click_c
        total_unsub += unsub

    return {
        "campaigns": result,
        "stats": {
            "total":              len(rows),
            "total_sent":         total_sent,
            "avg_open_rate":      round(total_open / total_sent * 100) if total_sent else 0,
            "avg_click_rate":     round(total_click / total_sent * 100) if total_sent else 0,
            "total_unsubscribed": total_unsub,
        },
    }


class AdminCampaignSendIn(BaseModel):
    subject:    str
    body:       str
    tenant_ids: list[str]


@router.post("/campaigns/send")
async def admin_send_campaign(body: AdminCampaignSendIn, admin=Depends(get_current_admin)):
    """Envoie un email de campagne Klientys aux propriétaires des tenants sélectionnés."""
    if not body.subject.strip() or not body.body.strip():
        raise HTTPException(400, "Objet et corps requis")
    if not body.tenant_ids:
        raise HTTPException(400, "Aucun tenant sélectionné")

    sb   = get_supabase_admin()
    base = settings.frontend_url_prod or settings.frontend_url
    dashboard_url = f"{base}/dashboard"

    sent = 0; failed = 0; errors: list[str] = []

    for tenant_id in body.tenant_ids:
        try:
            tenant_row = sb.table("tenant").select("name, slug").eq("id", tenant_id).single().execute().data
            if not tenant_row:
                failed += 1; errors.append(f"tenant {tenant_id[:8]}: introuvable"); continue

            owner_m = sb.table("membership").select("user_id").eq("tenant_id", tenant_id).eq("role", "owner").limit(1).execute().data
            if not owner_m:
                failed += 1; errors.append(f"{tenant_row['name']}: owner introuvable"); continue

            user_res = sb.auth.admin.get_user_by_id(owner_m[0]["user_id"])
            email    = user_res.user.email if (user_res and user_res.user) else None
            if not email:
                failed += 1; errors.append(f"{tenant_row['name']}: email introuvable"); continue

            tenant_name = tenant_row["name"]
            personalized = (
                body.body
                .replace("{prenom}",       tenant_name)
                .replace("{nom_business}", tenant_name)
                .replace("{tenant_name}",  tenant_name)
            )
            email_svc.send_admin_campaign_to_tenant(
                email=email,
                tenant_name=tenant_name,
                subject=body.subject,
                body=personalized,
                dashboard_url=dashboard_url,
            )
            sent += 1
        except Exception as exc:
            failed += 1; errors.append(str(exc)[:120])

    _log(admin, "admin_campaign_send", payload={
        "subject": body.subject, "tenant_ids": body.tenant_ids,
        "sent": sent, "failed": failed,
    })
    return {"sent": sent, "failed": failed, "errors": errors[:10]}


# ─── Content Management (blog + témoignages) ─────────────────────────────────

class BlogPostIn(BaseModel):
    slug:            str
    title:           str
    description:     Optional[str] = None
    category:        Optional[str] = None
    metier:          Optional[str] = None
    body_html:       Optional[str] = None
    reading_minutes: int = 5
    status:          str = "draft"
    published_at:    Optional[str] = None


@router.get("/content/blog")
async def admin_list_blog(admin=Depends(viewer_or_above)):
    rows = (
        get_supabase_admin().table("blog_post")
        .select("id, slug, title, category, status, published_at, reading_minutes, updated_at")
        .order("created_at", desc=True)
        .execute().data or []
    )
    return rows


@router.post("/content/blog")
async def admin_create_blog(body: BlogPostIn, admin=Depends(get_current_admin)):
    sb  = get_supabase_admin()
    row = sb.table("blog_post").insert({
        "slug":            body.slug,
        "title":           body.title,
        "description":     body.description,
        "category":        body.category,
        "metier":          body.metier,
        "body_html":       body.body_html,
        "reading_minutes": body.reading_minutes,
        "status":          body.status,
        "published_at":    body.published_at,
    }).execute().data[0]
    _log(admin, "create_blog_post", payload={"slug": body.slug, "title": body.title})
    return row


@router.patch("/content/blog/{post_id}")
async def admin_update_blog(post_id: str, body: BlogPostIn, admin=Depends(get_current_admin)):
    from datetime import datetime as _dt
    sb = get_supabase_admin()
    row = sb.table("blog_post").update({
        "slug":            body.slug,
        "title":           body.title,
        "description":     body.description,
        "category":        body.category,
        "metier":          body.metier,
        "body_html":       body.body_html,
        "reading_minutes": body.reading_minutes,
        "status":          body.status,
        "published_at":    body.published_at,
        "updated_at":      _dt.utcnow().isoformat(),
    }).eq("id", post_id).execute().data
    if not row:
        raise HTTPException(404, "Article introuvable")
    _log(admin, "update_blog_post", payload={"id": post_id, "slug": body.slug})
    return row[0]


@router.delete("/content/blog/{post_id}")
async def admin_delete_blog(post_id: str, admin=Depends(get_current_admin)):
    get_supabase_admin().table("blog_post").delete().eq("id", post_id).execute()
    _log(admin, "delete_blog_post", payload={"id": post_id})
    return {"ok": True}


class TestimonialIn(BaseModel):
    name:       str
    role:       Optional[str] = None
    text:       str
    initials:   Optional[str] = None
    bg_color:   str = "rgba(13,75,88,.4)"
    text_color: str = "var(--l-teal-xl)"
    sort_order: int = 0
    active:     bool = True


@router.get("/content/testimonials")
async def admin_list_testimonials(admin=Depends(viewer_or_above)):
    rows = (
        get_supabase_admin().table("landing_testimonial")
        .select("*")
        .order("sort_order")
        .execute().data or []
    )
    return rows


@router.post("/content/testimonials")
async def admin_create_testimonial(body: TestimonialIn, admin=Depends(get_current_admin)):
    row = get_supabase_admin().table("landing_testimonial").insert(body.model_dump()).execute().data[0]
    _log(admin, "create_testimonial", payload={"name": body.name})
    return row


@router.patch("/content/testimonials/{testi_id}")
async def admin_update_testimonial(testi_id: str, body: TestimonialIn, admin=Depends(get_current_admin)):
    row = get_supabase_admin().table("landing_testimonial").update(body.model_dump()).eq("id", testi_id).execute().data
    if not row:
        raise HTTPException(404, "Témoignage introuvable")
    _log(admin, "update_testimonial", payload={"id": testi_id, "name": body.name})
    return row[0]


@router.delete("/content/testimonials/{testi_id}")
async def admin_delete_testimonial(testi_id: str, admin=Depends(get_current_admin)):
    get_supabase_admin().table("landing_testimonial").delete().eq("id", testi_id).execute()
    _log(admin, "delete_testimonial", payload={"id": testi_id})
    return {"ok": True}


# ── Support interne (admin) ───────────────────────────────────────────────────

class AdminSupportReply(BaseModel):
    body: str


class AdminTicketUpdate(BaseModel):
    status: str  # open | in_progress | resolved | closed


@router.get("/support/tickets")
async def admin_list_support_tickets(
    status: Optional[str] = None,
    admin=Depends(get_current_admin),
):
    """Liste tous les tickets de support de tous les tenants."""
    sb = get_supabase_admin()
    query = (
        sb.table("support_ticket")
        .select("id, tenant_id, subject, status, priority, created_at, updated_at, tenant(name, slug)")
        .order("updated_at", desc=True)
        .limit(200)
    )
    if status:
        query = query.eq("status", status)
    tickets = query.execute().data or []
    return tickets


@router.get("/support/tickets/{ticket_id}")
async def admin_get_support_ticket(ticket_id: str, admin=Depends(get_current_admin)):
    sb = get_supabase_admin()
    ticket = (
        sb.table("support_ticket")
        .select("*, tenant(name, slug)")
        .eq("id", ticket_id)
        .single()
        .execute()
    ).data
    if not ticket:
        raise HTTPException(404, "Ticket introuvable")
    messages = (
        sb.table("support_message")
        .select("id, sender, body, created_at")
        .eq("ticket_id", ticket_id)
        .order("created_at", asc=True)
        .execute()
    ).data or []
    return {**ticket, "messages": messages}


@router.post("/support/tickets/{ticket_id}/reply", status_code=201)
async def admin_reply_ticket(
    ticket_id: str,
    data: AdminSupportReply,
    background_tasks: BackgroundTasks,
    admin=Depends(get_current_admin),
):
    """Réponse de l'équipe Klientys à un ticket tenant."""
    if not data.body.strip():
        raise HTTPException(400, "Message vide")

    sb = get_supabase_admin()
    rows = sb.table("support_ticket").select("id, subject, tenant_id, status").eq("id", ticket_id).limit(1).execute().data or []
    if not rows:
        raise HTTPException(404, "Ticket introuvable")
    ticket = rows[0]

    sb.table("support_message").insert({
        "ticket_id": ticket_id,
        "tenant_id": ticket["tenant_id"],
        "sender":    "admin",
        "body":      data.body.strip(),
    }).execute()

    sb.table("support_ticket").update({
        "status":     "in_progress",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", ticket_id).execute()

    from app.services.email import send_support_reply_to_tenant
    from app.services import push as push_svc

    tenant_rows = sb.table("tenant").select("name, slug").eq("id", ticket["tenant_id"]).limit(1).execute().data or []
    tenant_row = tenant_rows[0] if tenant_rows else {}
    site_res = sb.table("site").select("email_contact").eq("tenant_id", ticket["tenant_id"]).limit(1).execute().data or []
    tenant_email = (site_res[0].get("email_contact") if site_res else None) or ""

    if tenant_email:
        background_tasks.add_task(
            send_support_reply_to_tenant,
            tenant_email=tenant_email,
            tenant_name=tenant_row.get("name", ""),
            ticket_subject=ticket["subject"],
            reply_body=data.body.strip(),
            ticket_id=ticket_id,
        )

    push_url = f"{settings.frontend_url_prod or settings.frontend_url}/dashboard/settings?section=support"
    background_tasks.add_task(
        push_svc.send_push_to_tenant,
        sb, ticket["tenant_id"],
        "Réponse de Klientys 💬",
        f"L'équipe Klientys a répondu à votre ticket : {ticket['subject'][:60]}",
        push_url,
    )

    _log(admin, "support_reply", tenant_id=ticket["tenant_id"], payload={"ticket_id": ticket_id})
    return {"success": True}


@router.patch("/support/tickets/{ticket_id}")
async def admin_update_ticket(
    ticket_id: str,
    data: AdminTicketUpdate,
    admin=Depends(get_current_admin),
):
    """Modifier le statut d'un ticket (open / in_progress / resolved / closed)."""
    valid_statuses = {"open", "in_progress", "resolved", "closed"}
    if data.status not in valid_statuses:
        raise HTTPException(400, f"Statut invalide. Valeurs acceptées : {valid_statuses}")

    sb = get_supabase_admin()
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()
    update_data: dict = {"status": data.status, "updated_at": now}
    if data.status in ("resolved", "closed"):
        update_data["resolved_at"] = now

    row = sb.table("support_ticket").update(update_data).eq("id", ticket_id).execute().data
    if not row:
        raise HTTPException(404, "Ticket introuvable")

    _log(admin, "update_support_ticket", payload={"ticket_id": ticket_id, "status": data.status})
    return row[0]
