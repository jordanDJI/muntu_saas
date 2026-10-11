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
from pydantic import BaseModel, Field, field_validator

from app.core.supabase import get_supabase_admin
from app.middleware.tenant import get_current_tenant
from app.services.invoice_pdf import generate_invoice_pdf
from app.services.invoice_ubl import generate_invoice_ubl
from app.services.invoice_legal import (
    VAT_REGIMES,
    build_legal_mentions,
    client_issues,
    compute_due_date,
    issuer_issues,
)
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
    service_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: str = Field(default="EUR", max_length=3)
    tax_rate: float = Field(default=0, ge=0, le=100)
    vat_regime: Optional[str] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    lines: list[InvoiceLineIn] = []


class InvoiceUpdateIn(BaseModel):
    contact_id: Optional[UUID] = None
    issue_date: Optional[date] = None
    service_date: Optional[date] = None
    due_date: Optional[date] = None
    currency: Optional[str] = None
    tax_rate: Optional[float] = None
    vat_regime: Optional[str] = None
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    lines: Optional[list[InvoiceLineIn]] = None


class CreditNoteIn(BaseModel):
    reason: Optional[str] = Field(default=None, max_length=500)
    issue_date: Optional[date] = None


class InvoiceSettingsIn(BaseModel):
    # Identité légale de l'émetteur — obligatoire sur toute facture française.
    vat_number: Optional[str] = None
    legal_id: Optional[str] = Field(default=None, max_length=20)      # SIREN / SIRET / BCE
    legal_form: Optional[str] = Field(default=None, max_length=60)    # SASU, EI, SRL…
    share_capital: Optional[str] = Field(default=None, max_length=40)
    rcs_city: Optional[str] = Field(default=None, max_length=80)

    # Adresse structurée : EN 16931 exige le pays, pas une chaîne libre.
    address_street: Optional[str] = Field(default=None, max_length=200)
    address_postal_code: Optional[str] = Field(default=None, max_length=20)
    address_city: Optional[str] = Field(default=None, max_length=100)
    address_country: Optional[str] = Field(default=None, max_length=2)

    # Régime de TVA et mentions
    vat_regime: Optional[str] = None
    default_tax_rate: Optional[float] = Field(default=None, ge=0, le=100)
    late_penalty_rate: Optional[float] = Field(default=None, ge=0, le=100)
    recovery_fee: Optional[float] = Field(default=None, ge=0)
    insurance_name: Optional[str] = Field(default=None, max_length=160)
    insurance_coverage: Optional[str] = Field(default=None, max_length=160)

    prefix: str = Field(default="FAC", max_length=10)
    credit_prefix: str = Field(default="AV", max_length=10)
    payment_terms_days: int = Field(default=30, ge=0, le=365)
    bank_iban: Optional[str] = None
    bank_bic: Optional[str] = None
    bank_name: Optional[str] = None
    footer_note: Optional[str] = None

    @field_validator("vat_regime")
    @classmethod
    def _known_regime(cls, v):
        if v in (None, ""):
            return v
        if v not in VAT_REGIMES:
            raise ValueError(f"Régime de TVA inconnu : {v}")
        return v


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


def _next_invoice_number(sb, tenant_id: str, settings: dict, series: str = "invoice") -> str:
    """
    Génère le prochain numéro de façon atomique.

    Les avoirs ont leur propre série ('credit_note', préfixe AV) : le droit
    français admet des séries distinctes, à condition que chacune reste
    continue. Deux séries séparées valent mieux qu'une numérotation mêlée où un
    avoir inséré crée un trou apparent dans la suite des factures.
    """
    if series == "credit_note":
        prefix = (settings.get("credit_prefix") or "AV").upper()
    else:
        prefix = (settings.get("prefix") or "FAC").upper()
    year = date.today().year

    try:
        res = sb.rpc("increment_invoice_sequence_series", {
            "p_tenant_id": tenant_id,
            "p_year": year,
            "p_series": series,
        }).execute()
        n = res.data if isinstance(res.data, int) else (res.data or [{}])[0].get("increment_invoice_sequence_series")
        if n:
            return f"{prefix}-{year}-{int(n):04d}"
    except Exception as e:
        _log.error("increment_invoice_sequence_series error: %s", e)

    # Repli : relit la séquence. Sans garantie d'atomicité, mais la contrainte
    # UNIQUE(tenant_id, number) empêche deux factures de porter le même numéro.
    seq_res = (
        sb.table("invoice_sequence")
        .select("last_number")
        .eq("tenant_id", tenant_id)
        .eq("year", year)
        .eq("series", series)
        .execute()
    )
    n = (seq_res.data[0]["last_number"] if seq_res.data else 0) + 1
    return f"{prefix}-{year}-{n:04d}"


