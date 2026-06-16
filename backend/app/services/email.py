import resend
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.core.config import settings

resend.api_key = settings.resend_api_key

_BTN = "background:#0D4B58;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block"
_BTN_GOLD = "background:#DDAA40;color:#07222F;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block"


def get_tenant_brand(sb, tenant_id: str) -> dict:
    """Retourne primary_color, logo_url, logo_option depuis le site_style du tenant."""
    try:
        res = sb.table("site").select("site_style").eq("tenant_id", tenant_id).limit(1).execute()
        if res.data:
            style = res.data[0].get("site_style") or {}
            return {
                "primary_color": style.get("primary_color", ""),
                "logo_url": style.get("logo_url", ""),
                "logo_option": style.get("logo_option", "text_only"),
            }
    except Exception:
        pass
    return {"primary_color": "", "logo_url": "", "logo_option": "text_only"}


def _tenant_email_wrapper(
    tenant_name: str,
    body_html: str,
    primary_color: str = "",
    logo_url: str = "",
    logo_option: str = "text_only",
) -> str:
    """Enveloppe HTML pour les emails envoyés au nom d'un tenant vers ses clients."""
    brand = _hex(primary_color) if primary_color else "#0D4B58"
    if logo_url and logo_option not in ("text_only", ""):
        header_content = (
            f'<img src="{logo_url}" alt="{tenant_name}"'
            f' style="max-height:52px;max-width:200px;object-fit:contain;display:block">'
        )
    else:
        header_content = (
            f'<span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:-.01em">'
            f'{tenant_name}</span>'
        )
    return f"""
    <div style="background:#f0f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;padding:40px 16px;min-height:100%">
      <div style="max-width:540px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
        <div style="background:{brand};padding:24px 32px">{header_content}</div>
        <div style="padding:32px 32px 28px">{body_html}</div>
        <div style="background:#f8fafc;border-top:1px solid #e8ecf0;padding:16px 32px">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6">
            Vous recevez cet email car vous êtes client(e) de <strong style="color:#6b7280">{tenant_name}</strong>. En cas de question, répondez directement à cet email.
          </p>
        </div>
      </div>
    </div>
    """


def _fmt_dt(iso_str: str, tz_name: str = "UTC") -> str:
    """Formate un datetime ISO en heure locale du tenant (ex: 'lundi 13/06/2026 à 09:00')."""
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        try:
            tz = ZoneInfo(tz_name)
        except (ZoneInfoNotFoundError, KeyError):
            tz = ZoneInfo("UTC")
        return dt.astimezone(tz).strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        return iso_str


def send_lead_notification(tenant_email: str, lead: dict, contact: dict) -> None:
    contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip() or "—"
    notes_row = f"""
      <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px;vertical-align:top">Motif</td>
      <td style="padding:7px 0;color:#EEF2F5;font-size:13px">{lead.get('notes')}</td></tr>
    """ if lead.get('notes') else ""
    header = """
    <div style="background:linear-gradient(135deg,#0D4B58 0%,#1A6E82 100%);padding:28px 32px">
      <p style="color:rgba(255,255,255,.6);font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.06em">Nouvelle demande</p>
      <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0;letter-spacing:-.02em">Demande reçue via votre site</h1>
    </div>"""
    body = f"""
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px">
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Nom</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px;font-weight:600">{contact_name}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Email</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px">{contact.get('email', '—')}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Téléphone</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px">{contact.get('phone', '—')}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Type</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px">{lead.get('request_type', '—')}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Canal</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px">{lead.get('source', '—')}</td></tr>
        {notes_row}
      </table>
      <div style="text-align:center">
        <a href="{settings.frontend_url}/dashboard/leads/{lead.get('id')}"
           style="{_BTN_GOLD}">Voir la demande →</a>
      </div>
    """
    footer = '<p style="color:#5C7A8A;font-size:12px;margin:0">Connectez-vous à votre espace Klientys pour traiter cette demande.</p>'
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [tenant_email],
        "subject": f"Nouvelle demande de {contact_name}",
        "html": _klientys_email_wrapper(header, body, footer),
    })


def send_appointment_pending_tenant(
    tenant_email: str,
    tenant_name: str,
    contact: dict,
    appointment: dict,
    dashboard_url: str,
    message: str | None = None,
    tz_name: str = "UTC",
) -> None:
    """Email au professionnel : nouveau RDV en attente de validation."""
    date_str = _fmt_dt(appointment.get("scheduled_at", ""), tz_name)

    contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
    party_size = appointment.get("party_size", 1)
    group_row = (
        f'<tr><td style="padding:4px 12px 4px 0;color:#6b7280">Groupe</td>'
        f'<td><strong>{party_size} personnes</strong></td></tr>'
        if party_size > 1 else ""
    )

    message_block = ""
    if message and message.strip():
        message_block = f"""
        <div style="margin:20px 0;padding:14px 18px;background:rgba(13,75,88,.25);border-left:3px solid #1A6E82;border-radius:0 8px 8px 0">
          <p style="margin:0 0 4px;font-size:11px;color:#8BA5B5;text-transform:uppercase;letter-spacing:.06em">Message du client</p>
          <p style="margin:0;color:#EEF2F5;font-size:13px;line-height:1.6;white-space:pre-wrap">{message.strip()}</p>
        </div>"""

    group_row = (
        f'<tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Groupe</td>'
        f'<td style="padding:7px 0;color:#EEF2F5;font-size:13px"><strong>{party_size} personnes</strong></td></tr>'
        if party_size > 1 else ""
    )

    header = f"""
    <div style="background:linear-gradient(135deg,#0D4B58 0%,#1A6E82 100%);padding:28px 32px">
      <p style="color:rgba(255,255,255,.6);font-size:12px;margin:0 0 4px;text-transform:uppercase;letter-spacing:.06em">Rendez-vous en attente</p>
      <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0;letter-spacing:-.02em">Nouveau RDV à confirmer</h1>
      <p style="color:rgba(255,255,255,.7);font-size:13px;margin:6px 0 0">{tenant_name}</p>
    </div>"""
    body = f"""
      <table style="width:100%;border-collapse:collapse;margin:0 0 8px">
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Client</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px;font-weight:600">{contact_name}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Email</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px">{contact.get('email', '—')}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Téléphone</td>
            <td style="padding:7px 0;color:#EEF2F5;font-size:13px">{contact.get('phone', '—')}</td></tr>
        <tr><td style="padding:7px 16px 7px 0;color:#8BA5B5;font-size:13px">Date</td>
            <td style="padding:7px 0;color:#DDAA40;font-size:13px;font-weight:700">{date_str}</td></tr>
        {group_row}
      </table>
      {message_block}
      <div style="text-align:center;margin-top:24px">
        <a href="{dashboard_url}" style="{_BTN_GOLD}">Gérer ce rendez-vous →</a>
      </div>
    """
    footer = '<p style="color:#5C7A8A;font-size:12px;margin:0">Si vous confirmez, le client recevra automatiquement un email de confirmation.</p>'
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [tenant_email],
        "subject": f"Nouveau RDV en attente — {contact_name}" + (f" ({party_size} pers.)" if party_size > 1 else ""),
        "html": _klientys_email_wrapper(header, body, footer),
    })


def send_appointment_confirmation(contact_email: str, contact_name: str, appointment: dict, tenant_name: str, tz_name: str = "UTC", primary_color: str = "", logo_url: str = "", logo_option: str = "text_only") -> None:
    date_str = _fmt_dt(appointment.get("scheduled_at", ""), tz_name)
    party_size = appointment.get("party_size", 1)
    group_line = f'<p style="color:#374151;font-size:14px;margin:0 0 12px">Réservation pour <strong>{party_size} personnes</strong>.</p>' if party_size > 1 else ""
    body = f"""
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;width:52px;height:52px;border-radius:50%;background:#e6f9f0;line-height:52px;font-size:24px">✓</div>
      </div>
      <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 8px;text-align:center">Rendez-vous confirmé !</h2>
      <p style="color:#374151;font-size:14px;line-height:1.65;margin:0 0 20px;text-align:center">
        Bonjour <strong>{contact_name}</strong>, votre rendez-vous est confirmé.
      </p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <p style="color:#374151;font-size:13px;margin:0 0 6px"><strong>Avec</strong> : {tenant_name}</p>
        <p style="color:#0D4B58;font-size:15px;font-weight:700;margin:0"><strong>{date_str}</strong></p>
      </div>
      {group_line}
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">Vous recevrez un rappel 24 h avant votre rendez-vous.<br>En cas d'empêchement, merci de nous prévenir dès que possible.</p>
    """
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": f"Rendez-vous confirmé — {tenant_name}",
        "html": _tenant_email_wrapper(tenant_name, body, primary_color=primary_color, logo_url=logo_url, logo_option=logo_option),
    })


