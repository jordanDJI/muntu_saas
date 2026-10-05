"""
CRM — Contacts enrichis
Couvre : liste contacts, fiche unifiée, notes, valeur client, inactivité, import/export CSV et Excel.
Tags et reminders sont dans tags.py et reminders.py (routeurs séparés, même préfixe /contacts).
"""
import csv
import io
import logging
import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Optional

import openpyxl
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel, field_validator

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant, get_current_user
from app.api.v1.attachments import PHOTO_BUCKET, _signed_url_bucket
from app.api.v1.contact_fields import ensure_default_fields
from app.services.activity import log_activity
from app.services.phone import clean_phone, is_valid_phone, validate_phone_field
from app.services.contact_limits import get_contact_quota

router = APIRouter(prefix="/contacts", tags=["Contacts"])
logger = logging.getLogger(__name__)

INACTIVE_DAYS = 180  # 6 mois sans RDV confirmé → inactif
EMAIL_RE = re.compile(r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$')


# ── Schémas ──────────────────────────────────────────────────────────────────

class ContactUpdate(BaseModel):
    notes: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    category: Optional[str] = None
    segment: Optional[str] = None
    custom_fields: Optional[dict] = None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: Optional[str]) -> Optional[str]:
        return validate_phone_field(v)


class ActivityCreate(BaseModel):
    type: str = "note"
    content: str


# ── Champs dynamiques — colonnes CSV/Excel et validation construites depuis contact_field_def ──

# Alias FR tolérants pour les champs de base, en plus du field_key et du label exacts.
BASE_FIELD_ALIASES = {
    "prenom": "first_name", "prénom": "first_name",
    "nom": "last_name",
    "telephone": "phone", "téléphone": "phone",
    "tel_pro": "phone_pro", "telephone_pro": "phone_pro", "téléphone_pro": "phone_pro",
    "tel_perso": "phone_perso", "telephone_perso": "phone_perso", "téléphone_perso": "phone_perso",
    "categorie": "category", "catégorie": "category",
    "pays_residence": "country_residence", "pays_de_residence": "country_residence",
    "pays_origine": "country_origin", "pays_d_origine": "country_origin",
    "jour_naissance": "birthday_day", "mois_naissance": "birthday_month",
    "numero_rue": "street_number", "n_rue": "street_number",
    "rue": "street", "ville": "city", "code_postal": "postal_code",
    "site_internet": "website", "site_web": "website",
}

EXAMPLE_BY_TYPE = {
    "text": "Exemple", "phone": "+32470123456", "email": "exemple@mail.com",
    "date": "2026-01-15", "number": "1",
}


def _enabled_fields(field_defs: list[dict]) -> list[dict]:
    return sorted((f for f in field_defs if f["enabled"]), key=lambda f: f["position"])


def _csv_header(field_defs: list[dict]) -> list[str]:
    return [f["label"] for f in _enabled_fields(field_defs)] + ["Notes"]


def _contact_to_csv_row(c: dict, field_defs: list[dict]) -> list:
    custom = c.get("custom_fields") or {}
    row = []
    for f in _enabled_fields(field_defs):
        val = c.get(f["field_key"]) if f["storage_mode"] == "column" else custom.get(f["field_key"])
        row.append(val if val is not None else "")
    row.append(c.get("notes") or "")
    return row


def _normalize_header(s: str) -> str:
    """Insensible aux accents, à la casse et à tout séparateur (espace/underscore/tiret/apostrophe…)
    pour que 'First Name', 'first_name' et 'Prénom' puissent tous matcher la même clé."""
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]", "", s.lower())


def _build_field_lookup(field_defs: list[dict]) -> dict[str, str]:
    """Normalise un en-tête CSV/Excel vers un field_key : label, field_key, ou alias FR connu (tous normalisés)."""
    lookup: dict[str, str] = {_normalize_header("notes"): "notes"}
    for f in field_defs:
        lookup[_normalize_header(f["field_key"])] = f["field_key"]
        lookup[_normalize_header(f["label"])] = f["field_key"]
    for alias, key in BASE_FIELD_ALIASES.items():
        lookup.setdefault(_normalize_header(alias), key)
    return lookup


