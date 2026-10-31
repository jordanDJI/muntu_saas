"""
Intégrations des widgets Klientys sur des supports externes (migration 080).

Règles pures en tête de fichier — testées sans base (tests/test_integrations.py) —
puis les accès Supabase.
"""
import logging
import re
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import urlparse

from fastapi import HTTPException

from app.core.urls import allowed_origins

logger = logging.getLogger(__name__)

KINDS = ("website", "iframe", "link")
_KEY_RE = re.compile(r"^int_[0-9a-f]{12}$")

# Écrire last_seen_at à chaque chargement de widget ferait une écriture par
# visiteur et par page : on ne rafraîchit qu'au-delà de ce délai.
SEEN_REFRESH = timedelta(minutes=10)

# Hôtes de Klientys lui-même : un widget affiché ici (aperçu du dashboard,
# dev local) n'est pas une intégration et ne doit rien créer.
_KLIENTYS_HOSTS = {"klientys.co", "localhost"}
_KLIENTYS_SUFFIXES = (".vercel.app",)

CHATBOT_REQUIREMENTS = ("title", "description", "service", "contact")


# ── Règles pures ──────────────────────────────────────────────────────────────

def generate_key() -> str:
    return f"int_{secrets.token_hex(6)}"


def is_valid_key(value: str | None) -> bool:
    return bool(value) and bool(_KEY_RE.match(value))


def normalize_host(value: str | None) -> str | None:
    """Hôte comparable : minuscules, sans schéma, chemin, port ni « www. ».

    `www.muntucura.be` et `muntucura.be` sont le même site pour le visiteur :
    sans ce retrait, un conflit avec le domaine personnalisé passerait
    inaperçu. Un vrai sous-domaine (`blog.muntucura.be`) reste distinct.
    """
    if not value or not isinstance(value, str):
        return None
    raw = value.strip().lower()
    if not raw:
        return None
    if "://" not in raw:
        raw = f"http://{raw}"
    try:
        host = urlparse(raw).hostname
    except ValueError:
        return None
    if not host:
        return None
    host = host.rstrip(".")
    if host.startswith("www."):
        host = host[4:]
    if not re.match(r"^[a-z0-9.-]+$", host) or ".." in host:
        return None
    return host or None


def _klientys_hosts() -> set[str]:
    hosts = set(_KLIENTYS_HOSTS)
    for origin in allowed_origins():
        h = normalize_host(origin)
        if h:
            hosts.add(h)
    return hosts


def is_klientys_host(host: str | None, klientys_hosts: set[str] | None = None) -> bool:
    if not host:
        return False
    hosts = klientys_hosts if klientys_hosts is not None else _klientys_hosts()
    return host in hosts or host.endswith(_KLIENTYS_SUFFIXES)


def same_site(a: str | None, b: str | None) -> bool:
    """Deux domaines désignent-ils le même site (au `www.` près) ?"""
    na, nb = normalize_host(a), normalize_host(b)
    return bool(na) and na == nb


def chatbot_missing(site: dict | None) -> list[str]:
    """Éléments du site dont le chatbot a besoin pour répondre et qui manquent.

    Le chatbot ne dépend plus de la publication du site Klientys, mais il
    s'appuie sur son contenu : sans prestation ni contact, il n'a rien à dire.
    """
    if not site:
        return list(CHATBOT_REQUIREMENTS)
    missing = []
    if not (site.get("title") or "").strip():
        missing.append("title")
    if not (site.get("description") or "").strip():
        missing.append("description")
    offers = site.get("service_offer") or []
    if not any((o.get("name") or "").strip() for o in offers):
        missing.append("service")
    if not ((site.get("phone") or "").strip() or (site.get("email_contact") or "").strip()):
        missing.append("contact")
    return missing