def send_appointment_cancellation(
    contact_email: str,
    contact_name: str,
    appointment: dict,
    tenant_name: str,
    booking_url: str = "",
    was_pending: bool = False,
    tz_name: str = "UTC",
    primary_color: str = "",
    logo_url: str = "",
    logo_option: str = "text_only",
) -> None:
    """
    Email au client lors d'une annulation ou d'un refus de RDV.
    - was_pending=True : le professionnel n'a pas validé la demande → propose de rechoisir
    - was_pending=False : RDV confirmé annulé → propose de recontacter
    """
    date_str = _fmt_dt(appointment.get("scheduled_at", ""), tz_name)

    party_size = appointment.get("party_size", 1)
    group_line = f"<p>Réservation concernée : <strong>{party_size} personnes</strong>.</p>" if party_size > 1 else ""

    if was_pending:
        subject = f"Votre demande de rendez-vous — {tenant_name}"
        cta = f'<div style="text-align:center;margin-top:20px"><a href="{booking_url}" style="{_BTN}">Choisir un autre créneau →</a></div>' if booking_url else ""
        body = f"""
          <div style="text-align:center;margin-bottom:20px">
            <div style="display:inline-block;width:52px;height:52px;border-radius:50%;background:#fff3cd;line-height:52px;font-size:24px">⚠</div>
          </div>
          <h2 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 12px;text-align:center">Demande non confirmée</h2>
          <p style="color:#374151;font-size:14px;line-height:1.65;margin:0 0 16px">
            Bonjour <strong>{contact_name}</strong>,<br><br>
            Votre demande de rendez-vous avec <strong>{tenant_name}</strong> pour le <strong>{date_str}</strong>
            n'a malheureusement pas pu être acceptée.
          </p>
          {f'<p style="color:#374151;font-size:14px;margin:0 0 4px">Réservation concernée : <strong>{party_size} personnes</strong>.</p>' if party_size > 1 else ""}
          <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0 0 4px">Vous pouvez choisir un autre créneau directement en ligne.</p>
          {cta}
        """
    else:
        subject = f"Annulation de votre rendez-vous — {tenant_name}"
        cta = f'<div style="text-align:center;margin-top:20px"><a href="{booking_url}" style="{_BTN}">Reprendre rendez-vous →</a></div>' if booking_url else ""
        body = f"""
          <div style="text-align:center;margin-bottom:20px">
            <div style="display:inline-block;width:52px;height:52px;border-radius:50%;background:#fee2e2;line-height:52px;font-size:24px">✕</div>
          </div>
          <h2 style="color:#111827;font-size:18px;font-weight:700;margin:0 0 12px;text-align:center">Rendez-vous annulé</h2>
          <p style="color:#374151;font-size:14px;line-height:1.65;margin:0 0 16px">
            Bonjour <strong>{contact_name}</strong>,<br><br>
            Votre rendez-vous avec <strong>{tenant_name}</strong> prévu le <strong>{date_str}</strong> a été annulé.
          </p>
          <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">N'hésitez pas à reprendre contact pour convenir d'une nouvelle date.</p>
          {cta}
        """

    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": subject,
        "html": _tenant_email_wrapper(tenant_name, body, primary_color=primary_color, logo_url=logo_url, logo_option=logo_option),
    })


def send_team_invite(email: str, tenant_name: str, invite_url: str, role: str) -> None:
    role_labels = {
        "owner": "Propriétaire",
        "admin": "Administrateur",
        "member": "Membre",
        "secretary": "Secrétaire",
    }
    role_label = role_labels.get(role, role.capitalize())
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [email],
        "subject": f"Invitation à rejoindre {tenant_name} sur Klientys",
        "html": f"""
        <div style="font-family:'DM Sans',Arial,sans-serif;max-width:520px;margin:0 auto;background:#040E15;color:#EEF2F5;padding:40px 36px;border-radius:16px">
          <img src="https://klientys.co/logo.png" height="36" style="margin-bottom:28px"/>
          <h2 style="font-size:20px;font-weight:800;margin:0 0 12px;letter-spacing:-.02em">
            Vous avez été invité(e) à rejoindre une équipe
          </h2>
          <p style="color:#AAC0D8;font-size:15px;line-height:1.6;margin:0 0 8px">
            <strong style="color:#DDAA40">{tenant_name}</strong> vous invite à rejoindre son espace Klientys en tant que <strong style="color:#EEF2F5">{role_label}</strong>.
          </p>
          <p style="color:#AAC0D8;font-size:13px;line-height:1.6;margin:0 0 28px">
            Invitation envoyée à : <strong style="color:#EEF2F5">{email}</strong><br/>
            Ce lien expire dans <strong style="color:#EEF2F5">7 jours</strong>.
          </p>
          <a href="{invite_url}"
             style="display:inline-block;background:#DDAA40;color:#07222F;padding:13px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
            Accepter l'invitation →
          </a>
          <p style="color:#5C7A8A;font-size:12px;margin-top:36px;line-height:1.6">
            Si vous n'attendiez pas cette invitation, ignorez cet email — aucune action n'est requise.
          </p>
          <hr style="border:none;border-top:1px solid rgba(170,189,216,.12);margin:24px 0"/>
          <p style="color:#5C7A8A;font-size:11px;margin:0">
            Klientys · <a href="https://klientys.co" style="color:#2A8FA5;text-decoration:none">klientys.co</a>
          </p>
        </div>
        """,
    })


def send_lead_acknowledgement(
    contact_email: str,
    contact_name: str,
    tenant_name: str,
    primary_color: str = "",
    logo_url: str = "",
    logo_option: str = "text_only",
) -> None:
    """Accuse de réception au prospect après soumission du formulaire de contact."""
    body = f"""
      <div style="text-align:center;margin-bottom:20px">
        <div style="display:inline-block;width:52px;height:52px;border-radius:50%;background:#e6f9f0;line-height:52px;font-size:24px">✓</div>
      </div>
      <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 8px;text-align:center">Merci, {contact_name} !</h2>
      <p style="color:#374151;font-size:14px;line-height:1.65;margin:0 0 16px;text-align:center">
        Votre message a bien été reçu par <strong>{tenant_name}</strong>.
      </p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:14px 18px">
        <p style="color:#374151;font-size:13px;line-height:1.6;margin:0">
          Nous examinerons votre demande et vous recontacterons dans les meilleurs délais.<br>
          Si vous avez une urgence, n'hésitez pas à nous appeler directement.
        </p>
      </div>
    """
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": f"{tenant_name} — Votre message a bien été reçu",
        "html": _tenant_email_wrapper(tenant_name, body, primary_color=primary_color, logo_url=logo_url, logo_option=logo_option),
    })


def send_support_account_invite(email: str, role: str, setup_link: str) -> None:
    role_labels = {"viewer": "Observateur (lecture seule)", "support": "Support opérationnel"}
    role_label = role_labels.get(role, role)
    role_perms = {
        "viewer":  "Vous pouvez consulter les informations des tenants et les logs.",
        "support": "Vous pouvez consulter les informations des tenants, confirmer les emails, réinitialiser les mots de passe, prolonger les périodes d'essai, synchroniser Stripe et réinitialiser les domaines.",
    }
    perms_text = role_perms.get(role, "")
    setup_block = f"""
      <p style="color:#AAC0D8;font-size:14px;line-height:1.65;margin:0 0 20px">
        Définissez votre mot de passe pour accéder au panel :
      </p>
      <div style="text-align:center;margin-bottom:16px">
        <a href="{setup_link}" style="{_BTN_GOLD}">Définir mon mot de passe →</a>
      </div>
      <p style="color:#5C7A8A;font-size:12px;text-align:center;margin:0">Ce lien est valable 24h.</p>
    """ if setup_link else ""
    header = """
    <div style="background:linear-gradient(135deg,#07222F 0%,#0D4B58 100%);padding:28px 32px;border-bottom:1px solid rgba(221,170,64,.3)">
      <p style="color:#DDAA40;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 4px">Accès interne</p>
      <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0;letter-spacing:-.02em">Compte support Klientys</h1>
    </div>"""
    body = f"""
      <p style="color:#EEF2F5;font-size:14px;line-height:1.65;margin:0 0 20px">
        Un compte support vous a été créé avec le niveau <strong style="color:#DDAA40">{role_label}</strong>.
      </p>
      <div style="background:rgba(13,75,88,.35);border:1px solid rgba(26,110,130,.4);border-radius:10px;padding:14px 18px;margin-bottom:24px">
        <p style="color:#8BA5B5;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:0 0 6px">Vos permissions</p>
        <p style="color:#AAC0D8;font-size:13px;line-height:1.6;margin:0">{perms_text}</p>
      </div>
      {setup_block}
    """
    footer = '<p style="color:#5C7A8A;font-size:12px;margin:0">Cet email est confidentiel et destiné uniquement à son destinataire.</p>'
    resend.Emails.send({
        "from": f"Klientys Admin <{settings.email_from}>",
        "to": [email],
        "subject": "Votre accès support Klientys",
        "html": _klientys_email_wrapper(header, body, footer),
    })


def send_impersonation_notice(tenant_email: str, tenant_name: str, admin_email: str, accessed_at: str) -> None:
    """Notifie le tenant qu'un administrateur Klientys a accédé à son compte."""
    header = """
    <div style="background:linear-gradient(135deg,#78350f 0%,#b45309 100%);padding:28px 32px">
      <p style="color:rgba(255,255,255,.7);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;margin:0 0 4px">Sécurité</p>
      <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0;letter-spacing:-.02em">Accès administrateur à votre compte</h1>
    </div>"""
    body = f"""
      <p style="color:#EEF2F5;font-size:14px;line-height:1.65;margin:0 0 20px">
        Un administrateur Klientys a accédé à votre espace <strong style="color:#DDAA40">{tenant_name}</strong>
        le <strong>{accessed_at}</strong> à des fins de support ou de maintenance.
      </p>
      <div style="background:rgba(221,170,64,.08);border:1px solid rgba(221,170,64,.25);border-radius:10px;padding:14px 18px;margin-bottom:20px">
        <p style="color:#AAC0D8;font-size:13px;line-height:1.6;margin:0">
          Cet accès est strictement encadré par nos
          <a href="https://klientys.co/legal/cgu" style="color:#2A8FA5;text-decoration:none">Conditions Générales d'Utilisation</a>
          (article 13). Il est tracé et auditable. Aucune donnée bancaire n'est accessible par ce biais.
        </p>
      </div>
      <p style="color:#8BA5B5;font-size:13px;line-height:1.6;margin:0">
        Si vous n'avez pas sollicité de support et que cet accès vous semble anormal, contactez-nous immédiatement à
        <a href="mailto:support@klientys.co" style="color:#2A8FA5;text-decoration:none">support@klientys.co</a>.
      </p>
    """
    footer = '<p style="color:#5C7A8A;font-size:12px;margin:0">Klientys SRL — Ce message est généré automatiquement.</p>'
    resend.Emails.send({
        "from": f"Klientys Sécurité <{settings.email_from}>",
        "to": [tenant_email],
        "subject": "Accès administrateur à votre compte Klientys",
        "html": _klientys_email_wrapper(header, body, footer),
    })