def _csv_row_to_contact_fields(row: dict, field_defs: list[dict]) -> dict:
    """row : dict CSV normalisé (clés en minuscules, sans espaces). Retourne les champs prêts pour l'insert contact."""
    lookup = _build_field_lookup(field_defs)
    defs_by_key = {f["field_key"]: f for f in field_defs}

    normalized: dict[str, str] = {}
    for key, value in row.items():
        canonical = lookup.get(_normalize_header(key or ""))
        if canonical and value:
            normalized[canonical] = value

    # Téléphones (tout champ de type 'phone', de base ou custom) : on tolère les séparateurs
    # courants dans le CSV et on les nettoie ; si des lettres subsistent, on abandonne juste ce
    # champ plutôt que de bloquer tout l'import.
    for key, field in defs_by_key.items():
        if field["field_type"] == "phone" and key in normalized:
            cleaned = clean_phone(normalized[key])
            normalized[key] = cleaned if is_valid_phone(cleaned) else ""
        if field["field_type"] == "email" and key in normalized:
            if not EMAIL_RE.match(normalized[key].strip().lower()):
                normalized[key] = ""

    category_field = defs_by_key.get("category")
    category = (normalized.get("category") or "").strip().lower()
    allowed_categories = [o.lower() for o in ((category_field or {}).get("options") or [])]
    if category not in allowed_categories:
        category = None

    custom_fields = {
        f["field_key"]: normalized[f["field_key"]]
        for f in field_defs
        if f["storage_mode"] == "jsonb" and normalized.get(f["field_key"])
    }

    return {
        "first_name": normalized.get("first_name") or None,
        "last_name": normalized.get("last_name") or None,
        "email": (normalized.get("email") or "").lower() or None,
        "phone": normalized.get("phone") or None,
        "notes": normalized.get("notes") or None,
        "category": category,
        "segment": normalized.get("segment") or None,
        # Jamais None : contact.custom_fields est NOT NULL DEFAULT '{}', et une
        # valeur par défaut ne s'applique que si la clé est ABSENTE de l'insert.
        # Envoyer null faisait échouer toute la requête — donc tout l'import —
        # dès qu'une ligne n'avait aucune valeur de champ JSONB.
        "custom_fields": custom_fields,
    }


def _rows_to_xlsx_bytes(header: list[str], rows: list[list]) -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Contacts"
    ws.append(header)
    for row in rows:
        ws.append(row)
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def _read_xlsx_rows(content: bytes) -> list[dict]:
    """Lit la première feuille d'un fichier Excel — 1ère ligne = en-têtes, retourne des dicts normalisés (clés en minuscules)."""
    wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True, data_only=True)
    ws = wb.worksheets[0]
    rows_iter = ws.iter_rows(values_only=True)

    try:
        header = [str(h).strip().lower() if h is not None else "" for h in next(rows_iter)]
    except StopIteration:
        return []

    rows = []
    for raw_row in rows_iter:
        row = {}
        for key, value in zip(header, raw_row):
            if not key or value is None:
                continue
            row[key] = str(value).strip()
        if row:
            rows.append(row)
    return rows


# ── Helpers ───────────────────────────────────────────────────────────────────

def _enrich_contacts(sb, tenant_id: str, contacts: list[dict]) -> list[dict]:
    """Ajoute tags, valeur client et statut inactivité à chaque contact."""
    if not contacts:
        return []

    contact_ids = [c["id"] for c in contacts]

    # Tags
    tag_links = (
        sb.table("contact_tag_link")
        .select("contact_id, contact_tag(id, name, color)")
        .in_("contact_id", contact_ids)
        .execute()
    ).data or []
    tags_by_contact: dict[str, list] = {}
    for link in tag_links:
        cid = link["contact_id"]
        tag = link.get("contact_tag") or {}
        if tag:
            tags_by_contact.setdefault(cid, []).append(tag)

    # Derniers RDV confirmés + valeur (prix prestation si dispo)
    # appointment n'a pas de tenant_id — sécurité assurée par le filtre contact_id (contacts déjà filtrés par tenant)
    appts = (
        sb.table("appointment")
        .select("contact_id, scheduled_at, service_offer(price_eur)")
        .eq("status", "confirmed")
        .in_("contact_id", contact_ids)
        .order("scheduled_at", desc=True)
        .execute()
    ).data or []

    last_appt: dict[str, str] = {}
    value_by_contact: dict[str, float] = {}
    for a in appts:
        cid = a["contact_id"]
        if cid not in last_appt:
            last_appt[cid] = a["scheduled_at"]
        price = (a.get("service_offer") or {}).get("price_eur") or 0
        value_by_contact[cid] = value_by_contact.get(cid, 0) + float(price)

    cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVE_DAYS)).isoformat()

    for c in contacts:
        cid = c["id"]
        c["tags"] = tags_by_contact.get(cid, [])
        c["client_value"] = round(value_by_contact.get(cid, 0), 2)
        last = last_appt.get(cid)
        c["last_appointment_at"] = last
        c["is_inactive"] = (last is None or last < cutoff)
        c["is_incomplete"] = not c.get("email") and not c.get("phone")

    return contacts


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/export")
async def export_contacts_csv(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    tenant_id: str = Depends(get_current_tenant),
):
    """Exporte tous les contacts du tenant en CSV ou Excel (téléchargement)."""
    sb = get_supabase_admin()
    field_defs = ensure_default_fields(sb, tenant_id)

    contacts = (
        sb.table("contact")
        .select("first_name, last_name, email, phone, category, segment, custom_fields, notes, source, created_at")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    ).data or []

    header = _csv_header(field_defs) + ["Source", "Date de création"]
    rows = [_contact_to_csv_row(c, field_defs) + [c.get("source") or "", (c.get("created_at") or "")[:10]] for c in contacts]

    if format == "xlsx":
        return Response(
            content=_rows_to_xlsx_bytes(header, rows),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=contacts.xlsx"},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"},
    )