def _get_tenant_snapshot(sb, tenant_id: str) -> dict:
    """
    Fige l'identité de l'émetteur sur la facture.

    L'adresse structurée vient des paramètres de facturation ; à défaut, elle
    retombe sur celle du site vitrine (site_style.address_parts), que le tenant
    a déjà saisie dans le site-builder — inutile de la lui redemander.
    """
    t = sb.table("tenant").select("name, country, invoice_settings").eq("id", tenant_id).single().execute().data or {}
    site = (
        sb.table("site")
        .select("address, site_style")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .execute()
    ).data or [{}]
    site = site[0] if site else {}
    style = site.get("site_style") or {}
    parts = style.get("address_parts") or {}
    s = t.get("invoice_settings") or {}

    street = s.get("address_street") or parts.get("street") or site.get("address", "")
    postal = s.get("address_postal_code") or parts.get("postal_code") or ""
    city   = s.get("address_city") or parts.get("city") or ""
    country = (
        s.get("address_country")
        or parts.get("country")
        or t.get("country")
        or ""
    ).upper()[:2]

    return {
        "tenant_name": t.get("name", ""),
        "tenant_address": site.get("address", ""),
        "tenant_vat": s.get("vat_number", ""),
        "tenant_legal_id": s.get("legal_id", ""),
        "tenant_street": street,
        "tenant_postal_code": postal,
        "tenant_city": city,
        "tenant_country": country,
        "vat_regime": s.get("vat_regime") or "standard",
        "legal_mentions": build_legal_mentions(s),
    }