def send_booking_request_received(
    contact_email: str,
    contact_name: str,
    appointment: dict,
    tenant_name: str,
    tz_name: str = "UTC",
    primary_color: str = "",
    logo_url: str = "",
    logo_option: str = "text_only",
) -> None:
    """Accuse de réception au client après une demande de rendez-vous (statut pending)."""
    date_str = _fmt_dt(appointment.get("scheduled_at", ""), tz_name)
    body = f"""
      <div style="text-align:center;margin-bottom:20px">
        <div style="display:inline-block;width:52px;height:52px;border-radius:50%;background:#e6f9f0;line-height:52px;font-size:24px">✓</div>
      </div>
      <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 8px;text-align:center">Demande reçue !</h2>
      <p style="color:#374151;font-size:14px;line-height:1.65;margin:0 0 20px;text-align:center">
        Bonjour <strong>{contact_name}</strong>, votre demande a bien été enregistrée.
      </p>
      <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:16px 20px;margin-bottom:20px">
        <p style="color:#374151;font-size:13px;margin:0 0 6px"><strong>Avec</strong> : {tenant_name}</p>
        <p style="color:#0D4B58;font-size:15px;font-weight:700;margin:0">{date_str}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">
        Le professionnel va examiner votre demande et vous enverra une confirmation par email.<br>
        Si vous ne pouvez finalement pas vous déplacer, merci de nous le signaler dès que possible.
      </p>
    """
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": f"{tenant_name} — Votre demande de rendez-vous a été reçue",
        "html": _tenant_email_wrapper(tenant_name, body, primary_color=primary_color, logo_url=logo_url, logo_option=logo_option),
    })


def send_appointment_reminder(
    contact_email: str,
    contact_name: str,
    appointment: dict,
    tenant_name: str,
    primary_color: str = "",
    logo_url: str = "",
    logo_option: str = "text_only",
) -> None:
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(appointment.get("scheduled_at", "").replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = appointment.get("scheduled_at", "—")
    body = f"""
      <div style="text-align:center;margin-bottom:20px">
        <div style="display:inline-block;width:52px;height:52px;border-radius:50%;background:#fef3c7;line-height:52px;font-size:24px">🔔</div>
      </div>
      <h2 style="color:#111827;font-size:20px;font-weight:700;margin:0 0 8px;text-align:center">Rappel de rendez-vous</h2>
      <p style="color:#374151;font-size:14px;line-height:1.65;margin:0 0 20px;text-align:center">
        Bonjour <strong>{contact_name}</strong>, votre rendez-vous est demain !
      </p>
      <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:10px;padding:16px 20px;margin-bottom:16px">
        <p style="color:#374151;font-size:13px;margin:0 0 6px"><strong>Avec</strong> : {tenant_name}</p>
        <p style="color:#92400e;font-size:15px;font-weight:700;margin:0">{date_str}</p>
      </div>
      <p style="color:#6b7280;font-size:13px;line-height:1.6;margin:0">En cas d'empêchement, merci de nous prévenir dès que possible.</p>
    """
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": f"Rappel — votre rendez-vous demain avec {tenant_name}",
        "html": _tenant_email_wrapper(tenant_name, body, primary_color=primary_color, logo_url=logo_url, logo_option=logo_option),
    })


def send_reactivation_relance(email: str, tenant_name: str, tenant_slug: str, dashboard_url: str, site_url: str) -> None:
    """Email de réengagement envoyé au propriétaire d'un tenant inactif depuis 30+ jours."""
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [email],
        "subject": f"Votre espace {tenant_name} vous attend sur Klientys",
        "html": f"""
        <div style="font-family:Inter,Arial,sans-serif;background:#f4f6f8;padding:40px 20px">
          <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.06)">
            <div style="background:linear-gradient(135deg,#0D4B58 0%,#1A6E82 100%);padding:32px 40px">
              <h1 style="color:#fff;font-size:20px;margin:0;font-weight:700">On a pensé à vous 👋</h1>
              <p style="color:rgba(255,255,255,0.7);margin:6px 0 0;font-size:13px">Klientys — Votre espace professionnel</p>
            </div>
            <div style="padding:32px 40px">
              <p style="color:#1a2733;font-size:16px;line-height:1.6;margin:0 0 16px">Bonjour,</p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 16px">
                Votre espace <strong style="color:#0D4B58">{tenant_name}</strong> n'a pas été consulté depuis un moment.
                Vos clients, vos rendez-vous et votre site vitrine vous attendent !
              </p>
              <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 20px">
                Besoin d'aide pour reprendre en main votre espace ?
                Notre équipe support est disponible pour vous accompagner.
              </p>

              <div style="background:#fff8ed;border:1px solid #f59e0b;border-radius:8px;padding:14px 16px;margin-bottom:24px">
                <p style="color:#92400e;font-size:13px;line-height:1.6;margin:0">
                  ⚠️ <strong>Important :</strong> sans connexion de votre part dans les 10 prochains jours,
                  votre site vitrine sera automatiquement dépublié et ne sera plus accessible au public.
                </p>
              </div>

              <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
                <a href="{dashboard_url}" style="display:inline-block;background:#1A6E82;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">
                  Accéder à mon espace →
                </a>
                <a href="{site_url}" style="display:inline-block;background:#f4f6f8;color:#0D4B58;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;border:1px solid #d1d9e0">
                  Voir mon site vitrine →
                </a>
              </div>

              <hr style="border:none;border-top:1px solid #e8ecf0;margin:28px 0 16px">
              <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0">
                Vous recevez cet email car vous avez un compte sur Klientys.
                Pour toute question : <a href="mailto:support@klientys.co" style="color:#1A6E82">support@klientys.co</a>
              </p>
            </div>
          </div>
        </div>
        """,
    })


def send_design_request_admin(
    tenant_name: str,
    site_name: str,
    is_additional: bool,
    message: str,
    request_id: str,
) -> None:
    label = "site supplémentaire (payant)" if is_additional else "1er site inclus dans le plan Business"
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [settings.email_from],
        "subject": f"[Klientys] Nouvelle demande de refonte design — {tenant_name}",
        "html": f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
          <h2 style="color:#07222F;margin-bottom:4px">Nouvelle demande de refonte design</h2>
          <p style="color:#6b7280;font-size:13px;margin-top:0">Demande #{request_id[:8]}</p>
          <table style="width:100%;border-collapse:collapse;margin:24px 0">
            <tr><td style="padding:8px 0;font-size:14px;color:#374151;width:140px"><strong>Tenant</strong></td><td style="padding:8px 0;font-size:14px;color:#374151">{tenant_name}</td></tr>
            <tr><td style="padding:8px 0;font-size:14px;color:#374151"><strong>Site</strong></td><td style="padding:8px 0;font-size:14px;color:#374151">{site_name or '—'}</td></tr>
            <tr><td style="padding:8px 0;font-size:14px;color:#374151"><strong>Type</strong></td><td style="padding:8px 0;font-size:14px;color:#374151">{label}</td></tr>
          </table>
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px">
            <p style="margin:0 0 6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af">Message du tenant</p>
            <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;white-space:pre-wrap">{message}</p>
          </div>
          <a href="{settings.frontend_url}/admin/design-requests" style="background:#0D4B58;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
            Voir dans le panel admin →
          </a>
        </div>
        """,
    })


def send_password_changed(user_email: str) -> None:
    """Email de confirmation envoyé à l'utilisateur après un changement de mot de passe réussi."""
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [user_email],
        "subject": "Votre mot de passe Klientys a été modifié",
        "html": f"""
        <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#07222F;color:#EEF2F5;padding:40px 36px;border-radius:16px">
          <img src="{settings.frontend_url}/logo.png" height="36" style="margin-bottom:28px"/>
          <h2 style="font-size:20px;font-weight:800;margin:0 0 12px;letter-spacing:-.02em">
            Mot de passe modifié ✓
          </h2>
          <p style="color:#AAC0D8;font-size:15px;line-height:1.6;margin:0 0 24px">
            Votre mot de passe Klientys a bien été mis à jour. Vous pouvez vous connecter avec votre nouveau mot de passe.
          </p>
          <a href="{settings.frontend_url}/login"
             style="display:inline-block;background:#DDAA40;color:#07222F;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">
            Accéder à mon tableau de bord →
          </a>
          <p style="color:#5C7A8A;font-size:12px;margin-top:32px;line-height:1.6">
            Si vous n'avez pas effectué cette modification, contactez-nous immédiatement à
            <a href="mailto:support@klientys.co" style="color:#2A8FA5;text-decoration:none">support@klientys.co</a>.
          </p>
        </div>
        """,
    })


def send_logo_request_admin(
    tenant_name: str,
    brief: dict,
    price_tier: str,
    price_eur: float,
    request_id: str,
) -> None:
    tier_labels = {"essentiel": "Essentiel", "standard": "Standard", "premium": "Premium"}
    tier_label = tier_labels.get(price_tier, price_tier)
    brief_rows = "".join(
        f"<tr><td style='padding:6px 0;font-size:13px;color:#6b7280;width:140px;text-transform:capitalize'>{k.replace('_', ' ')}</td>"
        f"<td style='padding:6px 0;font-size:13px;color:#374151'>{', '.join(v) if isinstance(v, list) else v}</td></tr>"
        for k, v in brief.items()
        if k not in ("recommended_tier",) and v
    )
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [settings.email_from],
        "subject": f"[Klientys] Nouvelle demande de logo — {tenant_name} ({tier_label} · {price_eur:.0f}€)",
        "html": f"""
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px 24px;background:#fff">
          <h2 style="color:#07222F;margin-bottom:4px">Nouvelle demande de création de logo</h2>
          <p style="color:#6b7280;font-size:13px;margin-top:0">#{request_id[:8]} — {tenant_name}</p>
          <div style="background:#DDAA4015;border:1px solid #DDAA40;border-radius:8px;padding:12px 16px;margin:20px 0;display:flex;align-items:center;gap:12px">
            <span style="font-size:20px">🎨</span>
            <div>
              <p style="margin:0;font-weight:600;color:#07222F">{tier_label} — {price_eur:.0f} €</p>
              <p style="margin:2px 0 0;font-size:12px;color:#6b7280">En attente de paiement par le tenant</p>
            </div>
          </div>
          <h3 style="font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#9ca3af;margin:20px 0 8px">Brief collecté par l'IA</h3>
          <table style="width:100%;border-collapse:collapse">{brief_rows}</table>
          <div style="margin-top:28px">
            <a href="{settings.frontend_url}/admin/logo-requests" style="background:#0D4B58;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;display:inline-block">
              Voir dans le panel admin →
            </a>
          </div>
        </div>
        """,
    })


