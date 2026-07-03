"""
Facturation électronique — PDF A4 + UBL 2.1 (EN 16931)
Klientys est générateur uniquement, aucun agrément PDP requis.
"""
import io
import base64
import logging
from datetime import date, datetime, timezone
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel, Field

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services.invoice_pdf import generate_invoice_pdf
from app.services.invoice_ubl import generate_invoice_ubl
from app.services import email as email_svc

_log = logging.getLogger(__name__)

router = APIRouter(prefix="/invoices", tags=["Invoices"])


# ── Schémas Pydantic ──────────────────────────────────────────────────────────

class InvoiceLineIn(BaseModel):
    description: str = Field(min_length=1, max_length=500)
    quantity: float = Field(default=1, gt=0)
    unit_price: float = Field(default=0, ge=0)
    tax_rate: float = Field(default=0, ge=0, le=100)
    position: int = Field(default=0)


class InvoiceCreateIn(BaseModel):
    contact_id: Optional[UUID] = None
    appointment_id: Optional[UUID] = None
    issue_date: date = Field(default_factory=date.today)
    due_date: Optional[date] = None
    currency: str = Field(default="EUR", max_length=3)
    tax_rate: float = Field(default=0, ge=0, le=100)
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    lines: list[InvoiceLineIn] = []


class InvoiceUpdateIn(BaseModel):
    contact_id: Optional[UUID] = None
    issue_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    lines: Optional[list[InvoiceLineIn]] = None


class InvoiceSettingsIn(BaseModel):
    vat_number: Optional[str] = None
    prefix: str = Field(default="FAC", max_length=10)
    payment_terms_days: int = Field(default=30, ge=0, le=365)
    bank_iban: Optional[str] = None
    bank_bic: Optional[str] = None
    bank_name: Optional[str] = None
    footer_note: Optional[str] = None


# ── Helpers internes ──────────────────────────────────────────────────────────

