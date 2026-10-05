"""
Champs de fiche contact configurables par tenant.
first_name/last_name/email/phone (LOCKED_FIELD_KEYS) sont indispensables au CRM (réservation
publique, relances, Telegram/WhatsApp, RGPD) : jamais désactivables, jamais supprimables.
Tous les autres champs — de base (is_base=true, prédéfinis par Klientys) ou custom (créés par
le tenant) — sont désactivables ET supprimables ; is_base ne sert plus qu'à l'affichage
("de base" dans l'UI), pas à restreindre la suppression.
"""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant

router = APIRouter(prefix="/contact-fields", tags=["Contact Fields"])

FIELD_TYPES = {"text", "phone", "email", "date", "number", "select"}
LOCKED_FIELD_KEYS = {"first_name", "last_name", "email", "phone"}

# (field_key, label, field_type, storage_mode, options)
DEFAULT_BASE_FIELDS: list[tuple] = [
    ("first_name", "Prénom", "text", "column", None),
    ("last_name", "Nom", "text", "column", None),
    ("email", "Email", "email", "column", None),
    ("phone", "Téléphone", "phone", "column", None),
    ("category", "Catégorie", "select", "column", ["client", "prospect", "partenaire", "fournisseur", "autre"]),
    ("segment", "Segment", "text", "column", None),
    ("first_name_2", "2ᵉ prénom", "text", "jsonb", None),
    ("first_name_3", "3ᵉ prénom", "text", "jsonb", None),
    ("gender", "Genre", "select", "jsonb", ["Femme", "Homme", "Autre"]),
    ("title", "Titre", "text", "jsonb", None),
    ("nickname", "Surnom", "text", "jsonb", None),
    ("country_residence", "Pays de résidence", "text", "jsonb", None),
    ("country_origin", "Pays d'origine", "text", "jsonb", None),
    ("birthday_day", "Jour de naissance", "number", "jsonb", None),
    ("birthday_month", "Mois de naissance", "number", "jsonb", None),
    ("street_number", "N° de rue", "text", "jsonb", None),
    ("street", "Rue", "text", "jsonb", None),
    ("city", "Ville", "text", "jsonb", None),
    ("postal_code", "Code postal", "text", "jsonb", None),
    ("region", "Région", "text", "jsonb", None),
    ("phone_pro", "Téléphone professionnel", "phone", "jsonb", None),
    ("phone_perso", "Téléphone personnel", "phone", "jsonb", None),
    ("phone_preferred", "Téléphone préféré", "select", "jsonb", ["pro", "perso"]),
    ("email_pro", "Email professionnel", "email", "jsonb", None),
    ("email_perso", "Email personnel", "email", "jsonb", None),
    ("website", "Site internet", "text", "jsonb", None),
    ("linkedin", "LinkedIn", "text", "jsonb", None),
    ("instagram", "Instagram", "text", "jsonb", None),
    ("facebook", "Facebook", "text", "jsonb", None),
]


def ensure_default_fields(sb, tenant_id: str) -> list[dict]:
    """Seed paresseux : crée le catalogue de champs de base au premier accès du tenant."""
    existing = (
        sb.table("contact_field_def").select("*").eq("tenant_id", tenant_id).order("position").execute()
    ).data or []
    if existing:
        return existing

    rows = [
        {
            "tenant_id": tenant_id, "field_key": key, "label": label, "field_type": ftype,
            "storage_mode": storage, "is_base": True, "enabled": True, "required": False,
            "position": i, "options": options,
        }
        for i, (key, label, ftype, storage, options) in enumerate(DEFAULT_BASE_FIELDS)
    ]
    sb.table("contact_field_def").insert(rows).execute()
    return (
        sb.table("contact_field_def").select("*").eq("tenant_id", tenant_id).order("position").execute()
    ).data or []