# ── CRM — Relance client ──────────────────────────────────────────────────────

def _crm_lang(country: str) -> str:
    """Déduit la langue de l'email depuis le pays du tenant."""
    c = (country or "").upper()
    if c in ("FR", "BE", "CH", "LU", "MC", "SN", "CI", "CM"):
        return "fr"
    if c in ("DE", "AT"):
        return "de"
    if c in ("NL",):
        return "nl"
    return "en"


_CRM_TEMPLATES: dict[str, dict[str, dict[str, str]]] = {
    "fr": {
        "post_service": {
            "subject": "Comment s'est passée votre dernière visite ?",
            "intro": "Suite à votre dernière visite, je souhaitais prendre de vos nouvelles.",
        },
        "reactivation": {
            "subject": "On vous a pas vu depuis un moment !",
            "intro": "Cela fait quelque temps que nous ne nous sommes pas vus. J'espère que vous allez bien.",
        },
        "quote_followup": {
            "subject": "Votre devis en attente",
            "intro": "Je reviens vers vous au sujet du devis que je vous ai transmis récemment.",
        },
        "payment": {
            "subject": "Rappel de règlement",
            "intro": "Je me permets de vous relancer concernant une facture en attente de règlement.",
        },
        "health_reminder": {
            "subject": "Pensez à votre suivi",
            "intro": "Il est temps de penser à votre prochain suivi. Ne tardez pas trop !",
        },
        "promo": {
            "subject": "Une offre préparée pour vous",
            "intro": "Je vous contacte pour vous faire part d'une offre spéciale.",
        },
        "custom": {
            "subject": "",
            "intro": "",
        },
    },
    "en": {
        "post_service": {
            "subject": "How was your last session?",
            "intro": "Following your last visit, I wanted to check in with you.",
        },
        "reactivation": {
            "subject": "We haven't seen you in a while!",
            "intro": "It's been a while since we last met. Hope you're doing well.",
        },
        "quote_followup": {
            "subject": "Your pending quote",
            "intro": "I'm following up on the quote I recently sent you.",
        },
        "payment": {
            "subject": "Payment reminder",
            "intro": "I'm reaching out regarding an outstanding invoice.",
        },
        "health_reminder": {
            "subject": "Time for your follow-up",
            "intro": "It's time to think about your next check-up. Don't wait too long!",
        },
        "promo": {
            "subject": "A special offer for you",
            "intro": "I'm getting in touch to share a special offer I've prepared for you.",
        },
        "custom": {
            "subject": "",
            "intro": "",
        },
    },
    "de": {
        "post_service": {
            "subject": "Wie war Ihr letzter Besuch?",
            "intro": "Im Anschluss an Ihren letzten Besuch wollte ich nachfragen, wie es Ihnen geht.",
        },
        "reactivation": {
            "subject": "Wir haben Sie eine Weile nicht gesehen!",
            "intro": "Es ist eine Weile her, dass wir uns zuletzt gesehen haben. Ich hoffe, es geht Ihnen gut.",
        },
        "quote_followup": {
            "subject": "Ihr ausstehendes Angebot",
            "intro": "Ich melde mich wegen des Angebots, das ich Ihnen kürzlich geschickt habe.",
        },
        "payment": {
            "subject": "Zahlungserinnerung",
            "intro": "Ich wende mich wegen einer ausstehenden Rechnung an Sie.",
        },
        "health_reminder": {
            "subject": "Zeit für Ihre nächste Kontrolle",
            "intro": "Es ist an der Zeit, an Ihre nächste Kontrolle zu denken. Warten Sie nicht zu lange!",
        },
        "promo": {
            "subject": "Ein Angebot für Sie",
            "intro": "Ich melde mich, um Ihnen ein besonderes Angebot mitzuteilen.",
        },
        "custom": {
            "subject": "",
            "intro": "",
        },
    },
    "nl": {
        "post_service": {
            "subject": "Hoe was uw laatste bezoek?",
            "intro": "Na uw laatste bezoek wilde ik even polsen hoe het met u gaat.",
        },
        "reactivation": {
            "subject": "We hebben u al een tijdje niet gezien!",
            "intro": "Het is een tijdje geleden dat we elkaar hebben gezien. Ik hoop dat alles goed met u gaat.",
        },
        "quote_followup": {
            "subject": "Uw openstaande offerte",
            "intro": "Ik neem contact met u op over de offerte die ik u onlangs heb gestuurd.",
        },
        "payment": {
            "subject": "Betalingsherinnering",
            "intro": "Ik neem contact met u op in verband met een openstaande factuur.",
        },
        "health_reminder": {
            "subject": "Tijd voor uw opvolging",
            "intro": "Het is tijd om aan uw volgende opvolging te denken. Wacht niet te lang!",
        },
        "promo": {
            "subject": "Een aanbod voor u",
            "intro": "Ik neem contact met u op om u een speciaal aanbod te delen.",
        },
        "custom": {
            "subject": "",
            "intro": "",
        },
    },
}

_CRM_I18N: dict[str, dict[str, str]] = {
    "fr": {
        "greeting":   "Bonjour {first_name},",
        "cta":        "Prendre rendez-vous →",
        "sign":       "Cordialement,",
        "footer":     "Vous recevez cet email car vous êtes client(e) de {tenant}.",
        "subject_fallback": "Message de {tenant}",
    },
    "en": {
        "greeting":   "Hello {first_name},",
        "cta":        "Book an appointment →",
        "sign":       "Best regards,",
        "footer":     "You're receiving this email because you are a customer of {tenant}.",
        "subject_fallback": "Message from {tenant}",
    },
    "de": {
        "greeting":   "Guten Tag {first_name},",
        "cta":        "Termin buchen →",
        "sign":       "Mit freundlichen Grüßen,",
        "footer":     "Sie erhalten diese E-Mail, weil Sie Kunde von {tenant} sind.",
        "subject_fallback": "Nachricht von {tenant}",
    },
    "nl": {
        "greeting":   "Goedendag {first_name},",
        "cta":        "Afspraak maken →",
        "sign":       "Met vriendelijke groet,",
        "footer":     "U ontvangt deze e-mail omdat u klant bent van {tenant}.",
        "subject_fallback": "Bericht van {tenant}",
    },
}


# Mapping couleurs Tailwind → hex (champ primary_color du site_style tenant)
_TAILWIND_HEX: dict[str, str] = {
    "indigo":  "#4f46e5",
    "blue":    "#2563eb",
    "teal":    "#0d9488",
    "green":   "#16a34a",
    "purple":  "#7c3aed",
    "pink":    "#db2777",
    "orange":  "#ea580c",
    "red":     "#dc2626",
    "yellow":  "#ca8a04",
    "gray":    "#6b7280",
    "slate":   "#475569",
    "cyan":    "#0891b2",
    "emerald": "#059669",
    "violet":  "#7c3aed",
    "rose":    "#e11d48",
    "amber":   "#d97706",
    "sky":     "#0284c7",
    "lime":    "#65a30d",
}
_DEFAULT_BRAND = "#0D4B58"


def _hex(color_name: str) -> str:
    return _TAILWIND_HEX.get((color_name or "").lower(), _DEFAULT_BRAND)


def build_crm_reminder_preview(
    country: str,
    reminder_type: str,
    tenant_name: str,
    contact_first_name: str,
    note: str,
) -> dict:
    """
    Retourne le sujet et le corps en texte brut pour pré-remplir
    la modale d'édition avant envoi (sans envoyer l'email).
    """
    lang  = _crm_lang(country)
    tpl   = _CRM_TEMPLATES.get(lang, _CRM_TEMPLATES["fr"]).get(reminder_type, _CRM_TEMPLATES["fr"]["custom"])
    i18n  = _CRM_I18N.get(lang, _CRM_I18N["fr"])

    subject = tpl["subject"] or i18n["subject_fallback"].format(tenant=tenant_name)

    parts: list[str] = []
    if tpl["intro"]:
        parts.append(tpl["intro"])
    if note and note.strip():
        if parts:
            parts.append("")  # ligne vide entre intro et note
        parts.append(note.strip())

    return {"subject": subject, "body": "\n".join(parts)}