def _get_invoice_or_404(sb, invoice_id: str, tenant_id: str) -> dict:
    res = (
        sb.table("invoice")
        .select("*")
        .eq("id", invoice_id)
        .eq("tenant_id", tenant_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(404, "Facture introuvable")
    return res.data


def _get_lines(sb, invoice_id: str) -> list[dict]:
    return (
        sb.table("invoice_line")
        .select("*")
        .eq("invoice_id", invoice_id)
        .order("position")
        .execute()
    ).data or []


def _get_invoice_settings(sb, tenant_id: str) -> dict:
    res = sb.table("tenant").select("invoice_settings").eq("id", tenant_id).single().execute()
    return (res.data or {}).get("invoice_settings") or {}


def _compute_totals(lines: list[InvoiceLineIn], tax_rate: float) -> dict:
    """Calcule sous-total, TVA et total depuis les lignes."""
    subtotal = 0.0
    computed_lines = []
    for line in lines:
        line_total = round(float(line.quantity) * float(line.unit_price), 2)
        computed_lines.append({
            "description": line.description,
            "quantity": float(line.quantity),
            "unit_price": float(line.unit_price),
            "tax_rate": float(line.tax_rate),
            "total": line_total,
            "position": line.position,
        })
        subtotal += line_total

    subtotal = round(subtotal, 2)
    tax_amount = round(subtotal * float(tax_rate) / 100, 2)
    total = round(subtotal + tax_amount, 2)
    return {
        "subtotal": subtotal,
        "tax_amount": tax_amount,
        "total": total,
        "lines": computed_lines,
    }


def _next_invoice_number(sb, tenant_id: str, settings: dict) -> str:
    """Génère le prochain numéro de facture de façon atomique."""
    prefix = (settings.get("prefix") or "FAC").upper()
    year = date.today().year
    try:
        res = sb.rpc("increment_invoice_sequence", {
            "p_tenant_id": tenant_id,
            "p_year": year,
        }).execute()
    except Exception as e:
        _log.error("increment_invoice_sequence error: %s", e)
        # Fallback : lit le dernier numéro sans garantie d'atomicité
        seq_res = (
            sb.table("invoice_sequence")
            .select("last_number")
            .eq("tenant_id", tenant_id)
            .eq("year", year)
            .execute()
        )
        n = (seq_res.data[0]["last_number"] if seq_res.data else 0) + 1
        return f"{prefix}-{year}-{n:04d}"

    seq = (
        sb.table("invoice_sequence")
        .select("last_number")
        .eq("tenant_id", tenant_id)
        .eq("year", year)
        .single()
        .execute()
    )
    n = seq.data["last_number"] if seq.data else 1
    return f"{prefix}-{year}-{n:04d}"


def _get_tenant_snapshot(sb, tenant_id: str) -> dict:
    """Récupère les infos tenant + site pour le snapshot de la facture."""
    t = sb.table("tenant").select("name, invoice_settings").eq("id", tenant_id).single().execute().data or {}
    site = (
        sb.table("site")
        .select("address, site_style")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or [{}]
    site = site[0] if site else {}
    inv_settings = t.get("invoice_settings") or {}
    return {
        "tenant_name": t.get("name", ""),
        "tenant_address": site.get("address", ""),
        "tenant_vat": inv_settings.get("vat_number", ""),
    }


def _get_contact_snapshot(sb, contact_id: str) -> dict:
    """Récupère les infos client pour le snapshot de la facture."""
    res = sb.table("contact").select("first_name, last_name, email").eq("id", contact_id).single().execute()
    c = res.data or {}
    name = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip()
    return {
        "client_name": name,
        "client_email": c.get("email", ""),
        "client_address": "",
        "client_vat": "",
    }


def _enrich_settings_with_brand(sb, settings: dict, tenant_id: str) -> dict:
    """Injecte les couleurs + logo du tenant dans le dict settings pour le PDF."""
    try:
        res = sb.table("site").select("site_style").eq("tenant_id", tenant_id).limit(1).execute()
        if res.data:
            style = res.data[0].get("site_style") or {}
            color = style.get("primary_color", "")
            logo_url = style.get("logo_url", "")
            logo_opt = style.get("logo_option", "text_only")
            return {
                **settings,
                "_brand_color": color,
                "_logo_url": logo_url if logo_opt not in ("text_only", "") else "",
                "_logo_option": logo_opt,
            }
    except Exception:
        pass
    return settings


def _build_and_generate(sb, invoice: dict, settings: dict, tenant_id: str = "") -> tuple[bytes, bytes]:
    """Génère PDF + UBL pour une facture. Retourne (pdf_bytes, ubl_bytes)."""
    lines = _get_lines(sb, invoice["id"])
    rich = _enrich_settings_with_brand(sb, settings, tenant_id or invoice.get("tenant_id", ""))
    pdf = generate_invoice_pdf(invoice, lines, rich)
    ubl = generate_invoice_ubl(invoice, lines, settings)
    return pdf, ubl


def _upload_to_storage(sb, tenant_id: str, invoice_id: str, pdf: bytes, ubl: bytes) -> tuple[str, str]:
    """Upload PDF + UBL dans Supabase Storage. Retourne (pdf_url, ubl_url)."""
    bucket = "invoices"
    pdf_path = f"{tenant_id}/{invoice_id}.pdf"
    ubl_path = f"{tenant_id}/{invoice_id}.ubl.xml"
    try:
        sb.storage.from_(bucket).upload(
            pdf_path, pdf,
            {"content-type": "application/pdf", "upsert": "true"},
        )
        sb.storage.from_(bucket).upload(
            ubl_path, ubl,
            {"content-type": "application/xml", "upsert": "true"},
        )
        pdf_url = sb.storage.from_(bucket).get_public_url(pdf_path)
        ubl_url = sb.storage.from_(bucket).get_public_url(ubl_path)
        return pdf_url, ubl_url
    except Exception as e:
        _log.warning("Storage upload failed (non-fatal): %s", e)
        return "", ""


# ── Paramètres de facturation ─────────────────────────────────────────────────

@router.get("/settings")
async def get_invoice_settings(tenant_id: str = Depends(get_current_tenant)):
    sb = get_supabase_admin()
    return _get_invoice_settings(sb, tenant_id)


@router.patch("/settings")
async def update_invoice_settings(
    body: InvoiceSettingsIn,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    current = _get_invoice_settings(sb, tenant_id)
    merged = {**current, **body.model_dump(exclude_none=True)}
    sb.table("tenant").update({"invoice_settings": merged}).eq("id", tenant_id).execute()
    return merged


# ── Liste des factures ────────────────────────────────────────────────────────

@router.get("/")
async def list_invoices(
    status: Optional[str] = None,
    contact_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    q = (
        sb.table("invoice")
        .select("id, number, status, issue_date, due_date, currency, subtotal, tax_amount, total, client_name, client_email, pdf_url, ubl_url, paid_at, sent_at, created_at, contact_id, appointment_id", count="exact")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if status:
        q = q.eq("status", status)
    if contact_id:
        q = q.eq("contact_id", contact_id)
    res = q.execute()
    invoices = res.data or []

    # Auto-détection overdue : facture "sent" dont l'échéance est dépassée
    today_str = date.today().isoformat()
    overdue_ids = [
        inv["id"] for inv in invoices
        if inv["status"] == "sent" and inv.get("due_date") and inv["due_date"] < today_str
    ]
    if overdue_ids:
        sb.table("invoice").update({"status": "overdue", "updated_at": datetime.now(timezone.utc).isoformat()}).in_("id", overdue_ids).execute()
        for inv in invoices:
            if inv["id"] in overdue_ids:
                inv["status"] = "overdue"

    return {"invoices": invoices, "total": res.count or 0, "offset": offset, "limit": limit}


# ── Création auto depuis un RDV ───────────────────────────────────────────────

@router.post("/from-appointment/{appt_id}", status_code=201)
async def create_invoice_from_appointment(
    appt_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    """Crée un brouillon de facture pré-rempli depuis un RDV confirmé."""
    sb = get_supabase_admin()

    # Vérification RDV appartient au tenant
    cal = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or []
    cal_ids = [c["id"] for c in cal]
    if not cal_ids:
        raise HTTPException(400, "Aucun calendrier trouvé pour ce tenant")

    appt = (
        sb.table("appointment")
        .select("*, contact(first_name, last_name, email), service_offer(name, price_eur)")
        .eq("id", str(appt_id))
        .in_("calendar_id", cal_ids)
        .single()
        .execute()
    ).data
    if not appt:
        raise HTTPException(404, "Rendez-vous introuvable")

    # Vérification qu'une facture n'existe pas déjà pour ce RDV
    existing = (
        sb.table("invoice")
        .select("id, number")
        .eq("tenant_id", tenant_id)
        .eq("appointment_id", str(appt_id))
        .execute()
    ).data
    if existing:
        raise HTTPException(409, f"Une facture existe déjà pour ce rendez-vous : {existing[0]['number']}")

    settings = _get_invoice_settings(sb, tenant_id)
    tenant_snap = _get_tenant_snapshot(sb, tenant_id)
    contact = appt.get("contact") or {}
    service = appt.get("service_offer") or {}

    client_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
    contact_id = appt.get("contact_id")

    # Calcul échéance
    payment_terms_days = int(settings.get("payment_terms_days", 30))
    today = date.today()
    due = date(today.year, today.month, min(today.day + payment_terms_days, 28))

    # Ligne depuis le service_offer
    lines: list[InvoiceLineIn] = []
    price = float(service.get("price_eur") or 0)
    if service.get("name"):
        lines.append(InvoiceLineIn(
            description=service["name"],
            quantity=1,
            unit_price=price,
            tax_rate=float(settings.get("default_tax_rate", 0)),
            position=0,
        ))

    computed = _compute_totals(lines, settings.get("default_tax_rate", 0))
    number = _next_invoice_number(sb, tenant_id, settings)

    payment_terms = (
        f"Paiement à {payment_terms_days} jours"
        if payment_terms_days > 0
        else "Paiement immédiat"
    )

    inv = {
        "tenant_id": tenant_id,
        "contact_id": contact_id,
        "appointment_id": str(appt_id),
        "number": number,
        "status": "draft",
        "issue_date": today.isoformat(),
        "due_date": due.isoformat(),
        "currency": "EUR",
        "subtotal": computed["subtotal"],
        "tax_rate": float(settings.get("default_tax_rate", 0)),
        "tax_amount": computed["tax_amount"],
        "total": computed["total"],
        "client_name": client_name,
        "client_email": contact.get("email", ""),
        "payment_terms": payment_terms,
        **tenant_snap,
    }

    created = sb.table("invoice").insert(inv).execute().data[0]

    # Insérer les lignes
    if computed["lines"]:
        for ln in computed["lines"]:
            sb.table("invoice_line").insert({
                "invoice_id": created["id"],
                **ln,
            }).execute()

    created["lines"] = computed["lines"]
    return created


# ── Création manuelle ─────────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_invoice(
    body: InvoiceCreateIn,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    settings = _get_invoice_settings(sb, tenant_id)
    tenant_snap = _get_tenant_snapshot(sb, tenant_id)

    # Snapshot client
    client_snap = {}
    if body.contact_id:
        client_snap = _get_contact_snapshot(sb, str(body.contact_id))

    computed = _compute_totals(body.lines, body.tax_rate)
    number = _next_invoice_number(sb, tenant_id, settings)

    payment_terms_days = int(settings.get("payment_terms_days", 30))
    due = body.due_date
    if not due and payment_terms_days > 0:
        from datetime import timedelta
        due = body.issue_date + timedelta(days=payment_terms_days)

    payment_terms = body.payment_terms
    if not payment_terms and payment_terms_days > 0:
        payment_terms = f"Paiement à {payment_terms_days} jours"

    inv = {
        "tenant_id": tenant_id,
        "contact_id": str(body.contact_id) if body.contact_id else None,
        "appointment_id": str(body.appointment_id) if body.appointment_id else None,
        "number": number,
        "status": "draft",
        "issue_date": body.issue_date.isoformat(),
        "due_date": due.isoformat() if due else None,
        "currency": body.currency,
        "subtotal": computed["subtotal"],
        "tax_rate": float(body.tax_rate),
        "tax_amount": computed["tax_amount"],
        "total": computed["total"],
        "notes": body.notes,
        "payment_terms": payment_terms,
        **client_snap,
        **tenant_snap,
    }

    created = sb.table("invoice").insert(inv).execute().data[0]

    if computed["lines"]:
        for ln in computed["lines"]:
            sb.table("invoice_line").insert({
                "invoice_id": created["id"],
                **ln,
            }).execute()

    created["lines"] = computed["lines"]
    return created


# ── Détail d'une facture ──────────────────────────────────────────────────────

@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    inv["lines"] = _get_lines(sb, str(invoice_id))
    return inv


# ── Mise à jour (draft uniquement) ────────────────────────────────────────────

@router.patch("/{invoice_id}")
async def update_invoice(
    invoice_id: UUID,
    body: InvoiceUpdateIn,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    if inv["status"] != "draft":
        raise HTTPException(400, "Seules les factures en brouillon peuvent être modifiées")

    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}

    if body.contact_id is not None:
        client_snap = _get_contact_snapshot(sb, str(body.contact_id))
        updates.update(client_snap)
        updates["contact_id"] = str(body.contact_id)
    if body.issue_date is not None:
        updates["issue_date"] = body.issue_date.isoformat()
    if body.due_date is not None:
        updates["due_date"] = body.due_date.isoformat()
    if body.currency is not None:
        updates["currency"] = body.currency
    if body.notes is not None:
        updates["notes"] = body.notes
    if body.payment_terms is not None:
        updates["payment_terms"] = body.payment_terms

    # Recalcul si les lignes ou le taux TVA changent
    current_tax_rate = float(body.tax_rate if body.tax_rate is not None else inv.get("tax_rate", 0))
    if body.lines is not None:
        computed = _compute_totals(body.lines, current_tax_rate)
        updates["subtotal"]   = computed["subtotal"]
        updates["tax_rate"]   = current_tax_rate
        updates["tax_amount"] = computed["tax_amount"]
        updates["total"]      = computed["total"]
        # Remplacer les lignes
        sb.table("invoice_line").delete().eq("invoice_id", str(invoice_id)).execute()
        for ln in computed["lines"]:
            sb.table("invoice_line").insert({"invoice_id": str(invoice_id), **ln}).execute()
    elif body.tax_rate is not None:
        existing_lines = _get_lines(sb, str(invoice_id))
        lines_in = [InvoiceLineIn(
            description=ln["description"],
            quantity=ln["quantity"],
            unit_price=ln["unit_price"],
            tax_rate=ln["tax_rate"],
            position=ln["position"],
        ) for ln in existing_lines]
        computed = _compute_totals(lines_in, body.tax_rate)
        updates["subtotal"]   = computed["subtotal"]
        updates["tax_rate"]   = float(body.tax_rate)
        updates["tax_amount"] = computed["tax_amount"]
        updates["total"]      = computed["total"]

    updated = sb.table("invoice").update(updates).eq("id", str(invoice_id)).execute().data[0]
    updated["lines"] = _get_lines(sb, str(invoice_id))
    return updated


# ── Suppression (draft uniquement) ────────────────────────────────────────────

@router.delete("/{invoice_id}", status_code=204)
async def delete_invoice(
    invoice_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    if inv["status"] != "draft":
        raise HTTPException(400, "Seules les factures en brouillon peuvent être supprimées")
    sb.table("invoice").delete().eq("id", str(invoice_id)).execute()
    return Response(status_code=204)


# ── Génération PDF + UBL → Supabase Storage ───────────────────────────────────

@router.post("/{invoice_id}/generate")
async def generate_invoice_files(
    invoice_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    """Génère PDF + UBL et les stocke dans Supabase Storage. Met à jour pdf_url et ubl_url."""
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    settings = _get_invoice_settings(sb, tenant_id)
    pdf, ubl = _build_and_generate(sb, inv, settings, tenant_id)
    pdf_url, ubl_url = _upload_to_storage(sb, tenant_id, str(invoice_id), pdf, ubl)
    updates: dict = {"updated_at": datetime.now(timezone.utc).isoformat()}
    if pdf_url:
        updates["pdf_url"] = pdf_url
    if ubl_url:
        updates["ubl_url"] = ubl_url
    if updates:
        sb.table("invoice").update(updates).eq("id", str(invoice_id)).execute()
    return {"pdf_url": pdf_url, "ubl_url": ubl_url}


# ── Envoi par email ───────────────────────────────────────────────────────────

@router.post("/{invoice_id}/send")
async def send_invoice(
    invoice_id: UUID,
    background_tasks: BackgroundTasks,
    tenant_id: str = Depends(get_current_tenant),
):
    """Génère la facture et l'envoie par email au client."""
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)

    if not inv.get("client_email"):
        raise HTTPException(400, "Email client manquant — ajoutez-le avant d'envoyer")
    if inv["status"] == "cancelled":
        raise HTTPException(400, "Impossible d'envoyer une facture annulée")

    settings = _get_invoice_settings(sb, tenant_id)
    brand = email_svc.get_tenant_brand(sb, tenant_id)

    pdf, ubl = _build_and_generate(sb, inv, settings, tenant_id)

    # Upload non bloquant
    pdf_url, ubl_url = _upload_to_storage(sb, tenant_id, str(invoice_id), pdf, ubl)

    # Envoi email en arrière-plan
    background_tasks.add_task(
        email_svc.send_invoice,
        contact_email=inv["client_email"],
        contact_name=inv.get("client_name", ""),
        tenant_name=inv.get("tenant_name", ""),
        invoice_number=inv["number"],
        pdf_bytes=pdf,
        ubl_bytes=ubl,
        primary_color=brand.get("primary_color", ""),
        logo_url=brand.get("logo_url", ""),
        logo_option=brand.get("logo_option", "text_only"),
    )

    updates = {
        "status": "sent",
        "sent_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if pdf_url:
        updates["pdf_url"] = pdf_url
    if ubl_url:
        updates["ubl_url"] = ubl_url

    sb.table("invoice").update(updates).eq("id", str(invoice_id)).execute()
    return {"status": "sent", "number": inv["number"]}


# ── Marquer comme payée ───────────────────────────────────────────────────────

@router.post("/{invoice_id}/mark-paid")
async def mark_invoice_paid(
    invoice_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    if inv["status"] in ("cancelled", "paid"):
        raise HTTPException(400, f"Facture déjà {inv['status']}")

    updates = {
        "status": "paid",
        "paid_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    sb.table("invoice").update(updates).eq("id", str(invoice_id)).execute()
    return {"status": "paid"}


# ── Annuler une facture ───────────────────────────────────────────────────────

@router.post("/{invoice_id}/cancel")
async def cancel_invoice(
    invoice_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    if inv["status"] == "paid":
        raise HTTPException(400, "Impossible d'annuler une facture déjà payée")
    if inv["status"] == "cancelled":
        raise HTTPException(400, "Facture déjà annulée")
    sb.table("invoice").update({
        "status": "cancelled",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", str(invoice_id)).execute()
    return {"status": "cancelled"}


# ── Téléchargement PDF ────────────────────────────────────────────────────────

@router.get("/{invoice_id}/pdf")
async def download_invoice_pdf(
    invoice_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    settings = _get_invoice_settings(sb, tenant_id)
    pdf, _ = _build_and_generate(sb, inv, settings, tenant_id)
    safe_name = inv["number"].replace("/", "-").replace("\\", "-")
    return StreamingResponse(
        io.BytesIO(pdf),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.pdf"'},
    )


# ── Téléchargement UBL XML ────────────────────────────────────────────────────

@router.get("/{invoice_id}/ubl")
async def download_invoice_ubl(
    invoice_id: UUID,
    tenant_id: str = Depends(get_current_tenant),
):
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)
    settings = _get_invoice_settings(sb, tenant_id)
    _, ubl = _build_and_generate(sb, inv, settings, tenant_id)
    safe_name = inv["number"].replace("/", "-").replace("\\", "-")
    return StreamingResponse(
        io.BytesIO(ubl),
        media_type="application/xml",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.ubl.xml"'},
    )