@router.get("/import-template")
async def download_import_template(
    format: str = Query(default="csv", pattern="^(csv|xlsx)$"),
    tenant_id: str = Depends(get_current_tenant),
):
    """Modèle vide (avec une ligne d'exemple) à remplir pour l'import — colonnes = champs actuellement activés pour ce tenant."""
    sb = get_supabase_admin()
    field_defs = ensure_default_fields(sb, tenant_id)
    enabled = _enabled_fields(field_defs)

    header = _csv_header(field_defs)
    example = []
    for f in enabled:
        if f["field_key"] == "category":
            example.append((f.get("options") or ["client"])[0])
        elif f["field_type"] == "select":
            example.append((f.get("options") or [""])[0])
        else:
            example.append(EXAMPLE_BY_TYPE.get(f["field_type"], "Exemple"))
    example.append("Cliente fidèle")  # notes

    if format == "xlsx":
        return Response(
            content=_rows_to_xlsx_bytes(header, [example]),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=modele_contacts.xlsx"},
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(header)
    writer.writerow(example)

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=modele_contacts.csv"},
    )


@router.get("/")
async def list_contacts(
    q: Optional[str] = None,
    tag_id: Optional[str] = None,
    inactive_only: bool = False,
    incomplete_only: bool = False,
    category: Optional[str] = None,
    segment: Optional[str] = None,
    limit: int = Query(default=30, le=100),
    offset: int = 0,
    tenant_id: str = Depends(get_current_tenant),
):
    """Liste paginée des contacts avec enrichissement (tags, valeur, inactivité)."""
    sb = get_supabase_admin()

    query = (
        sb.table("contact")
        .select("id, first_name, last_name, email, phone, contact_type, category, segment, created_at")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if q:
        query = query.or_(
            f"first_name.ilike.%{q}%,last_name.ilike.%{q}%,email.ilike.%{q}%,phone.ilike.%{q}%"
        )
    if category:
        query = query.eq("category", category)
    if segment:
        query = query.eq("segment", segment)

    contacts = (query.execute()).data or []

    # Filtre tag côté applicatif (supabase-py ne supporte pas le join avec filtre many-to-many facilement)
    if tag_id:
        linked = {
            row["contact_id"]
            for row in (
                sb.table("contact_tag_link")
                .select("contact_id")
                .eq("tag_id", tag_id)
                .execute()
            ).data or []
        }
        contacts = [c for c in contacts if c["id"] in linked]

    contacts = _enrich_contacts(sb, tenant_id, contacts)

    if inactive_only:
        contacts = [c for c in contacts if c["is_inactive"]]

    if incomplete_only:
        contacts = [c for c in contacts if c["is_incomplete"]]

    # Compte total (approximate — pour la pagination)
    count_q = (
        sb.table("contact")
        .select("id", count="exact")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
    )
    if q:
        count_q = count_q.or_(
            f"first_name.ilike.%{q}%,last_name.ilike.%{q}%,email.ilike.%{q}%,phone.ilike.%{q}%"
        )
    if category:
        count_q = count_q.eq("category", category)
    if segment:
        count_q = count_q.eq("segment", segment)
    total = (count_q.execute()).count or 0

    return {"contacts": contacts, "total": total, "offset": offset, "limit": limit}


@router.get("/duplicates")
async def get_duplicate_contacts(
    tenant_id: str = Depends(get_current_tenant),
):
    """Groupes de contacts probablement en doublon (même email ou même téléphone), à valider manuellement."""
    sb = get_supabase_admin()
    contacts = (
        sb.table("contact")
        .select("id, first_name, last_name, email, phone, category, created_at")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .order("created_at")
        .execute()
    ).data or []

    ignored = {
        (row["match_type"], row["match_value"])
        for row in (sb.table("contact_duplicate_ignore").select("match_type, match_value").eq("tenant_id", tenant_id).execute()).data or []
    }

    by_email: dict[str, list[dict]] = {}
    by_phone: dict[str, list[dict]] = {}
    for c in contacts:
        email_key = (c.get("email") or "").strip().lower()
        if email_key:
            by_email.setdefault(email_key, []).append(c)
        phone_key = clean_phone(c.get("phone"))
        if phone_key:
            by_phone.setdefault(phone_key, []).append(c)

    groups = []
    seen_ids: set[str] = set()
    for match_type, buckets in (("email", by_email), ("phone", by_phone)):
        for match_value, group in buckets.items():
            if len(group) < 2 or (match_type, match_value) in ignored:
                continue
            key = tuple(sorted(c["id"] for c in group))
            if key in seen_ids:
                continue
            seen_ids.add(key)
            groups.append({"match_type": match_type, "match_value": match_value, "contacts": group})

    return groups


class IgnoreDuplicateIn(BaseModel):
    match_type: str
    match_value: str


@router.post("/duplicates/ignore", status_code=204)
async def ignore_duplicate_group(
    body: IgnoreDuplicateIn,
    tenant_id: str = Depends(get_current_tenant),
):
    """Marque un groupe de doublons comme non pertinent — il ne sera plus proposé."""
    sb = get_supabase_admin()
    sb.table("contact_duplicate_ignore").upsert(
        {"tenant_id": tenant_id, "match_type": body.match_type, "match_value": body.match_value},
        on_conflict="tenant_id,match_type,match_value",
    ).execute()


@router.get("/archive-suggestions")
async def get_archive_suggestions(
    tenant_id: str = Depends(get_current_tenant),
):
    """Contacts incomplets (ni email ni téléphone) et inactifs depuis longtemps — à archiver manuellement, jamais automatiquement."""
    sb = get_supabase_admin()
    cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVE_DAYS)).isoformat()
    rows = (
        sb.table("contact")
        .select("id, first_name, last_name, email, phone, last_interaction_at, created_at")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .is_("anonymized_at", "null")
        .lt("last_interaction_at", cutoff)
        .execute()
    ).data or []
    # Filtré en Python (pas en SQL) car email/phone peuvent être "" (chaîne vide) plutôt que NULL selon le point d'entrée.
    return [c for c in rows if not c.get("email") and not c.get("phone")]