def send_crm_reminder_to_contact(
    contact_email: str,
    contact_first_name: str,
    tenant_name: str,
    tenant_country: str,
    reminder_type: str,
    note: str,
    booking_url: str = "",
    # Charte graphique du tenant (depuis site.site_style)
    primary_color: str = "",      # nom Tailwind, ex: "indigo"
    logo_url: str = "",
    logo_option: str = "text_only",
    subject_override: str = "",   # permet à la modale d'envoyer un sujet édité
    message_override: str = "",   # idem pour le corps
    reply_url: str = "",          # mailto: ou URL formulaire de contact du tenant
) -> None:
    """
    Envoie une relance CRM au contact (client) au nom du tenant,
    avec la charte graphique du site (couleur, logo).
    """
    lang  = _crm_lang(tenant_country)
    tpl   = _CRM_TEMPLATES.get(lang, _CRM_TEMPLATES["fr"]).get(reminder_type, _CRM_TEMPLATES["fr"]["custom"])
    i18n  = _CRM_I18N.get(lang, _CRM_I18N["fr"])
    brand = _hex(primary_color)

    subject  = subject_override or tpl["subject"] or i18n["subject_fallback"].format(tenant=tenant_name)
    greeting = i18n["greeting"].format(first_name=contact_first_name)
    sign     = i18n["sign"]
    footer   = i18n["footer"].format(tenant=tenant_name)
    cta_text = i18n["cta"]

    # Corps du message : override (modale) ou intro_type + note
    body_text = message_override.strip() if message_override and message_override.strip() else None

    intro_block = ""
    note_block  = ""
    if body_text:
        # Texte libre édité par le tenant dans la modale
        note_block = (
            f'<div style="margin:16px 0;padding:14px 18px;background:#f8fafc;'
            f'border-left:4px solid {brand};border-radius:4px">'
            f'<p style="margin:0;color:#1e293b;white-space:pre-wrap;line-height:1.65">{body_text}</p>'
            f'</div>'
        )
    else:
        if tpl["intro"]:
            intro_block = f'<p style="color:#374151;line-height:1.7;margin:0 0 14px">{tpl["intro"]}</p>'
        if note and note.strip():
            note_block = (
                f'<div style="margin:16px 0;padding:14px 18px;background:#f8fafc;'
                f'border-left:4px solid {brand};border-radius:4px">'
                f'<p style="margin:0;color:#1e293b;white-space:pre-wrap;line-height:1.65">{note.strip()}</p>'
                f'</div>'
            )

    cta_btn = f"background:{brand};color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block"
    cta_block = (
        f'<div style="margin:24px 0"><a href="{booking_url}" style="{cta_btn}">{cta_text}</a></div>'
        if booking_url else ""
    )

    # En-tête : logo image ou nom en texte coloré
    if logo_url and logo_option == "image":
        header_block = (
            f'<div style="margin-bottom:28px">'
            f'<img src="{logo_url}" alt="{tenant_name}" style="max-height:56px;max-width:200px;object-fit:contain">'
            f'</div>'
        )
    else:
        header_block = (
            f'<div style="margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid {brand}">'
            f'<span style="font-size:20px;font-weight:700;color:{brand}">{tenant_name}</span>'
            f'</div>'
        )

    reply_block = (
        f'<p style="color:#9ca3af;font-size:12px;margin:8px 0 0">'
        f'<a href="{reply_url}" style="color:#6b7280;text-decoration:underline">'
        f'Pour répondre à ce message, cliquez ici →</a></p>'
    ) if reply_url else ""

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff">
      {header_block}
      <p style="color:#374151;line-height:1.7;margin:0 0 14px">{greeting}</p>
      {intro_block}
      {note_block}
      {cta_block}
      <p style="color:#374151;line-height:1.7;margin:24px 0 2px">{sign}</p>
      <p style="color:{brand};font-weight:600;margin:0">{tenant_name}</p>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px">
      <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0">{footer}</p>
      {reply_block}
    </div>
    """

    resend.Emails.send({
        "from":    f"{tenant_name} <{settings.email_from}>",
        "to":      [contact_email],
        "subject": subject,
        "html":    html,
    })


# ── Emails onboarding & trial ────────────────────────────────────────────────

_WELCOME_I18N: dict[str, dict[str, str]] = {
    "fr": {
        "subject":      "Bienvenue sur Klientys, {name} 🎉",
        "header_sub":   "Votre espace professionnel est prêt.",
        "title":        "C'est parti, {name} !",
        "trial_badge":  "✦ Essai gratuit de 14 jours",
        "intro":        "Votre espace <strong>{tenant}</strong> vient d'être créé. Voici les 3 premières choses à faire pour en tirer le meilleur parti.",
        "s1_title":     "1. Personnalisez votre site vitrine",
        "s1_desc":      "Ajoutez votre logo, vos prestations, vos coordonnées et publiez en un clic.",
        "s1_cta":       "Créer mon site →",
        "s2_title":     "2. Définissez vos disponibilités",
        "s2_desc":      "Indiquez vos horaires pour que vos clients puissent réserver en ligne 24h/24.",
        "s2_cta":       "Configurer mes horaires →",
        "s3_title":     "3. Partagez votre lien",
        "s3_desc":      "Votre page est accessible immédiatement — partagez-la sur vos réseaux.",
        "s3_cta":       "Voir mon site →",
        "footer":       "Vous recevez cet email car vous venez de créer un compte Klientys.",
        "help":         "Une question ? Écrivez-nous :",
    },
    "en": {
        "subject":      "Welcome to Klientys, {name} 🎉",
        "header_sub":   "Your professional space is ready.",
        "title":        "Let's go, {name}!",
        "trial_badge":  "✦ 14-day free trial",
        "intro":        "Your space <strong>{tenant}</strong> has just been created. Here are the 3 first things to do to get the most out of it.",
        "s1_title":     "1. Customize your website",
        "s1_desc":      "Add your logo, services, contact details and publish with one click.",
        "s1_cta":       "Create my website →",
        "s2_title":     "2. Set your availability",
        "s2_desc":      "Add your working hours so clients can book online 24/7.",
        "s2_cta":       "Set up my schedule →",
        "s3_title":     "3. Share your link",
        "s3_desc":      "Your page is immediately accessible — share it on your social media.",
        "s3_cta":       "View my website →",
        "footer":       "You received this email because you just created a Klientys account.",
        "help":         "Any questions? Email us:",
    },
    "de": {
        "subject":      "Willkommen bei Klientys, {name} 🎉",
        "header_sub":   "Ihr professioneller Bereich ist bereit.",
        "title":        "Los geht's, {name}!",
        "trial_badge":  "✦ 14 Tage kostenlose Testphase",
        "intro":        "Ihr Bereich <strong>{tenant}</strong> wurde soeben erstellt. Hier sind die 3 ersten Schritte.",
        "s1_title":     "1. Passen Sie Ihre Website an",
        "s1_desc":      "Fügen Sie Logo, Leistungen und Kontaktdaten hinzu und veröffentlichen Sie mit einem Klick.",
        "s1_cta":       "Meine Website erstellen →",
        "s2_title":     "2. Legen Sie Ihre Verfügbarkeit fest",
        "s2_desc":      "Tragen Sie Ihre Arbeitszeiten ein, damit Kunden rund um die Uhr online buchen können.",
        "s2_cta":       "Meine Zeiten einrichten →",
        "s3_title":     "3. Teilen Sie Ihren Link",
        "s3_desc":      "Ihre Seite ist sofort zugänglich — teilen Sie sie in sozialen Netzwerken.",
        "s3_cta":       "Meine Website ansehen →",
        "footer":       "Sie erhalten diese E-Mail, weil Sie gerade ein Klientys-Konto erstellt haben.",
        "help":         "Fragen? Schreiben Sie uns:",
    },
    "nl": {
        "subject":      "Welkom bij Klientys, {name} 🎉",
        "header_sub":   "Uw professionele ruimte is klaar.",
        "title":        "Aan de slag, {name}!",
        "trial_badge":  "✦ 14 dagen gratis proefperiode",
        "intro":        "Uw ruimte <strong>{tenant}</strong> is zojuist aangemaakt. Hier zijn de 3 eerste stappen.",
        "s1_title":     "1. Pas uw website aan",
        "s1_desc":      "Voeg uw logo, diensten en contactgegevens toe en publiceer met één klik.",
        "s1_cta":       "Mijn website maken →",
        "s2_title":     "2. Stel uw beschikbaarheid in",
        "s2_desc":      "Voer uw werktijden in zodat klanten 24/7 online kunnen boeken.",
        "s2_cta":       "Mijn uren instellen →",
        "s3_title":     "3. Deel uw link",
        "s3_desc":      "Uw pagina is onmiddellijk toegankelijk — deel hem op uw sociale media.",
        "s3_cta":       "Mijn website bekijken →",
        "footer":       "U ontvangt deze e-mail omdat u zojuist een Klientys-account heeft aangemaakt.",
        "help":         "Vragen? Schrijf ons:",
    },
}

_TRIAL_I18N: dict[str, dict] = {
    "fr": {
        "subjects": {
            7: "Vous avancez bien — il reste 7 jours d'essai ✨",
            3: "Plus que 3 jours pour passer à la vitesse supérieure ⏳",
            1: "Dernier jour d'essai — ne perdez pas votre travail ⚠️",
        },
        "titles": {
            7: "Vous avancez bien ! 🚀",
            3: "Plus que 3 jours ⏳",
            1: "Dernier jour d'essai ⚠️",
        },
        "intros": {
            7: "Votre essai gratuit se termine dans <strong>7 jours</strong>. Voici un résumé de ce que vous avez déjà mis en place :",
            3: "Votre essai se termine dans <strong>3 jours</strong>. Choisissez un plan pour ne rien perdre et continuer à recevoir des réservations.",
            1: "C'est votre <strong>dernier jour d'essai</strong>. Demain, votre espace sera limité et votre site ne sera plus accessible au public.",
        },
        "summary_title": "Votre activité pendant l'essai",
        "contacts":      "contact(s)",
        "leads":         "demande(s) reçue(s)",
        "appointments":  "rendez-vous",
        "cta":           "Choisir mon plan →",
        "footer":        "Vous recevez cet email car votre période d'essai Klientys touche à sa fin.",
        "no_action":     "Si vous ne souhaitez pas continuer, aucune action n'est requise — votre essai expirera automatiquement.",
    },
    "en": {
        "subjects": {
            7: "Great progress — 7 days left on your trial ✨",
            3: "Only 3 days left to level up ⏳",
            1: "Last day of trial — don't lose your work ⚠️",
        },
        "titles": {
            7: "Great progress! 🚀",
            3: "Only 3 days left ⏳",
            1: "Last day of your trial ⚠️",
        },
        "intros": {
            7: "Your free trial ends in <strong>7 days</strong>. Here's a summary of what you've set up so far:",
            3: "Your trial ends in <strong>3 days</strong>. Choose a plan to keep your work and continue receiving bookings.",
            1: "This is your <strong>last trial day</strong>. Tomorrow, your space will be limited and your website won't be publicly accessible.",
        },
        "summary_title": "Your activity during the trial",
        "contacts":      "contact(s)",
        "leads":         "request(s) received",
        "appointments":  "appointment(s)",
        "cta":           "Choose my plan →",
        "footer":        "You're receiving this email because your Klientys trial period is ending.",
        "no_action":     "If you don't wish to continue, no action is needed — your trial will expire automatically.",
    },
    "de": {
        "subjects": {
            7: "Gute Fortschritte — noch 7 Tage Testphase ✨",
            3: "Nur noch 3 Tage ⏳",
            1: "Letzter Tag der Testphase — verlieren Sie Ihre Arbeit nicht ⚠️",
        },
        "titles": {
            7: "Gute Fortschritte! 🚀",
            3: "Nur noch 3 Tage ⏳",
            1: "Letzter Tag Ihrer Testphase ⚠️",
        },
        "intros": {
            7: "Ihre kostenlose Testphase endet in <strong>7 Tagen</strong>. Hier ist eine Zusammenfassung:",
            3: "Ihre Testphase endet in <strong>3 Tagen</strong>. Wählen Sie einen Plan, um Ihre Arbeit zu behalten.",
            1: "Dies ist Ihr <strong>letzter Testtag</strong>. Morgen wird Ihr Bereich eingeschränkt.",
        },
        "summary_title": "Ihre Aktivität während der Testphase",
        "contacts":      "Kontakt(e)",
        "leads":         "Anfrage(n)",
        "appointments":  "Termin(e)",
        "cta":           "Meinen Plan wählen →",
        "footer":        "Sie erhalten diese E-Mail, weil Ihre Klientys-Testphase bald endet.",
        "no_action":     "Wenn Sie nach der Testphase nicht fortfahren möchten, ist keine Aktion erforderlich.",
    },
    "nl": {
        "subjects": {
            7: "Goede voortgang — nog 7 dagen proefperiode ✨",
            3: "Nog maar 3 dagen over ⏳",
            1: "Laatste dag van uw proefperiode — verlies uw werk niet ⚠️",
        },
        "titles": {
            7: "Geweldige voortgang! 🚀",
            3: "Nog maar 3 dagen ⏳",
            1: "Laatste dag van uw proefperiode ⚠️",
        },
        "intros": {
            7: "Uw gratis proefperiode eindigt over <strong>7 dagen</strong>. Hier is een overzicht van uw instellingen:",
            3: "Uw proefperiode eindigt over <strong>3 dagen</strong>. Kies een abonnement om uw werk te behouden.",
            1: "Dit is uw <strong>laatste proefdag</strong>. Morgen wordt uw ruimte beperkt.",
        },
        "summary_title": "Uw activiteit tijdens de proefperiode",
        "contacts":      "contact(en)",
        "leads":         "ontvangen aanvraag/aanvragen",
        "appointments":  "afspraak/afspraken",
        "cta":           "Mijn abonnement kiezen →",
        "footer":        "U ontvangt deze e-mail omdat uw Klientys proefperiode bijna afloopt.",
        "no_action":     "Als u na de proefperiode niet wilt doorgaan, is geen actie vereist.",
    },
}

_KLIENTYS_LOGO = "{frontend_url}/logo.png"


def _klientys_email_wrapper(header_html: str, body_html: str, footer_html: str) -> str:
    """Enveloppe HTML commune — thème navy Klientys."""
    return f"""
    <div style="font-family:'DM Sans',Arial,sans-serif;max-width:600px;margin:0 auto;background:#07222F;border-radius:16px;overflow:hidden">
      {header_html}
      <div style="padding:32px 36px">
        {body_html}
        <hr style="border:none;border-top:1px solid rgba(170,189,216,.1);margin:28px 0 16px">
        {footer_html}
      </div>
    </div>
    """


def send_welcome_email(
    owner_email: str,
    owner_name: str,
    tenant_name: str,
    country: str,
    dashboard_url: str,
    site_builder_url: str,
    calendar_url: str,
    site_url: str,
) -> None:
    """Email de bienvenue post-inscription avec les 3 premières étapes."""
    lang = _crm_lang(country)
    t = _WELCOME_I18N.get(lang, _WELCOME_I18N["fr"])
    logo_url = _KLIENTYS_LOGO.format(frontend_url=settings.frontend_url)

    header = f"""
    <div style="background:linear-gradient(135deg,#0D4B58 0%,#1A6E82 100%);padding:32px 36px">
      <img src="{logo_url}" height="34" alt="Klientys" style="margin-bottom:18px;display:block"/>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.02em">
        {t['title'].format(name=owner_name or tenant_name)}
      </h1>
      <p style="color:rgba(255,255,255,.65);margin:6px 0 0;font-size:13px">{t['header_sub']}</p>
    </div>"""

    body = f"""
      <div style="display:inline-block;background:rgba(221,170,64,.12);border:1px solid rgba(221,170,64,.35);
                  border-radius:20px;padding:4px 14px;margin-bottom:20px">
        <span style="color:#DDAA40;font-size:12px;font-weight:600">{t['trial_badge']}</span>
      </div>
      <p style="color:#EEF2F5;font-size:15px;line-height:1.65;margin:0 0 24px">
        {t['intro'].format(name=owner_name or "", tenant=tenant_name)}
      </p>
      <p style="color:#AAC0D8;font-size:11px;font-weight:700;text-transform:uppercase;
                letter-spacing:.1em;margin:0 0 12px">
        {t.get('steps_hint', '')}
      </p>

      <!-- Étape 1 -->
      <div style="background:rgba(13,75,88,.35);border:1px solid rgba(26,110,130,.4);
                  border-radius:12px;padding:18px 20px;margin-bottom:10px">
        <p style="color:#fff;font-weight:700;margin:0 0 5px;font-size:14px">{t['s1_title']}</p>
        <p style="color:#AAC0D8;font-size:13px;line-height:1.55;margin:0 0 14px">{t['s1_desc']}</p>
        <a href="{site_builder_url}"
           style="display:inline-block;background:#DDAA40;color:#07222F;padding:9px 20px;
                  border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">
          {t['s1_cta']}
        </a>
      </div>

      <!-- Étape 2 -->
      <div style="background:rgba(13,75,88,.35);border:1px solid rgba(26,110,130,.4);
                  border-radius:12px;padding:18px 20px;margin-bottom:10px">
        <p style="color:#fff;font-weight:700;margin:0 0 5px;font-size:14px">{t['s2_title']}</p>
        <p style="color:#AAC0D8;font-size:13px;line-height:1.55;margin:0 0 14px">{t['s2_desc']}</p>
        <a href="{calendar_url}"
           style="display:inline-block;background:#1A6E82;color:#fff;padding:9px 20px;
                  border-radius:8px;text-decoration:none;font-weight:700;font-size:13px">
          {t['s2_cta']}
        </a>
      </div>

      <!-- Étape 3 -->
      <div style="background:rgba(13,75,88,.35);border:1px solid rgba(26,110,130,.4);
                  border-radius:12px;padding:18px 20px;margin-bottom:24px">
        <p style="color:#fff;font-weight:700;margin:0 0 5px;font-size:14px">{t['s3_title']}</p>
        <p style="color:#AAC0D8;font-size:13px;line-height:1.55;margin:0 0 14px">{t['s3_desc']}</p>
        <a href="{site_url}"
           style="display:inline-block;background:rgba(42,143,165,.25);color:#2A8FA5;padding:9px 20px;
                  border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;
                  border:1px solid rgba(42,143,165,.5)">
          {t['s3_cta']}
        </a>
      </div>
    """

    footer = f"""
      <p style="color:#5C7A8A;font-size:12px;line-height:1.6;margin:0">
        {t['footer']}<br>
        {t['help']} <a href="mailto:support@klientys.co"
          style="color:#2A8FA5;text-decoration:none">support@klientys.co</a>
      </p>
    """

    resend.Emails.send({
        "from":    f"Klientys <{settings.email_from}>",
        "to":      [owner_email],
        "subject": t["subject"].format(name=owner_name or tenant_name),
        "html":    _klientys_email_wrapper(header, body, footer),
    })


def send_trial_reminder(
    owner_email: str,
    owner_name: str,
    tenant_name: str,
    country: str,
    days_left: int,
    summary: dict,
    upgrade_url: str,
) -> None:
    """Email de rappel d'expiration du trial J-7, J-3 ou J-1."""
    lang = _crm_lang(country)
    t = _TRIAL_I18N.get(lang, _TRIAL_I18N["fr"])
    logo_url = _KLIENTYS_LOGO.format(frontend_url=settings.frontend_url)

    # Couleur header selon urgence
    if days_left <= 1:
        header_gradient = "linear-gradient(135deg,#7f1d1d 0%,#b91c1c 100%)"
    elif days_left <= 3:
        header_gradient = "linear-gradient(135deg,#78350f 0%,#d97706 100%)"
    else:
        header_gradient = "linear-gradient(135deg,#0D4B58 0%,#1A6E82 100%)"

    header = f"""
    <div style="background:{header_gradient};padding:32px 36px">
      <img src="{logo_url}" height="34" alt="Klientys" style="margin-bottom:18px;display:block"/>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.02em">
        {t['titles'][days_left]}
      </h1>
      <p style="color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px">{tenant_name}</p>
    </div>"""

    greeting = f"Bonjour {owner_name}," if lang == "fr" else \
               f"Hello {owner_name}," if lang == "en" else \
               f"Guten Tag {owner_name}," if lang == "de" else \
               f"Goedendag {owner_name},"

    contacts_n   = summary.get("contacts", 0)
    leads_n      = summary.get("leads", 0)
    appointments_n = summary.get("appointments", 0)
    total_activity = contacts_n + leads_n + appointments_n

    if total_activity > 0:
        summary_block = f"""
        <p style="color:#AAC0D8;font-size:11px;font-weight:700;text-transform:uppercase;
                  letter-spacing:.1em;margin:20px 0 12px">{t['summary_title']}</p>
        <div style="display:table;width:100%;border-collapse:separate;border-spacing:8px">
          <div style="display:table-row">
            <div style="display:table-cell;width:33%;background:rgba(13,75,88,.4);border:1px solid rgba(26,110,130,.35);
                        border-radius:10px;padding:14px 12px;text-align:center">
              <p style="color:#DDAA40;font-size:28px;font-weight:800;margin:0;line-height:1">{contacts_n}</p>
              <p style="color:#AAC0D8;font-size:11px;margin:4px 0 0;line-height:1.4">{t['contacts']}</p>
            </div>
            <div style="display:table-cell;width:33%;background:rgba(13,75,88,.4);border:1px solid rgba(26,110,130,.35);
                        border-radius:10px;padding:14px 12px;text-align:center">
              <p style="color:#DDAA40;font-size:28px;font-weight:800;margin:0;line-height:1">{leads_n}</p>
              <p style="color:#AAC0D8;font-size:11px;margin:4px 0 0;line-height:1.4">{t['leads']}</p>
            </div>
            <div style="display:table-cell;width:33%;background:rgba(13,75,88,.4);border:1px solid rgba(26,110,130,.35);
                        border-radius:10px;padding:14px 12px;text-align:center">
              <p style="color:#DDAA40;font-size:28px;font-weight:800;margin:0;line-height:1">{appointments_n}</p>
              <p style="color:#AAC0D8;font-size:11px;margin:4px 0 0;line-height:1.4">{t['appointments']}</p>
            </div>
          </div>
        </div>"""
    else:
        summary_block = ""

    body = f"""
      <p style="color:#EEF2F5;font-size:15px;line-height:1.65;margin:0 0 6px">{greeting}</p>
      <p style="color:#EEF2F5;font-size:15px;line-height:1.65;margin:0 0 4px">
        {t['intros'][days_left]}
      </p>
      {summary_block}
      <div style="text-align:center;margin:28px 0">
        <a href="{upgrade_url}"
           style="display:inline-block;background:#DDAA40;color:#07222F;padding:14px 32px;
                  border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;
                  letter-spacing:-.01em">
          {t['cta']}
        </a>
      </div>
    """

    footer = f"""
      <p style="color:#5C7A8A;font-size:12px;line-height:1.6;margin:0">
        {t['footer']}<br>
        <span style="font-size:11px">{t['no_action']}</span>
      </p>
    """

    resend.Emails.send({
        "from":    f"Klientys <{settings.email_from}>",
        "to":      [owner_email],
        "subject": t["subjects"][days_left],
        "html":    _klientys_email_wrapper(header, body, footer),
    })


