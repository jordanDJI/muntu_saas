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


@router.delete("/{field_key}", status_code=204)
async def delete_contact_field(
    field_key: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    res = (
        sb.table("contact_field_def").select("field_key")
        .eq("tenant_id", tenant_id).eq("field_key", field_key)
        .maybe_single().execute()
    )
    field = res.data if res else None
    if not field:
        raise HTTPException(404, "Champ introuvable")
    if field_key in LOCKED_FIELD_KEYS:
        raise HTTPException(400, "Ce champ est indispensable au fonctionnement du CRM et ne peut pas être supprimé.")
    sb.table("contact_field_def").delete().eq("tenant_id", tenant_id).eq("field_key", field_key).execute()