@router.post("/{contact_id}/archive", status_code=204)
async def archive_contact(
    contact_id: str,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    """Archive manuellement un contact (soft-delete) — jamais déclenché automatiquement."""
    sb = get_supabase_admin()
    res = (
        sb.table("contact")
        .update({"deleted_at": datetime.now(timezone.utc).isoformat()})
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Contact introuvable")
    log_activity(tenant_id, user["sub"], "Contact archivé", None, target_type="contact", target_id=contact_id)


class MergeContactsIn(BaseModel):
    merge_id: str


_MERGE_RELATED_TABLES = [
    "lead", "appointment", "contact_activity", "contact_reminder", "contact_consent", "invoice",
]


@router.post("/{keep_id}/merge")
async def merge_contacts(
    keep_id: str,
    body: MergeContactsIn,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    """Fusionne merge_id dans keep_id : réaffecte toutes les relations, complète les champs vides, archive merge_id."""
    sb = get_supabase_admin()
    if keep_id == body.merge_id:
        raise HTTPException(400, "Impossible de fusionner un contact avec lui-même")

    keep_res = sb.table("contact").select("*").eq("id", keep_id).eq("tenant_id", tenant_id).maybe_single().execute()
    keep = keep_res.data if keep_res else None
    merge_res = sb.table("contact").select("*").eq("id", body.merge_id).eq("tenant_id", tenant_id).maybe_single().execute()
    merge = merge_res.data if merge_res else None
    if not keep or not merge:
        raise HTTPException(404, "Contact introuvable")

    # Complète les champs vides de keep avec ceux de merge (keep garde toujours la priorité)
    updates: dict = {}
    for field in ("first_name", "last_name", "email", "phone", "category", "segment"):
        if not keep.get(field) and merge.get(field):
            updates[field] = merge[field]
    if merge.get("notes"):
        updates["notes"] = (f"{keep.get('notes')}\n{merge['notes']}" if keep.get("notes") else merge["notes"])
    merged_details = {**(merge.get("custom_fields") or {}), **(keep.get("custom_fields") or {})}
    if merged_details:
        updates["custom_fields"] = merged_details
    if updates:
        sb.table("contact").update(updates).eq("id", keep_id).eq("tenant_id", tenant_id).execute()

    for table in _MERGE_RELATED_TABLES:
        try:
            sb.table(table).update({"contact_id": keep_id}).eq("contact_id", body.merge_id).execute()
        except Exception:
            continue  # table absente de cet environnement (ex. invoice) — on continue

    # Tags : clé primaire (contact_id, tag_id) → ne reporter que les tags que keep_id n'a pas déjà
    keep_tag_ids = {
        row["tag_id"] for row in
        (sb.table("contact_tag_link").select("tag_id").eq("contact_id", keep_id).execute()).data or []
    }
    merge_tag_links = (
        sb.table("contact_tag_link").select("tag_id").eq("contact_id", body.merge_id).execute()
    ).data or []
    new_tag_ids = [row["tag_id"] for row in merge_tag_links if row["tag_id"] not in keep_tag_ids]
    if new_tag_ids:
        sb.table("contact_tag_link").insert(
            [{"contact_id": keep_id, "tag_id": tag_id} for tag_id in new_tag_ids]
        ).execute()
    sb.table("contact_tag_link").delete().eq("contact_id", body.merge_id).execute()

    sb.table("contact").update(
        {"deleted_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", body.merge_id).eq("tenant_id", tenant_id).execute()

    log_activity(
        tenant_id, user["sub"], "Contacts fusionnés",
        f"{merge.get('first_name') or ''} {merge.get('last_name') or ''} fusionné dans ce contact",
        target_type="contact", target_id=keep_id,
    )

    return {"status": "merged", "kept_id": keep_id}


@router.get("/{contact_id}")
async def get_contact(
    contact_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    """Fiche contact unifiée : infos + tags + leads + RDV + conversations + valeur + reminders."""
    sb = get_supabase_admin()

    res = (
        sb.table("contact")
        .select("*")
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Contact introuvable")
    contact = res.data

    photo_path = (contact.get("custom_fields") or {}).get("photo_path")
    contact["photo_signed_url"] = _signed_url_bucket(sb, PHOTO_BUCKET, photo_path) if photo_path else None

    # Tags
    tag_links = (
        sb.table("contact_tag_link")
        .select("contact_tag(id, name, color)")
        .eq("contact_id", contact_id)
        .execute()
    ).data or []
    contact["tags"] = [l["contact_tag"] for l in tag_links if l.get("contact_tag")]

    # Leads
    leads = (
        sb.table("lead")
        .select("id, status, source, request_type, notes, internal_note, created_at, updated_at")
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    contact["leads"] = leads

    # RDV
    appointments = (
        sb.table("appointment")
        .select("id, status, scheduled_at, end_at, notes, service_offer(name, price_eur)")
        .eq("contact_id", contact_id)
        .order("scheduled_at", desc=True)
        .execute()
    ).data or []
    contact["appointments"] = appointments

    # Valeur totale (somme des prix des RDV confirmés)
    confirmed_prices = [
        float((a.get("service_offer") or {}).get("price_eur") or 0)
        for a in appointments
        if a["status"] == "confirmed"
    ]
    contact["client_value"] = round(sum(confirmed_prices), 2)
    contact["appointments_count"] = len([a for a in appointments if a["status"] == "confirmed"])

    # Inactivité
    confirmed_dates = [
        a["scheduled_at"] for a in appointments if a["status"] == "confirmed"
    ]
    last = max(confirmed_dates) if confirmed_dates else None
    contact["last_appointment_at"] = last
    cutoff = (datetime.now(timezone.utc) - timedelta(days=INACTIVE_DAYS)).isoformat()
    contact["is_inactive"] = (last is None or last < cutoff)
    contact["is_incomplete"] = not contact.get("email") and not contact.get("phone")

    # Conversations agent IA (5 dernières)
    convs = (
        sb.table("conversation")
        .select("id, agent_type, channel, started_at")
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .order("started_at", desc=True)
        .limit(5)
        .execute()
    ).data or []
    contact["conversations"] = convs

    # Relances
    reminders = (
        sb.table("contact_reminder")
        .select("id, due_date, note, done, reminder_type, auto_send, sent_at, created_at")
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .order("due_date")
        .execute()
    ).data or []
    contact["reminders"] = reminders

    return contact


@router.patch("/{contact_id}")
async def update_contact(
    contact_id: str,
    body: ContactUpdate,
    tenant_id: str = Depends(get_current_tenant),
    user: dict = Depends(get_current_user),
):
    """Met à jour les champs éditables d'un contact."""
    sb = get_supabase_admin()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Aucun champ à mettre à jour")

    field_defs = ensure_default_fields(sb, tenant_id)
    defs_by_key = {f["field_key"]: f for f in field_defs}

    if "category" in updates:
        allowed = [o.lower() for o in ((defs_by_key.get("category") or {}).get("options") or [])]
        if updates["category"].lower() not in allowed:
            raise HTTPException(400, f"Catégorie invalide (attendu : {', '.join(sorted(allowed))})")

    if "custom_fields" in updates:
        for key, value in list(updates["custom_fields"].items()):
            field = defs_by_key.get(key)
            if not field or not value:
                continue
            if field["field_type"] == "phone":
                cleaned = clean_phone(value)
                if not is_valid_phone(cleaned):
                    raise HTTPException(400, f"« {field['label']} » ne doit contenir que des chiffres et éventuellement un + au début.")
                updates["custom_fields"][key] = cleaned
            elif field["field_type"] == "email" and not EMAIL_RE.match(value.strip().lower()):
                raise HTTPException(400, f"« {field['label']} » doit être une adresse email valide.")

    current_res = (
        sb.table("contact")
        .select("first_name, last_name, email, phone, category, segment, custom_fields")
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .maybe_single()
        .execute()
    )
    current = current_res.data if current_res else None
    if not current:
        raise HTTPException(404, "Contact introuvable")

    if "custom_fields" in updates:
        updates["custom_fields"] = {**(current.get("custom_fields") or {}), **updates["custom_fields"]}

    changes = [
        f"{field} : « {current.get(field) or ''} » → « {new_value or ''} »"
        for field, new_value in updates.items()
        if field != "custom_fields" and str(current.get(field) or "") != str(new_value or "")
    ]
    if "custom_fields" in updates and updates["custom_fields"] != (current.get("custom_fields") or {}):
        changes.append("informations complémentaires mises à jour")

    res = (
        sb.table("contact")
        .update(updates)
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Contact introuvable")

    if changes:
        log_activity(
            tenant_id, user["sub"], "Contact modifié", "; ".join(changes),
            target_type="contact", target_id=contact_id,
        )

    return res.data[0]


@router.get("/{contact_id}/audit-log")
async def get_contact_audit_log(
    contact_id: str,
    limit: int = Query(default=50, le=200),
    tenant_id: str = Depends(get_current_tenant),
):
    """Journal des modifications apportées à la fiche (qui/quoi/quand)."""
    sb = get_supabase_admin()
    rows = (
        sb.table("activity_log")
        .select("id, action, detail, user_id, created_at")
        .eq("tenant_id", tenant_id)
        .eq("target_type", "contact")
        .eq("target_id", contact_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    ).data or []
    return rows


@router.get("/{contact_id}/activities")
async def list_activities(
    contact_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    rows = (
        sb.table("contact_activity")
        .select("*")
        .eq("contact_id", contact_id)
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .execute()
    ).data or []
    return rows


@router.post("/{contact_id}/activities")
async def create_activity(
    contact_id: str,
    body: ActivityCreate,
    tenant_id: str = Depends(get_current_tenant),
):
    if not body.content.strip():
        raise HTTPException(400, "Le contenu ne peut pas être vide")
    if body.type not in ("note", "call", "email", "meeting"):
        raise HTTPException(400, "Type invalide")
    sb = get_supabase_admin()
    row = (
        sb.table("contact_activity")
        .insert({"tenant_id": tenant_id, "contact_id": contact_id,
                 "type": body.type, "content": body.content.strip()})
        .execute()
    ).data[0]
    return row


@router.delete("/{contact_id}/activities/{activity_id}", status_code=204)
async def delete_activity(
    contact_id: str,
    activity_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    sb.table("contact_activity").delete().eq("id", activity_id).eq("tenant_id", tenant_id).execute()


IMPORT_MODES = ("complete", "overwrite")

# Champs stockés en colonne que l'import peut écrire (les 4 verrouillés + les 2 de base).
# `notes` est traité à part : c'est du texte libre, pas un champ de fiche.
_IMPORT_COLUMN_KEYS = ("first_name", "last_name", "email", "phone", "category", "segment", "notes")

# Plafond du détail conservé dans contact_import_job.changes — un import de
# 5 000 lignes ne doit pas produire une ligne de base ingérable.
_MAX_CHANGES = 300


def _is_blank(v) -> bool:
    return v in (None, "", [], {})


def _plan_enrichment(contact: dict, fields: dict, mode: str, field_defs: list[dict]) -> tuple[dict, list]:
    """
    Calcule la mise à jour d'un contact existant à partir d'une ligne de fichier.

    Renvoie (updates, changements). Deux règles tiennent tout :
      - une cellule vide n'écrase jamais rien (vide = « information absente ») ;
      - en mode `complete`, on ne remplit que ce qui est vide en base.
    """
    updates: dict = {}
    changes: list[dict] = []
    overwrite = mode == "overwrite"

    def consider(key: str, old, new, container: str):
        if _is_blank(new) or old == new:
            return
        if not _is_blank(old) and not overwrite:
            return
        changes.append({"field": key, "from": old, "to": new, "where": container})
        return True

    for key in _IMPORT_COLUMN_KEYS:
        if consider(key, contact.get(key), fields.get(key), "column"):
            updates[key] = fields[key]

    jsonb_keys = [f["field_key"] for f in field_defs if f["storage_mode"] == "jsonb"]
    incoming_custom = fields.get("custom_fields") or {}
    current_custom = dict(contact.get("custom_fields") or {})
    custom_changed = False
    for key in jsonb_keys:
        if consider(key, current_custom.get(key), incoming_custom.get(key), "custom_fields"):
            current_custom[key] = incoming_custom[key]
            custom_changed = True
    if custom_changed:
        updates["custom_fields"] = current_custom

    return updates, changes


def _match_existing(fields: dict, by_email: dict, by_phone: dict) -> list:
    """
    Rapproche une ligne d'un contact existant.

    L'email, quand il est présent, est la **seule** clé : un email inconnu
    signifie « nouvelle personne », même si le téléphone est déjà connu.
    Sans cette règle, deux personnes d'un même foyer partageant un numéro mais
    ayant des emails distincts fusionnaient en un seul contact.

    Le téléphone ne sert de clé que pour les lignes sans email.

    Renvoie la liste des candidats. Deux candidats ou plus signifie ambiguïté :
    on préfère signaler la ligne plutôt que de choisir au hasard.
    """
    email = (fields.get("email") or "").lower()
    if email:
        return by_email.get(email, [])

    phone = clean_phone(fields.get("phone") or "")
    if phone:
        return by_phone.get(phone, [])
    return []


_BATCH_SIZE = 500


def _bulk_update_contacts(sb, tenant_id: str, contacts: list[dict], columns: set[str]) -> int:
    """
    Écrit les enrichissements en upserts groupés. Renvoie le nombre de contacts écrits.

    Deux précautions non évidentes :

    - **Le jeu de colonnes est uniforme sur tout le lot.** PostgREST construit une
      seule requête : une clé absente d'une ligne serait interprétée comme NULL et
      effacerait la valeur. Les colonnes non modifiées pour un contact donné sont
      donc renvoyées avec leur valeur courante, qu'on a déjà en mémoire.
    - **`tenant_id` et `custom_fields` sont toujours inclus.** L'upsert passe par un
      `INSERT ... ON CONFLICT`, et l'insertion doit produire une ligne valide : ces
      deux colonnes sont NOT NULL.

    En cas de refus du lot, on reprend contact par contact : un enrichissement
    fautif ne doit pas annuler les autres.
    """
    if not contacts:
        return 0

    cols = sorted(columns | {"custom_fields"})
    now = datetime.now(timezone.utc).isoformat()
    written = 0

    def payload_for(c: dict) -> dict:
        row = {"id": c["id"], "tenant_id": tenant_id, "updated_at": now}
        for col in cols:
            value = c.get(col)
            row[col] = ({} if value is None else value) if col == "custom_fields" else value
        return row

    for i in range(0, len(contacts), _BATCH_SIZE):
        chunk = contacts[i:i + _BATCH_SIZE]
        try:
            sb.table("contact").upsert([payload_for(c) for c in chunk], on_conflict="id").execute()
            written += len(chunk)
            continue
        except Exception as exc:
            logger.warning("Upsert groupé refusé (%d contacts), reprise une à une : %s", len(chunk), exc)

        for c in chunk:
            try:
                row = payload_for(c)
                row.pop("id", None)
                row.pop("tenant_id", None)
                sb.table("contact").update(row).eq("id", c["id"]).execute()
                written += 1
            except Exception as exc:
                logger.warning("Enrichissement contact %s échoué : %s", c.get("id"), exc)

    return written


def _insert_contacts(sb, rows: list[dict]) -> tuple[int, list[str]]:
    """
    Insère les nouveaux contacts. Renvoie (nb inséré, erreurs des lignes refusées).

    L'insertion se fait d'abord en une requête, pour la rapidité. En cas d'échec,
    on reprend ligne par ligne : une seule ligne refusée par la base ne doit pas
    faire perdre tout l'import, ce qui était le cas avec l'insert global.
    """
    try:
        sb.table("contact").insert(rows).execute()
        return len(rows), []
    except Exception as exc:
        logger.warning("Insert groupé refusé (%d lignes), reprise ligne par ligne : %s", len(rows), exc)

    inserted, errors = 0, []
    for row in rows:
        try:
            sb.table("contact").insert(row).execute()
            inserted += 1
        except Exception as exc:
            errors.append(str(exc)[:300])
    return inserted, errors


async def _run_import_job(job_id: str, tenant_id: str, filename: str, content: bytes,
                          mode: str = "complete") -> None:
    """
    Traitement réel de l'import — en arrière-plan, continue si le tenant quitte la page.

    Trois issues par ligne : insertion d'un nouveau contact, enrichissement d'un
    contact existant, ou signalement. Le rapprochement se fait sur l'email puis
    sur le téléphone — l'ancienne version ne regardait que l'email, ce qui
    réinsérait un doublon à chaque import pour les lignes sans email.
    """
    sb = get_supabase_admin()
    try:
        if filename.endswith(".xlsx"):
            try:
                rows = _read_xlsx_rows(content)
            except Exception as e:
                raise ValueError(f"Fichier Excel illisible : {e}")
        else:
            try:
                text = content.decode("utf-8-sig")  # gère le BOM Excel
            except UnicodeDecodeError:
                text = content.decode("latin-1")
            reader = csv.DictReader(io.StringIO(text))
            rows = [{k.strip().lower(): v.strip() for k, v in row.items() if v is not None} for row in reader]

        field_defs = ensure_default_fields(sb, tenant_id)

        existing = (
            sb.table("contact")
            .select("id, first_name, last_name, email, phone, category, segment, notes, custom_fields")
            .eq("tenant_id", tenant_id).is_("deleted_at", "null").execute()
        ).data or []

        by_email: dict[str, list] = {}
        by_phone: dict[str, list] = {}
        for c in existing:
            if c.get("email"):
                by_email.setdefault(c["email"].lower(), []).append(c)
            if c.get("phone"):
                cleaned = clean_phone(c["phone"])
                if cleaned:
                    by_phone.setdefault(cleaned, []).append(c)

        created = enriched = skipped = ambiguous = 0
        to_insert: list[dict] = []
        # Indexé par id : deux lignes du fichier peuvent viser le même contact
        # (doublon dans le fichier). Postgres refuse un ON CONFLICT qui touche
        # deux fois la même ligne dans un seul INSERT, et les enrichissements
        # successifs sont de toute façon cumulés dans le même dict en mémoire.
        to_update: dict[str, dict] = {}
        touched_columns: set[str] = set()
        activities: list[dict] = []
        change_log: list[dict] = []

        for row in rows:
            fields = _csv_row_to_contact_fields(row, field_defs)

            if not any(fields.get(k) for k in ("first_name", "last_name", "email", "phone")):
                skipped += 1
                continue

            candidates = _match_existing(fields, by_email, by_phone)

            if len(candidates) > 1:
                ambiguous += 1
                continue

            if candidates:
                contact = candidates[0]
                updates, changes = _plan_enrichment(contact, fields, mode, field_defs)
                if not updates:
                    skipped += 1
                    continue
                # Appliqué en mémoire d'abord : les lignes suivantes du même
                # fichier doivent voir l'état déjà enrichi. L'écriture est
                # groupée après la boucle — une requête par contact coûtait
                # 3 000 allers-retours sur un fichier de 5 000 lignes.
                contact.update(updates)
                to_update[contact["id"]] = contact
                touched_columns.update(updates.keys())

                name = f"{contact.get('first_name') or ''} {contact.get('last_name') or ''}".strip()
                if len(change_log) < _MAX_CHANGES:
                    change_log.append({
                        "contact_id": contact["id"],
                        "name": name or contact.get("email") or "",
                        "fields": changes[:12],
                    })

                # Trace dans la chronologie du contact : écraser est destructif.
                activities.append({
                    "tenant_id": tenant_id,
                    "contact_id": contact["id"],
                    "type": "note",
                    "content": f"Import « {filename} » — champs mis à jour : "
                               + ", ".join(c["field"] for c in changes[:8]),
                })
                continue

            to_insert.append({"tenant_id": tenant_id, "source": "csv_import", **fields})
            if fields.get("email"):
                by_email.setdefault(fields["email"].lower(), []).append({"id": None})
            cleaned_new = clean_phone(fields.get("phone") or "")
            if cleaned_new:
                by_phone.setdefault(cleaned_new, []).append({"id": None})

        notice = None
        quota = await get_contact_quota(tenant_id)
        if not quota["unlimited"] and len(to_insert) > quota["room"]:
            room = quota["room"]
            quota_skipped = len(to_insert) - room
            to_insert = to_insert[:room]
            skipped += quota_skipped
            notice = (
                f"Limite de votre plan atteinte : {len(to_insert)} contact(s) importé(s) sur "
                f"{len(to_insert) + quota_skipped} demandé(s). Passez à un plan supérieur pour importer le reste."
            )

        if to_insert:
            created, rejected = _insert_contacts(sb, to_insert)
            if rejected:
                skipped += len(rejected)
                if not notice:
                    notice = (
                        f"{len(rejected)} ligne(s) refusée(s) par la base et ignorée(s). "
                        f"Première erreur : {rejected[0]}"
                    )

        if to_update:
            rows_to_update = list(to_update.values())
            enriched = _bulk_update_contacts(sb, tenant_id, rows_to_update, touched_columns)
            skipped += len(rows_to_update) - enriched

        # Les traces ne conditionnent pas le succès de l'import : si elles
        # échouent, l'enrichissement reste acquis.
        for i in range(0, len(activities), _BATCH_SIZE):
            try:
                sb.table("contact_activity").insert(activities[i:i + _BATCH_SIZE]).execute()
            except Exception as exc:
                logger.warning("Traces d'import non enregistrées : %s", exc)

        if ambiguous and not notice:
            notice = (
                f"{ambiguous} ligne(s) correspondent à plusieurs contacts existants et n'ont pas "
                "été traitées. Fusionnez les doublons concernés, puis réimportez."
            )

        sb.table("contact_import_job").update({
            "status": "done",
            "mode": mode,
            "created_count": created,
            "enriched_count": enriched,
            "skipped_count": skipped,
            "ambiguous_count": ambiguous,
            "changes": change_log or None,
            "notice": notice,
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()
    except Exception as e:
        sb.table("contact_import_job").update({
            "status": "error",
            "error_message": str(e),
            "finished_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", job_id).execute()


@router.post("/import")
async def import_contacts_csv(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mode: str = Query("complete", description="complete | overwrite"),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Importe des contacts depuis un fichier CSV ou Excel (.xlsx), traité en arrière-plan
    (continue même si le tenant quitte la page). Suivre la progression via GET /contacts/import/{job_id}.

    Colonnes acceptées (insensible à la casse, aux accents et aux séparateurs) : le libellé ou
    la clé de n'importe quel champ configuré pour ce tenant (voir GET /contact-fields), plus
    quelques alias FR. Au moins un identifiant (nom, prénom, email ou téléphone) par ligne.

    Une ligne est rapprochée d'un contact existant par **email**, à défaut par **téléphone** :

    - correspondance unique → le contact est **enrichi** ;
    - aucune correspondance → le contact est **créé** ;
    - plusieurs correspondances → la ligne est **signalée** et laissée de côté.

    `mode` décide du sort des valeurs déjà renseignées en base :

    - `complete` (défaut) — ne remplit que les champs vides, rien n'est perdu ;
    - `overwrite` — les valeurs du fichier remplacent celles en base.

    Dans les deux cas une cellule vide n'efface jamais rien.
    """
    if mode not in IMPORT_MODES:
        raise HTTPException(400, f"Mode invalide (attendu : {' ou '.join(IMPORT_MODES)})")

    filename = (file.filename or "fichier").lower()
    if not filename.endswith((".csv", ".xlsx")):
        raise HTTPException(400, "Le fichier doit être au format CSV (.csv) ou Excel (.xlsx)")

    content = await file.read()
    if not content:
        raise HTTPException(400, "Fichier vide")

    sb = get_supabase_admin()
    job = sb.table("contact_import_job").insert({
        "tenant_id": tenant_id, "status": "processing", "filename": file.filename or "fichier",
        "mode": mode,
    }).execute().data[0]

    background_tasks.add_task(_run_import_job, job["id"], tenant_id, filename, content, mode)

    return {"job_id": job["id"], "status": "processing", "mode": mode}


@router.get("/import/{job_id}")
async def get_import_job(
    job_id: str,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    res = sb.table("contact_import_job").select("*").eq("id", job_id).eq("tenant_id", tenant_id).maybe_single().execute()
    job = res.data if res else None
    if not job:
        raise HTTPException(404, "Import introuvable")
    return job