# ── Emails abonnement Stripe ─────────────────────────────────────────────────

_SUBSCRIPTION_I18N: dict[str, dict[str, str]] = {
    "fr": {
        "confirmed_subject": "Votre abonnement {plan} est activé ✓",
        "confirmed_title":   "Abonnement activé !",
        "confirmed_sub":     "Votre espace Klientys est maintenant complet.",
        "confirmed_intro":   "Votre abonnement <strong>{plan}</strong> est actif. Vous bénéficiez désormais de toutes les fonctionnalités incluses dans votre plan.",
        "confirmed_cta":     "Accéder à mon tableau de bord →",
        "confirmed_billing": "Pour consulter vos factures, changer de plan ou résilier, accédez à votre espace abonnement.",
        "confirmed_billing_cta": "Gérer mon abonnement →",
        "confirmed_footer":  "Vous recevez cet email car vous venez de souscrire à un abonnement Klientys.",
        "failed_subject":    "Action requise — problème de paiement sur votre abonnement",
        "failed_title":      "Échec du paiement",
        "failed_sub":        "Une action est requise pour maintenir votre accès.",
        "failed_intro":      "Nous n'avons pas pu encaisser le paiement de votre abonnement Klientys. Pour éviter toute interruption de service, veuillez mettre à jour vos informations de paiement.",
        "failed_cta":        "Mettre à jour mes informations de paiement →",
        "failed_note":       "Si vous ne mettez pas à jour vos informations sous 7 jours, votre accès sera suspendu automatiquement.",
        "failed_footer":     "Vous recevez cet email car un paiement a échoué sur votre compte Klientys.",
        "greeting":          "Bonjour",
    },
    "en": {
        "confirmed_subject": "Your {plan} subscription is active ✓",
        "confirmed_title":   "Subscription activated!",
        "confirmed_sub":     "Your Klientys space is now fully unlocked.",
        "confirmed_intro":   "Your <strong>{plan}</strong> subscription is now active. You now have access to all the features included in your plan.",
        "confirmed_cta":     "Go to my dashboard →",
        "confirmed_billing": "To view invoices, change plan, or cancel, visit your subscription area.",
        "confirmed_billing_cta": "Manage my subscription →",
        "confirmed_footer":  "You're receiving this email because you just subscribed to a Klientys plan.",
        "failed_subject":    "Action required — payment issue on your subscription",
        "failed_title":      "Payment failed",
        "failed_sub":        "Action is required to maintain your access.",
        "failed_intro":      "We were unable to process your Klientys subscription payment. To avoid any service interruption, please update your payment information.",
        "failed_cta":        "Update my payment information →",
        "failed_note":       "If you don't update your payment details within 7 days, your access will be automatically suspended.",
        "failed_footer":     "You're receiving this email because a payment failed on your Klientys account.",
        "greeting":          "Hello",
    },
    "de": {
        "confirmed_subject": "Ihr {plan}-Abonnement ist aktiv ✓",
        "confirmed_title":   "Abonnement aktiviert!",
        "confirmed_sub":     "Ihr Klientys-Bereich ist jetzt vollständig freigeschaltet.",
        "confirmed_intro":   "Ihr <strong>{plan}</strong>-Abonnement ist jetzt aktiv. Sie haben nun Zugang zu allen Funktionen Ihres Plans.",
        "confirmed_cta":     "Zu meinem Dashboard →",
        "confirmed_billing": "Um Rechnungen einzusehen, den Plan zu wechseln oder zu kündigen, öffnen Sie Ihren Abonnementbereich.",
        "confirmed_billing_cta": "Abonnement verwalten →",
        "confirmed_footer":  "Sie erhalten diese E-Mail, weil Sie gerade ein Klientys-Abonnement abgeschlossen haben.",
        "failed_subject":    "Aktion erforderlich — Zahlungsproblem bei Ihrem Abonnement",
        "failed_title":      "Zahlung fehlgeschlagen",
        "failed_sub":        "Eine Aktion ist erforderlich, um Ihren Zugang aufrechtzuerhalten.",
        "failed_intro":      "Wir konnten die Zahlung für Ihr Klientys-Abonnement nicht einziehen. Um eine Unterbrechung des Dienstes zu vermeiden, aktualisieren Sie bitte Ihre Zahlungsinformationen.",
        "failed_cta":        "Zahlungsinformationen aktualisieren →",
        "failed_note":       "Wenn Sie Ihre Zahlungsdaten nicht innerhalb von 7 Tagen aktualisieren, wird Ihr Zugang automatisch gesperrt.",
        "failed_footer":     "Sie erhalten diese E-Mail, weil eine Zahlung auf Ihrem Klientys-Konto fehlgeschlagen ist.",
        "greeting":          "Guten Tag",
    },
    "nl": {
        "confirmed_subject": "Uw {plan}-abonnement is actief ✓",
        "confirmed_title":   "Abonnement geactiveerd!",
        "confirmed_sub":     "Uw Klientys-ruimte is nu volledig ontgrendeld.",
        "confirmed_intro":   "Uw <strong>{plan}</strong>-abonnement is nu actief. U heeft nu toegang tot alle functies van uw plan.",
        "confirmed_cta":     "Naar mijn dashboard →",
        "confirmed_billing": "Om facturen te bekijken, van plan te wijzigen of op te zeggen, bezoek uw abonnementsruimte.",
        "confirmed_billing_cta": "Mijn abonnement beheren →",
        "confirmed_footer":  "U ontvangt deze e-mail omdat u zojuist een Klientys-abonnement heeft afgesloten.",
        "failed_subject":    "Actie vereist — betalingsprobleem op uw abonnement",
        "failed_title":      "Betaling mislukt",
        "failed_sub":        "Er is een actie vereist om uw toegang te behouden.",
        "failed_intro":      "We konden uw Klientys-abonnementsbetaling niet verwerken. Om een onderbreking van de service te vermijden, werk uw betalingsgegevens bij.",
        "failed_cta":        "Mijn betalingsgegevens bijwerken →",
        "failed_note":       "Als u uw betalingsgegevens niet binnen 7 dagen bijwerkt, wordt uw toegang automatisch geblokkeerd.",
        "failed_footer":     "U ontvangt deze e-mail omdat een betaling op uw Klientys-account is mislukt.",
        "greeting":          "Goedendag",
    },
}