def _get_contact_snapshot(sb, contact_id: str, tenant_id: str) -> dict:
    """
    Fige l'identité du client sur la facture.

    L'adresse vit dans contact.custom_fields : ce sont des champs configurables
    par tenant, mais les clés de base (street, postal_code, city) sont fixes.
    """
    res = (
        sb.table("contact")
        .select("first_name, last_name, email, custom_fields")
        .eq("id", contact_id)
        .eq("tenant_id", tenant_id)
        .execute()
    )
    rows = res.data or []
    if not rows:
        raise HTTPException(status_code=404, detail="Contact introuvable")
    c = rows[0]
    cf = c.get("custom_fields") or {}
    name = f"{c.get('first_name', '')} {c.get('last_name', '')}".strip()

    street = " ".join(
        str(p).strip() for p in [cf.get("street_number"), cf.get("street")] if p
    ).strip()

    return {
        "client_name": name,
        "client_email": c.get("email", ""),
        "client_address": street,
        "client_street": street,
        "client_postal_code": cf.get("postal_code") or "",
        "client_city": cf.get("city") or "",
        "client_country": (cf.get("country_residence") or "")[:2].upper(),
        "client_vat": cf.get("vat_number") or "",
        "client_legal_id": cf.get("siret") or cf.get("siren") or "",
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


def _with_credit_reference(sb, invoice: dict) -> dict:
    """
    Ajoute le numéro et la date de la facture corrigée.

    Un avoir doit référencer la facture d'origine, sur le PDF comme dans l'UBL ;
    la colonne ne porte qu'un UUID, inutilisable tel quel pour un lecteur.
    """
    if invoice.get("document_type") != "credit_note" or not invoice.get("credit_note_of"):
        return invoice
    try:
        ref = (
            sb.table("invoice")
            .select("number, issue_date")
            .eq("id", invoice["credit_note_of"])
            .single()
            .execute()
        ).data or {}
    except Exception as e:
        _log.warning("credit note reference lookup failed: %s", e)
        return invoice
    return {
        **invoice,
        "credit_note_of_number": ref.get("number", ""),
        "credit_note_of_date": ref.get("issue_date"),
    }


def _build_and_generate(sb, invoice: dict, settings: dict, tenant_id: str = "") -> tuple[bytes, bytes]:
    """Génère PDF + UBL pour une facture. Retourne (pdf_bytes, ubl_bytes)."""
    lines = _get_lines(sb, invoice["id"])
    invoice = _with_credit_reference(sb, invoice)
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


@router.get("/settings/compliance")
async def check_invoice_compliance(tenant_id: str = Depends(get_current_tenant)):
    """
    Ce qui manque aux paramètres pour émettre une facture conforme.

    Appelé par l'écran de facturation pour prévenir le professionnel avant
    qu'il ne bute sur le refus d'envoi.
    """
    sb = get_supabase_admin()
    snap = _get_tenant_snapshot(sb, tenant_id)
    # service_date et client sont propres à chaque facture : on les neutralise
    # pour ne rapporter ici que ce qui relève des paramètres.
    probe = {**snap, "service_date": "probe", "tax_rate": 1}
    missing = issuer_issues(probe, snap.get("tenant_country") or "")
    return {
        "country": snap.get("tenant_country") or "",
        "compliant": not missing,
        "missing": missing,
    }


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
        .select("id, number, status, document_type, credit_note_of, issue_date, service_date, due_date, currency, subtotal, tax_amount, total, client_name, client_email, pdf_url, ubl_url, paid_at, sent_at, created_at, contact_id, appointment_id", count="exact")
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

    contact_id = appt.get("contact_id")
    # Snapshot complet (adresse comprise) plutôt que les seuls nom et email du
    # join : l'adresse du client est une mention obligatoire de la facture.
    client_snap = _get_contact_snapshot(sb, contact_id, tenant_id) if contact_id else {}
    if not client_snap.get("client_name"):
        client_snap["client_name"] = (
            f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
        )
    if not client_snap.get("client_email"):
        client_snap["client_email"] = contact.get("email", "")

    # Calcul échéance
    payment_terms_days = int(settings.get("payment_terms_days", 30))
    today = date.today()
    due = compute_due_date(today, payment_terms_days)

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

    # Date de la prestation = date du RDV, pas date d'émission de la facture.
    # C'est une mention obligatoire et elle diffère presque toujours.
    scheduled = appt.get("scheduled_at") or ""
    service_date = str(scheduled)[:10] or today.isoformat()

    inv = {
        "tenant_id": tenant_id,
        "contact_id": contact_id,
        "appointment_id": str(appt_id),
        "number": number,
        "status": "draft",
        "issue_date": today.isoformat(),
        "service_date": service_date,
        "due_date": due.isoformat() if due else None,
        "currency": "EUR",
        "subtotal": computed["subtotal"],
        "tax_rate": float(settings.get("default_tax_rate", 0)),
        "tax_amount": computed["tax_amount"],
        "total": computed["total"],
        "payment_terms": payment_terms,
        **client_snap,
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
        client_snap = _get_contact_snapshot(sb, str(body.contact_id), tenant_id)

    if body.appointment_id:
        cal_rows = sb.table("calendar").select("id").eq("tenant_id", tenant_id).execute().data or []
        cal_ids = [c["id"] for c in cal_rows]
        appt_owned = (
            sb.table("appointment").select("id").eq("id", str(body.appointment_id))
            .in_("calendar_id", cal_ids or ["00000000-0000-0000-0000-000000000000"])
            .execute().data
        )
        if not appt_owned:
            raise HTTPException(status_code=404, detail="Rendez-vous introuvable")

    computed = _compute_totals(body.lines, body.tax_rate)
    number = _next_invoice_number(sb, tenant_id, settings)

    payment_terms_days = int(settings.get("payment_terms_days", 30))
    due = body.due_date or compute_due_date(body.issue_date, payment_terms_days)

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
        # À défaut de précision, la prestation est réputée faite le jour de
        # l'émission : la mention est obligatoire, la laisser vide bloquerait
        # l'envoi au contrôle de conformité.
        "service_date": (body.service_date or body.issue_date).isoformat(),
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
    if body.vat_regime:
        inv["vat_regime"] = body.vat_regime

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
        client_snap = _get_contact_snapshot(sb, str(body.contact_id), tenant_id)
        updates.update(client_snap)
        updates["contact_id"] = str(body.contact_id)
    if body.issue_date is not None:
        updates["issue_date"] = body.issue_date.isoformat()
    if body.service_date is not None:
        updates["service_date"] = body.service_date.isoformat()
    if body.vat_regime is not None:
        if body.vat_regime not in VAT_REGIMES:
            raise HTTPException(400, f"Régime de TVA inconnu : {body.vat_regime}")
        updates["vat_regime"] = body.vat_regime
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

    updated = sb.table("invoice").update(updates).eq("id", str(invoice_id)).eq("tenant_id", tenant_id).execute().data[0]
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
    sb.table("invoice").delete().eq("id", str(invoice_id)).eq("tenant_id", tenant_id).execute()
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
        sb.table("invoice").update(updates).eq("id", str(invoice_id)).eq("tenant_id", tenant_id).execute()
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

    # Contrôle de conformité. Les manques côté émetteur bloquent : ils viennent
    # des paramètres, se corrigent une fois, et rendent sinon non conforme
    # chaque facture émise — l'amende étant encourue par le professionnel, pas
    # par Klientys. Les manques côté client sont seulement signalés : ils se
    # corrigent fiche par fiche et ne doivent pas immobiliser la facturation.
    blocking = issuer_issues(inv, inv.get("tenant_country") or "")
    if blocking:
        raise HTTPException(400, {
            "message": (
                "Facture non conforme : il manque "
                + ", ".join(blocking)
                + ". Complétez Paramètres → Facturation avant l'envoi."
            ),
            "missing": blocking,
        })

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

    sb.table("invoice").update(updates).eq("id", str(invoice_id)).eq("tenant_id", tenant_id).execute()
    return {
        "status": "sent",
        "number": inv["number"],
        "warnings": client_issues(inv, inv.get("tenant_country") or ""),
    }


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
    sb.table("invoice").update(updates).eq("id", str(invoice_id)).eq("tenant_id", tenant_id).execute()
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
    # Une facture remise au client ne s'annule pas : elle se corrige par un
    # avoir, qui laisse la trace comptable exigée. L'annulation reste ouverte
    # tant que la facture n'est pas sortie.
    if inv.get("sent_at") or inv["status"] in ("sent", "overdue"):
        raise HTTPException(400, (
            "Cette facture a été envoyée au client : elle ne peut plus être "
            "annulée. Émettez une facture d'avoir pour la corriger."
        ))
    sb.table("invoice").update({
        "status": "cancelled",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", str(invoice_id)).eq("tenant_id", tenant_id).execute()
    return {"status": "cancelled"}


# ── Facture d'avoir ───────────────────────────────────────────────────────────

@router.post("/{invoice_id}/credit-note", status_code=201)
async def create_credit_note(
    invoice_id: UUID,
    body: CreditNoteIn,
    tenant_id: str = Depends(get_current_tenant),
):
    """
    Émet une facture d'avoir annulant une facture envoyée.

    Reprend les lignes en négatif, sa propre numérotation (série AV) et la
    référence à la facture d'origine. L'avoir naît en brouillon : il s'envoie
    comme une facture, après relecture.
    """
    sb = get_supabase_admin()
    inv = _get_invoice_or_404(sb, str(invoice_id), tenant_id)

    if inv.get("document_type") == "credit_note":
        raise HTTPException(400, "Un avoir ne peut pas faire l'objet d'un avoir")
    if inv["status"] == "draft":
        raise HTTPException(400, (
            "Cette facture est encore en brouillon : modifiez-la ou supprimez-la "
            "directement, un avoir n'a pas lieu d'être."
        ))

    existing = (
        sb.table("invoice")
        .select("id, number")
        .eq("tenant_id", tenant_id)
        .eq("credit_note_of", str(invoice_id))
        .execute()
    ).data
    if existing:
        raise HTTPException(409, f"Un avoir existe déjà pour cette facture : {existing[0]['number']}")

    settings = _get_invoice_settings(sb, tenant_id)
    number = _next_invoice_number(sb, tenant_id, settings, series="credit_note")
    issue = body.issue_date or date.today()

    lines = _get_lines(sb, str(invoice_id))

    # Les montants de l'avoir sont ceux de la facture, en négatif : c'est ce qui
    # permet à la somme des deux documents de valoir zéro en comptabilité.
    credit = {
        "tenant_id": tenant_id,
        "contact_id": inv.get("contact_id"),
        "appointment_id": None,  # un seul document par RDV (contrainte métier existante)
        "number": number,
        "document_type": "credit_note",
        "credit_note_of": str(invoice_id),
        "credit_reason": body.reason,
        "status": "draft",
        "issue_date": issue.isoformat(),
        "service_date": inv.get("service_date") or inv.get("issue_date"),
        "due_date": None,
        "currency": inv.get("currency", "EUR"),
        "subtotal": -float(inv.get("subtotal") or 0),
        "tax_rate": inv.get("tax_rate") or 0,
        "tax_amount": -float(inv.get("tax_amount") or 0),
        "total": -float(inv.get("total") or 0),
        "vat_regime": inv.get("vat_regime") or "standard",
        "legal_mentions": inv.get("legal_mentions") or {},
        "notes": body.reason,
        # Identités figées : l'avoir reprend celles de la facture corrigée, pas
        # les coordonnées du jour. Une adresse qui change entre les deux
        # documents les rendrait inrapprochables.
        **{k: inv.get(k) for k in (
            "client_name", "client_email", "client_address", "client_street",
            "client_postal_code", "client_city", "client_country", "client_vat",
            "client_legal_id", "tenant_name", "tenant_address", "tenant_vat",
            "tenant_legal_id", "tenant_street", "tenant_postal_code",
            "tenant_city", "tenant_country",
        )},
    }

    created = sb.table("invoice").insert(credit).execute().data[0]

    for ln in lines:
        sb.table("invoice_line").insert({
            "invoice_id": created["id"],
            "description": ln.get("description", ""),
            "quantity": ln.get("quantity", 1),
            "unit_price": -float(ln.get("unit_price") or 0),
            "tax_rate": ln.get("tax_rate", 0),
            "total": -float(ln.get("total") or 0),
            "position": ln.get("position", 0),
        }).execute()

    created["lines"] = _get_lines(sb, created["id"])
    return created


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