@router.get("/")
async def list_contact_fields(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    return ensure_default_fields(sb, tenant_id)


# ── Données portées par les champs ────────────────────────────────────────────

def _contacts_for_usage(sb, tenant_id: str, field_defs: list[dict]) -> list[dict]:
    """Contacts vivants du tenant, avec les colonnes utiles au comptage."""
    col_keys = [f["field_key"] for f in field_defs if f["storage_mode"] == "column"]
    select = ", ".join(sorted(set(col_keys + ["custom_fields"])))
    return (
        sb.table("contact").select(select)
        .eq("tenant_id", tenant_id).is_("deleted_at", "null").execute()
    ).data or []


def field_usage(sb, tenant_id: str, field_defs: list[dict]) -> tuple[dict, dict]:
    """
    Renvoie (usage, orphelins) :
      usage      {field_key: nb de contacts portant une valeur} pour les champs déclarés
      orphelins  {clé: nb} pour les valeurs présentes dans custom_fields sans définition

    Les orphelins viennent des suppressions de champs, qui ne nettoyaient pas
    `contact.custom_fields` : la donnée restait en base, invisible, et ressortait
    malgré tout dans l'export RGPD.
    """
    declared = {f["field_key"] for f in field_defs}
    usage: dict[str, int] = {}
    orphans: dict[str, int] = {}

    for c in _contacts_for_usage(sb, tenant_id, field_defs):
        custom = c.get("custom_fields") or {}
        for key, value in custom.items():
            if value in (None, "", [], {}):
                continue
            target = usage if key in declared else orphans
            target[key] = target.get(key, 0) + 1
        for f in field_defs:
            if f["storage_mode"] != "column":
                continue
            if c.get(f["field_key"]) not in (None, ""):
                usage[f["field_key"]] = usage.get(f["field_key"], 0) + 1

    return usage, orphans


@router.get("/usage")
async def get_fields_usage(tenant_id: str = Depends(get_current_tenant)):
    """
    Nombre de contacts portant une valeur, par champ, plus les valeurs orphelines.

    Volontairement séparé de `GET /` : ce calcul parcourt tous les contacts du
    tenant et n'a pas sa place dans le chargement d'une fiche. Il n'est appelé
    que depuis l'écran de configuration des champs.
    """
    sb = get_supabase_admin()
    field_defs = ensure_default_fields(sb, tenant_id)
    usage, orphans = field_usage(sb, tenant_id, field_defs)
    return {
        "usage": usage,
        "orphans": [{"field_key": k, "count": n} for k, n in sorted(orphans.items())],
    }


class ContactFieldCreateIn(BaseModel):
    label: str
    field_type: str
    options: Optional[list[str]] = None
    required: bool = False


@router.post("/")
async def create_contact_field(
    body: ContactFieldCreateIn,
    tenant_id: str = Depends(get_current_tenant),
):
    if body.field_type not in FIELD_TYPES:
        raise HTTPException(400, f"Type invalide (attendu : {', '.join(sorted(FIELD_TYPES))})")
    if not body.label.strip():
        raise HTTPException(400, "Le libellé est obligatoire")

    sb = get_supabase_admin()
    existing = ensure_default_fields(sb, tenant_id)
    max_position = max((f["position"] for f in existing), default=-1)

    row = {
        "tenant_id": tenant_id,
        "field_key": f"cf_{uuid.uuid4().hex[:8]}",
        "label": body.label.strip(),
        "field_type": body.field_type,
        "storage_mode": "jsonb",
        "is_base": False,
        "enabled": True,
        "required": body.required,
        "position": max_position + 1,
        "options": (body.options or []) if body.field_type == "select" else None,
    }
    return sb.table("contact_field_def").insert(row).execute().data[0]


class ContactFieldUpdateIn(BaseModel):
    label: Optional[str] = None
    enabled: Optional[bool] = None
    required: Optional[bool] = None
    position: Optional[int] = None
    options: Optional[list[str]] = None


@router.patch("/{field_key}")
async def update_contact_field(
    field_key: str,
    body: ContactFieldUpdateIn,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    res = (
        sb.table("contact_field_def").select("*")
        .eq("tenant_id", tenant_id).eq("field_key", field_key)
        .maybe_single().execute()
    )
    field = res.data if res else None
    if not field:
        raise HTTPException(404, "Champ introuvable")

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Aucun champ à mettre à jour")

    if field_key in LOCKED_FIELD_KEYS and updates.get("enabled") is False:
        raise HTTPException(400, f"Le champ « {field['label']} » ne peut pas être désactivé.")

    sb.table("contact_field_def").update(updates).eq("tenant_id", tenant_id).eq("field_key", field_key).execute()
    return {**field, **updates}


def _purge_field_values(sb, tenant_id: str, field: dict) -> int:
    """Efface les valeurs d'un champ sur tous les contacts du tenant. Renvoie le nombre touché."""
    key = field["field_key"]

    if field["storage_mode"] == "column":
        sb.table("contact").update({key: None}).eq("tenant_id", tenant_id) \
            .not_.is_(key, "null").execute()
        return 0  # PostgREST ne renvoie pas de compte fiable ici

    rows = (
        sb.table("contact").select("id, custom_fields")
        .eq("tenant_id", tenant_id).is_("deleted_at", "null").execute()
    ).data or []
    touched = 0
    for c in rows:
        custom = c.get("custom_fields") or {}
        if key not in custom:
            continue
        custom.pop(key, None)
        sb.table("contact").update({"custom_fields": custom}).eq("id", c["id"]).execute()
        touched += 1
    return touched


@router.delete("/{field_key}", status_code=200)
async def delete_contact_field(
    field_key: str,
    purge: bool = False,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Supprime un champ de la fiche contact.

    Si des contacts portent une valeur pour ce champ, renvoie **409** avec leur
    nombre : l'appelant doit confirmer en rappelant avec `?purge=true`. La
    suppression efface alors aussi les valeurs.

    Auparavant la suppression ne touchait que la définition : les valeurs
    restaient en base, invisibles dans l'application mais toujours présentes
    dans l'export RGPD, et prêtes à ressurgir si la clé était recréée.
    """
    sb = get_supabase_admin()
    res = (
        sb.table("contact_field_def").select("*")
        .eq("tenant_id", tenant_id).eq("field_key", field_key)
        .maybe_single().execute()
    )
    field = res.data if res else None
    if not field:
        raise HTTPException(404, "Champ introuvable")
    if field_key in LOCKED_FIELD_KEYS:
        raise HTTPException(400, "Ce champ est indispensable au fonctionnement du CRM et ne peut pas être supprimé.")

    field_defs = ensure_default_fields(sb, tenant_id)
    usage, _ = field_usage(sb, tenant_id, field_defs)
    count = usage.get(field_key, 0)

    if count and not purge:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "field_has_data",
                "count": count,
                "message": (
                    f"« {field['label']} » est renseigné sur {count} contact(s). "
                    "Confirmez pour supprimer le champ et ses valeurs."
                ),
            },
        )

    purged = _purge_field_values(sb, tenant_id, field) if count else 0
    sb.table("contact_field_def").delete().eq("tenant_id", tenant_id).eq("field_key", field_key).execute()
    return {"deleted": True, "purged": purged or count}


@router.delete("/orphans/{field_key}", status_code=200)
async def purge_orphan_values(
    field_key: str,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Efface les valeurs d'une clé orpheline — une donnée restée en base après la
    suppression de son champ.

    Refuse si la clé correspond à un champ existant : on passe alors par
    `DELETE /{field_key}?purge=true`, qui retire aussi la définition.
    """
    sb = get_supabase_admin()
    field_defs = ensure_default_fields(sb, tenant_id)

    if any(f["field_key"] == field_key for f in field_defs):
        raise HTTPException(400, "Cette clé correspond à un champ existant — supprimez le champ.")

    _, orphans = field_usage(sb, tenant_id, field_defs)
    if field_key not in orphans:
        raise HTTPException(404, "Aucune valeur orpheline sous cette clé.")

    purged = _purge_field_values(
        sb, tenant_id, {"field_key": field_key, "storage_mode": "jsonb"}
    )
    return {"purged": purged}


class ReattachIn(BaseModel):
    field_key: str
    label: str
    field_type: str = "text"
    options: Optional[list[str]] = None


@router.post("/reattach")
async def reattach_contact_field(
    body: ReattachIn,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Recrée une définition de champ sur une clé **orpheline**, ce qui fait
    réapparaître les valeurs déjà présentes en base.

    C'est la seule façon de récupérer les données d'un champ supprimé : une
    création normale génère une clé aléatoire (`cf_<8 hex>`) et ne peut donc
    jamais retomber sur l'ancienne.
    """
    if body.field_type not in FIELD_TYPES:
        raise HTTPException(400, f"Type invalide (attendu : {', '.join(sorted(FIELD_TYPES))})")
    if not body.label.strip():
        raise HTTPException(400, "Le libellé est obligatoire")

    sb = get_supabase_admin()
    field_defs = ensure_default_fields(sb, tenant_id)

    if any(f["field_key"] == body.field_key for f in field_defs):
        raise HTTPException(400, "Ce champ existe déjà.")

    _, orphans = field_usage(sb, tenant_id, field_defs)
    if body.field_key not in orphans:
        raise HTTPException(
            404,
            "Aucune valeur orpheline sous cette clé. Utilisez la création de champ classique.",
        )

    max_position = max((f["position"] for f in field_defs), default=-1)
    row = {
        "tenant_id": tenant_id,
        "field_key": body.field_key,
        "label": body.label.strip(),
        "field_type": body.field_type,
        "storage_mode": "jsonb",
        "is_base": False,
        "enabled": True,
        "required": False,
        "position": max_position + 1,
        "options": (body.options or []) if body.field_type == "select" else None,
    }
    created = sb.table("contact_field_def").insert(row).execute().data[0]
    return {**created, "recovered": orphans[body.field_key]}