def send_subscription_confirmed(
    owner_email: str,
    owner_name: str,
    tenant_name: str,
    country: str,
    plan_name: str,
    dashboard_url: str,
    subscription_settings_url: str,
) -> None:
    """Email de confirmation d'activation d'un abonnement payant."""
    lang = _crm_lang(country)
    t = _SUBSCRIPTION_I18N.get(lang, _SUBSCRIPTION_I18N["fr"])
    logo_url = _KLIENTYS_LOGO.format(frontend_url=settings.frontend_url)
    greeting = t["greeting"]

    header = f"""
    <div style="background:linear-gradient(135deg,#0D4B58 0%,#1A6E82 100%);padding:32px 36px">
      <img src="{logo_url}" height="34" alt="Klientys" style="margin-bottom:18px;display:block"/>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.02em">
        {t['confirmed_title']}
      </h1>
      <p style="color:rgba(255,255,255,.65);margin:6px 0 0;font-size:13px">{t['confirmed_sub']}</p>
    </div>"""

    body = f"""
      <p style="color:#EEF2F5;font-size:15px;line-height:1.65;margin:0 0 16px">
        {greeting} {owner_name or tenant_name},
      </p>
      <p style="color:#AAC0D8;font-size:15px;line-height:1.65;margin:0 0 24px">
        {t['confirmed_intro'].format(plan=plan_name)}
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="{dashboard_url}"
           style="display:inline-block;background:#DDAA40;color:#07222F;padding:14px 32px;
                  border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;
                  letter-spacing:-.01em">
          {t['confirmed_cta']}
        </a>
      </div>
      <div style="background:rgba(13,75,88,.35);border:1px solid rgba(26,110,130,.4);
                  border-radius:12px;padding:16px 20px;margin:20px 0">
        <p style="color:#AAC0D8;font-size:13px;line-height:1.55;margin:0 0 12px">
          {t['confirmed_billing']}
        </p>
        <a href="{subscription_settings_url}"
           style="display:inline-block;background:rgba(42,143,165,.25);color:#2A8FA5;padding:9px 20px;
                  border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;
                  border:1px solid rgba(42,143,165,.5)">
          {t['confirmed_billing_cta']}
        </a>
      </div>
    """

    footer = f"""
      <p style="color:#5C7A8A;font-size:12px;line-height:1.6;margin:0">
        {t['confirmed_footer']}<br>
        <a href="mailto:support@klientys.co" style="color:#2A8FA5;text-decoration:none">support@klientys.co</a>
      </p>
    """

    resend.Emails.send({
        "from":    f"Klientys <{settings.email_from}>",
        "to":      [owner_email],
        "subject": t["confirmed_subject"].format(plan=plan_name),
        "html":    _klientys_email_wrapper(header, body, footer),
    })


