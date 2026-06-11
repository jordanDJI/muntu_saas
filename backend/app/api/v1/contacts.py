"""
CRM — Contacts enrichis
Couvre : liste contacts, fiche unifiée, notes, valeur client, inactivité, import CSV.
Tags et reminders sont dans tags.py et reminders.py (routeurs séparés, même préfixe /contacts).
"""
import csv
import io
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant

router = APIRouter(prefix="/contacts", tags=["Contacts"])

INACTIVE_DAYS = 180  # 6 mois sans RDV confirmé → inactif


# ── Schémas ──────────────────────────────────────────────────────────────────

class ContactUpdate(BaseModel):
    notes: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None


class ActivityCreate(BaseModel):
    type: str = "note"
    content: str


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

    return contacts


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/export")
async def export_contacts_csv(
    tenant_id: str = Depends(get_current_tenant),
):
    """Exporte tous les contacts du tenant en fichier CSV (téléchargement)."""
    sb = get_supabase_admin()

    contacts = (
        sb.table("contact")
        .select("first_name, last_name, email, phone, notes, source, created_at")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .execute()
    ).data or []

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["first_name", "last_name", "email", "phone", "notes", "source", "created_at"])
    for c in contacts:
        writer.writerow([
            c.get("first_name") or "",
            c.get("last_name") or "",
            c.get("email") or "",
            c.get("phone") or "",
            c.get("notes") or "",
            c.get("source") or "",
            (c.get("created_at") or "")[:10],
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=contacts.csv"},
    )


@router.get("/")
async def list_contacts(
    q: Optional[str] = None,
    tag_id: Optional[str] = None,
    inactive_only: bool = False,
    limit: int = Query(default=30, le=100),
    offset: int = 0,
    tenant_id: str = Depends(get_current_tenant),
):
    """Liste paginée des contacts avec enrichissement (tags, valeur, inactivité)."""
    sb = get_supabase_admin()

    query = (
        sb.table("contact")
        .select("id, first_name, last_name, email, phone, contact_type, created_at")
        .eq("tenant_id", tenant_id)
        .is_("deleted_at", "null")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if q:
        query = query.or_(
            f"first_name.ilike.%{q}%,last_name.ilike.%{q}%,email.ilike.%{q}%,phone.ilike.%{q}%"
        )

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
    total = (count_q.execute()).count or 0

    return {"contacts": contacts, "total": total, "offset": offset, "limit": limit}


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
):
    """Met à jour les champs éditables d'un contact."""
    sb = get_supabase_admin()

    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(400, "Aucun champ à mettre à jour")

    res = (
        sb.table("contact")
        .update(updates)
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Contact introuvable")
    return res.data[0]


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


@router.post("/import")
async def import_contacts_csv(
    file: UploadFile = File(...),
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Importe des contacts depuis un fichier CSV.
    Colonnes attendues (insensible à la casse) : first_name, last_name, email, phone, notes.
    Ignore les doublons (même email déjà présent pour ce tenant).
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "Le fichier doit être au format CSV (.csv)")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # gère le BOM Excel
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))
    # Normalise les noms de colonnes en minuscules sans espaces
    rows = []
    for row in reader:
        rows.append({k.strip().lower(): v.strip() for k, v in row.items()})

    if not rows:
        return {"created": 0, "skipped": 0, "errors": []}

    sb = get_supabase_admin()

    # Emails déjà présents pour ce tenant
    existing_emails = {
        r["email"].lower()
        for r in (
            sb.table("contact")
            .select("email")
            .eq("tenant_id", tenant_id)
            .is_("deleted_at", "null")
            .execute()
        ).data or []
        if r.get("email")
    }

    created, skipped = 0, 0
    errors: list[str] = []
    to_insert: list[dict] = []

    for i, row in enumerate(rows, start=2):  # ligne 1 = header
        email = row.get("email", "").lower() or None
        first_name = row.get("first_name") or row.get("prenom") or row.get("prénom") or ""
        last_name = row.get("last_name") or row.get("nom") or ""
        phone = row.get("phone") or row.get("telephone") or row.get("téléphone") or None
        notes = row.get("notes") or None

        if not first_name and not last_name and not email:
            skipped += 1
            continue

        if email and email in existing_emails:
            skipped += 1
            continue

        to_insert.append({
            "tenant_id": tenant_id,
            "first_name": first_name or None,
            "last_name": last_name or None,
            "email": email,
            "phone": phone,
            "notes": notes,
            "source": "csv_import",
        })
        if email:
            existing_emails.add(email)

    if to_insert:
        try:
            sb.table("contact").insert(to_insert).execute()
            created = len(to_insert)
        except Exception as e:
            raise HTTPException(500, f"Erreur lors de l'insertion : {e}")

    return {"created": created, "skipped": skipped, "errors": errors}