def should_refresh_seen(last_seen_at: str | None, now: datetime) -> bool:
    if not last_seen_at:
        return True
    try:
        seen = datetime.fromisoformat(last_seen_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    if seen.tzinfo is None:
        seen = seen.replace(tzinfo=timezone.utc)
    return now - seen >= SEEN_REFRESH


# ── Accès base ────────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _record_seen(sb, integration: dict, host: str | None) -> None:
    now = _now()
    if should_refresh_seen(integration.get("last_seen_at"), now):
        sb.table("site_integration").update({"last_seen_at": now.isoformat()}).eq("id", integration["id"]).execute()
    if host:
        sb.table("site_integration_domain").upsert(
            {"integration_id": integration["id"], "domain": host, "last_seen_at": now.isoformat()},
            on_conflict="integration_id,domain",
        ).execute()


def _integrations_seen_on(sb, tenant_id: str, host: str) -> list[dict]:
    """Intégrations du tenant vues sur `host` (hôte déjà normalisé).

    Deux requêtes plutôt qu'une jointure `!inner` : avec supabase-py, celle-ci
    peut renvoyer un résultat vide sans erreur (cf. CLAUDE.md, annuaire).
    """
    ids = [
        r["integration_id"] for r in (
            sb.table("site_integration_domain").select("integration_id").eq("domain", host).execute().data or []
        )
    ]
    if not ids:
        return []
    return (
        sb.table("site_integration").select("*")
        .in_("id", ids).eq("tenant_id", tenant_id).order("created_at").execute().data
    ) or []


def resolve_for_widget(sb, tenant_id: str, key: str | None, raw_host: str | None) -> dict:
    """Appelé au chargement de chaque widget.

    Renvoie `{"integration": row | None, "active": bool}`. Un ancien code sans
    identifiant (intégrations antérieures à la migration 080) est rattaché à
    l'intégration déjà vue sur son domaine, ou en crée une nommée d'après lui.
    """
    host = normalize_host(raw_host)
    if is_klientys_host(host):
        host = None

    if is_valid_key(key):
        rows = (
            sb.table("site_integration").select("*")
            .eq("key", key).eq("tenant_id", tenant_id).limit(1).execute().data
        )
        if rows:
            integ = rows[0]
            if integ["status"] != "active":
                return {"integration": integ, "active": False}
            _record_seen(sb, integ, host)
            return {"integration": integ, "active": True}
        # Clé inconnue (recopiée d'un autre tenant, mal collée) : le widget
        # fonctionne, mais rien n'est attribué.
        return {"integration": None, "active": True}

    if not host:
        return {"integration": None, "active": True}

    candidates = [i for i in _integrations_seen_on(sb, tenant_id, host) if i["kind"] == "website"]
    if candidates:
        # Une intégration active sur ce domaine prime sur une désactivée
        integ = next((c for c in candidates if c["status"] == "active"), candidates[0])
        if integ["status"] != "active":
            return {"integration": integ, "active": False}
        _record_seen(sb, integ, host)
        return {"integration": integ, "active": True}

    # ignore_duplicates : si un autre widget de la même page vient de la créer,
    # l'insertion est sans effet et on relit celle qui existe.
    sb.table("site_integration").upsert({
        "tenant_id": tenant_id,
        "key": generate_key(),
        "name": host,
        "kind": "website",
        "auto_created": True,
        "auto_domain": host,
        "last_seen_at": _now().isoformat(),
    }, on_conflict="tenant_id,auto_domain", ignore_duplicates=True).execute()
    integ = (
        sb.table("site_integration").select("*")
        .eq("tenant_id", tenant_id).eq("auto_domain", host).limit(1).execute().data
    )[0]
    if integ["status"] != "active":
        return {"integration": integ, "active": False}
    _record_seen(sb, {**integ, "last_seen_at": None}, host)
    return {"integration": integ, "active": True}


def integration_for_submission(sb, tenant_id: str, key: str | None) -> str | None:
    """id de l'intégration à attribuer à un lead / RDV, ou None.

    Lève 403 si l'intégration est désactivée : masquer le widget ne suffit
    pas, un formulaire déjà ouvert ou un appel direct doit aussi être refusé.
    """
    if not is_valid_key(key):
        return None
    rows = (
        sb.table("site_integration").select("id, status")
        .eq("key", key).eq("tenant_id", tenant_id).limit(1).execute().data
    )
    if not rows:
        return None
    if rows[0]["status"] != "active":
        raise HTTPException(status_code=403, detail="Ce service n'est plus disponible sur ce site.")
    return rows[0]["id"]


def active_conflicts(sb, tenant_id: str, domain: str) -> list[dict]:
    """Intégrations actives du tenant vues sur `domain` (au `www.` près)."""
    host = normalize_host(domain)
    if not host:
        return []
    return [
        {"id": i["id"], "name": i["name"]}
        for i in _integrations_seen_on(sb, tenant_id, host) if i["status"] == "active"
    ]


def disable_for_domain(sb, tenant_id: str, domain: str) -> list[dict]:
    """Désactive les intégrations vues sur un domaine passé sur Klientys."""
    conflicts = active_conflicts(sb, tenant_id, domain)
    if conflicts:
        sb.table("site_integration").update({
            "status": "disabled",
            "disabled_reason": "custom_domain",
            "disabled_at": _now().isoformat(),
        }).in_("id", [c["id"] for c in conflicts]).execute()
    return conflicts


def tenants_with_active_integration(sb, tenant_ids: list[str] | None = None) -> set[str]:
    """Appelée par les pages publiques (site, sitemap) : une erreur ici ne doit
    jamais faire tomber tous les sites — notamment si la migration 080 n'est
    pas encore appliquée. En cas d'échec, on indexe comme avant."""
    q = sb.table("site_integration").select("tenant_id").eq("status", "active")
    if tenant_ids is not None:
        if not tenant_ids:
            return set()
        q = q.in_("tenant_id", tenant_ids)
    try:
        return {r["tenant_id"] for r in (q.execute().data or [])}
    except Exception as exc:
        logger.error("site_integration illisible (migration 080 appliquée ?) : %s", exc)
        return set()


def should_noindex(has_active_integration: bool, has_active_custom_domain: bool) -> bool:
    """Le site Klientys publié ne doit pas concurrencer dans Google le site du
    client tant que celui-ci porte les widgets. Avec un domaine personnalisé
    actif, le site Klientys EST le site du client : indexation normale."""
    return has_active_integration and not has_active_custom_domain


def list_with_stats(sb, tenant_id: str) -> list[dict]:
    integrations = (
        sb.table("site_integration").select("*")
        .eq("tenant_id", tenant_id).order("created_at").execute().data
    ) or []
    if not integrations:
        return []
    ids = [i["id"] for i in integrations]

    domains = sb.table("site_integration_domain").select("*").in_("integration_id", ids).execute().data or []
    leads = sb.table("lead").select("integration_id").in_("integration_id", ids).execute().data or []
    appts = sb.table("appointment").select("integration_id").in_("integration_id", ids).execute().data or []

    def count(rows: list[dict], iid: str) -> int:
        return sum(1 for r in rows if r.get("integration_id") == iid)

    out = []
    for integ in integrations:
        out.append({
            **integ,
            "domains": sorted(
                [{"domain": d["domain"], "last_seen_at": d["last_seen_at"]} for d in domains if d["integration_id"] == integ["id"]],
                key=lambda d: d["last_seen_at"] or "", reverse=True,
            ),
            "leads_count": count(leads, integ["id"]),
            "appointments_count": count(appts, integ["id"]),
        })
    return out