def send_subscription_payment_failed(
    owner_email: str,
    owner_name: str,
    tenant_name: str,
    country: str,
    billing_portal_url: str,
) -> None:
    """Email d'alerte de paiement échoué — invite à mettre à jour le moyen de paiement."""
    lang = _crm_lang(country)
    t = _SUBSCRIPTION_I18N.get(lang, _SUBSCRIPTION_I18N["fr"])
    logo_url = _KLIENTYS_LOGO.format(frontend_url=settings.frontend_url)
    greeting = t["greeting"]

    header = f"""
    <div style="background:linear-gradient(135deg,#7f1d1d 0%,#b91c1c 100%);padding:32px 36px">
      <img src="{logo_url}" height="34" alt="Klientys" style="margin-bottom:18px;display:block"/>
      <h1 style="color:#fff;font-size:22px;font-weight:800;margin:0;letter-spacing:-.02em">
        {t['failed_title']}
      </h1>
      <p style="color:rgba(255,255,255,.7);margin:6px 0 0;font-size:13px">{t['failed_sub']}</p>
    </div>"""

    body = f"""
      <p style="color:#EEF2F5;font-size:15px;line-height:1.65;margin:0 0 16px">
        {greeting} {owner_name or tenant_name},
      </p>
      <p style="color:#AAC0D8;font-size:15px;line-height:1.65;margin:0 0 20px">
        {t['failed_intro']}
      </p>
      <div style="text-align:center;margin:24px 0">
        <a href="{billing_portal_url}"
           style="display:inline-block;background:#dc2626;color:#fff;padding:14px 32px;
                  border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;
                  letter-spacing:-.01em">
          {t['failed_cta']}
        </a>
      </div>
      <div style="background:rgba(127,29,29,.25);border:1px solid rgba(185,28,28,.4);
                  border-radius:10px;padding:14px 18px;margin:16px 0">
        <p style="color:#fca5a5;font-size:13px;line-height:1.6;margin:0">
          ⚠️ {t['failed_note']}
        </p>
      </div>
    """

    footer = f"""
      <p style="color:#5C7A8A;font-size:12px;line-height:1.6;margin:0">
        {t['failed_footer']}<br>
        <a href="mailto:support@klientys.co" style="color:#2A8FA5;text-decoration:none">support@klientys.co</a>
      </p>
    """

    resend.Emails.send({
        "from":    f"Klientys <{settings.email_from}>",
        "to":      [owner_email],
        "subject": t["failed_subject"],
        "html":    _klientys_email_wrapper(header, body, footer),
    })


async def send_campaign_email(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    sender_name: str,
    reply_url: str = "",
    primary_color: str = "",
    logo_url: str = "",
    logo_option: str = "text_only",
) -> None:
    """Envoie un email de campagne à un contact."""
    body_html = "".join(
        f"<p style='color:#374151;line-height:1.7;margin:0 0 14px'>{line}</p>"
        if line.strip() else "<br>"
        for line in body.split("\n")
    )
    reply_block = (
        f'<p style="color:#9ca3af;font-size:12px;margin:8px 0 0">'
        f'<a href="{reply_url}" style="color:#6b7280;text-decoration:underline">'
        f'Pour répondre à ce message, cliquez ici →</a></p>'
    ) if reply_url else ""
    html = _tenant_email_wrapper(sender_name, f"""
      {body_html}
      {reply_block}
    """, primary_color=primary_color, logo_url=logo_url, logo_option=logo_option)
    resend.Emails.send({
        "from": f"{sender_name} <{settings.email_from}>",
        "to":   [to_email],
        "subject": subject,
        "html": html,
    })


# ── Rapport mensuel Analytics ────────────────────────────────────────────────

_MONTHLY_REPORT_I18N: dict[str, dict] = {
    "fr": {
        "subject":  "Votre rapport analytics {month} — {tenant}",
        "title":    "Votre rapport mensuel est prêt",
        "sub":      "Retrouvez ci-joint le bilan de votre activité pour {month}.",
        "intro":    "Bonjour {name},<br><br>Votre rapport analytics du mois de <strong>{month}</strong> pour <strong>{tenant}</strong> est disponible en pièce jointe.",
        "cta":      "Voir mes analytics en ligne →",
        "kpi_vues": "vues de page",
        "kpi_dem":  "demandes",
        "kpi_rdv":  "rendez-vous",
        "footer":   "Vous recevez ce rapport car vous êtes abonné(e) à Klientys.",
    },
    "en": {
        "subject":  "Your analytics report for {month} — {tenant}",
        "title":    "Your monthly report is ready",
        "sub":      "Please find attached your activity summary for {month}.",
        "intro":    "Hello {name},<br><br>Your analytics report for <strong>{month}</strong> ({tenant}) is available as an attachment.",
        "cta":      "View my analytics online →",
        "kpi_vues": "page views",
        "kpi_dem":  "leads",
        "kpi_rdv":  "appointments",
        "footer":   "You receive this report because you have an active Klientys subscription.",
    },
    "de": {
        "subject":  "Ihr Analytics-Bericht {month} — {tenant}",
        "title":    "Ihr Monatsbericht ist bereit",
        "sub":      "Ihr Aktivitätsbericht für {month} liegt als Anhang bei.",
        "intro":    "Hallo {name},<br><br>Ihr Analytics-Bericht für <strong>{month}</strong> ({tenant}) ist als Anhang verfügbar.",
        "cta":      "Analytics online anzeigen →",
        "kpi_vues": "Seitenaufrufe",
        "kpi_dem":  "Anfragen",
        "kpi_rdv":  "Termine",
        "footer":   "Sie erhalten diesen Bericht, weil Sie Klientys abonniert haben.",
    },
    "nl": {
        "subject":  "Uw analytics rapport {month} — {tenant}",
        "title":    "Uw maandrapport is klaar",
        "sub":      "Uw activiteitsoverzicht voor {month} vindt u als bijlage.",
        "intro":    "Hallo {name},<br><br>Uw analytics rapport voor <strong>{month}</strong> ({tenant}) is beschikbaar als bijlage.",
        "cta":      "Analytics online bekijken →",
        "kpi_vues": "paginaweergaven",
        "kpi_dem":  "aanvragen",
        "kpi_rdv":  "afspraken",
        "footer":   "U ontvangt dit rapport omdat u een actief Klientys-abonnement heeft.",
    },
}


def send_monthly_report(
    owner_email: str,
    owner_name: str,
    tenant_name: str,
    country: str,
    month_label: str,
    summary: dict,
    pdf_bytes: bytes,
    dashboard_url: str,
) -> None:
    """Envoie le rapport analytics mensuel avec le PDF en pièce jointe."""
    lang = _crm_lang(country)
    t = _MONTHLY_REPORT_I18N.get(lang, _MONTHLY_REPORT_I18N["fr"])
    logo_url = _KLIENTYS_LOGO.format(frontend_url=settings.frontend_url)

    pv  = summary.get("pageviews", 0)
    ld  = summary.get("leads_total", 0)
    appts = summary.get("appointments_total", 0)
    conv  = summary.get("conversion_appt_rate")

    def _kpi_box(value, label, color="#0D4B58"):
        return (
            f'<td style="text-align:center;padding:0 16px">'
            f'<div style="font-size:26px;font-weight:800;color:{color}">{value}</div>'
            f'<div style="font-size:11px;color:#5C7A8A;margin-top:2px">{label}</div>'
            f'</td>'
        )

    kpi_row = (
        '<table style="width:100%;border-collapse:collapse;margin:20px 0"><tr>'
        + _kpi_box(f"{pv:,}".replace(",", " "), t["kpi_vues"])
        + '<td style="color:rgba(170,189,216,.15);font-size:24px;text-align:center">|</td>'
        + _kpi_box(ld, t["kpi_dem"], "#DDAA40")
        + '<td style="color:rgba(170,189,216,.15);font-size:24px;text-align:center">|</td>'
        + _kpi_box(appts, t["kpi_rdv"], "#1D7A4A")
        + '</tr></table>'
    )

    conv_row = ""
    if conv is not None:
        conv_row = (
            f'<div style="background:rgba(221,170,64,.1);border-radius:8px;padding:10px 16px;'
            f'text-align:center;margin-bottom:20px">'
            f'<span style="color:#DDAA40;font-size:18px;font-weight:800">{conv}%</span>'
            f'<span style="color:#AAC0D8;font-size:11px;margin-left:8px">conversion</span>'
            f'</div>'
        )

    header = f"""
    <div style="background:linear-gradient(135deg,#0D4B58 0%,#1A6E82 100%);padding:28px 36px">
      <img src="{logo_url}" height="30" alt="Klientys" style="margin-bottom:16px;display:block"/>
      <h1 style="color:#fff;font-size:20px;font-weight:800;margin:0">{t['title']}</h1>
      <p style="color:rgba(255,255,255,.6);margin:4px 0 0;font-size:12px">{t['sub'].format(month=month_label)}</p>
    </div>"""

    body = f"""
      <p style="color:#EEF2F5;font-size:14px;line-height:1.7;margin:0 0 8px">
        {t['intro'].format(name=owner_name or tenant_name, tenant=tenant_name, month=month_label)}
      </p>
      {kpi_row}
      {conv_row}
      <div style="text-align:center;margin:24px 0">
        <a href="{dashboard_url}" style="{_BTN.replace('#4f46e5','#0D4B58')}">
          {t['cta']}
        </a>
      </div>
    """

    footer = f'<p style="color:#5C7A8A;font-size:11px;line-height:1.6;margin:0">{t["footer"]}</p>'

    # Nom du fichier PDF en fonction de la langue
    safe_month = month_label.lower().replace(" ", "-").replace("é", "e").replace("û", "u")
    pdf_filename = f"rapport-{safe_month}.pdf"

    resend.Emails.send({
        "from":    f"Klientys <{settings.email_from}>",
        "to":      [owner_email],
        "subject": t["subject"].format(month=month_label, tenant=tenant_name),
        "html":    _klientys_email_wrapper(header, body, footer),
        "attachments": [{
            "filename": pdf_filename,
            "content":  list(pdf_bytes),
        }],
    })
