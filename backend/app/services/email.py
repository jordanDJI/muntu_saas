import resend
from app.core.config import settings

resend.api_key = settings.resend_api_key

_BTN = "background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block"


def send_lead_notification(tenant_email: str, lead: dict, contact: dict) -> None:
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [tenant_email],
        "subject": f"Nouvelle demande de {contact.get('first_name')} {contact.get('last_name')}",
        "html": f"""
        <h2>Nouvelle demande reçue</h2>
        <p><strong>Nom :</strong> {contact.get('first_name')} {contact.get('last_name')}</p>
        <p><strong>Email :</strong> {contact.get('email', '—')}</p>
        <p><strong>Téléphone :</strong> {contact.get('phone', '—')}</p>
        <p><strong>Type :</strong> {lead.get('request_type')}</p>
        <p><strong>Canal :</strong> {lead.get('source')}</p>
        {f"<p><strong>Motif :</strong> {lead.get('notes')}</p>" if lead.get('notes') else ""}
        <br>
        <a href="{settings.frontend_url}/dashboard/leads/{lead.get('id')}" style="{_BTN}">
            Voir la demande →
        </a>
        """,
    })


def send_appointment_pending_tenant(
    tenant_email: str,
    tenant_name: str,
    contact: dict,
    appointment: dict,
    dashboard_url: str,
) -> None:
    """Email au professionnel : nouveau RDV en attente de validation."""
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(appointment.get("scheduled_at", "").replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = appointment.get("scheduled_at", "—")

    contact_name = f"{contact.get('first_name', '')} {contact.get('last_name', '')}".strip()
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [tenant_email],
        "subject": f"Nouveau RDV en attente — {contact_name}",
        "html": f"""
        <h2>Nouveau rendez-vous en attente de confirmation</h2>
        <p>Bonjour,</p>
        <p>Un nouveau rendez-vous vient d'être demandé via votre site :</p>
        <table style="margin:16px 0;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Client</td><td><strong>{contact_name}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>{contact.get('email', '—')}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Téléphone</td><td>{contact.get('phone', '—')}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Date</td><td><strong>{date_str}</strong></td></tr>
        </table>
        <p>Connectez-vous à votre espace <strong>{tenant_name}</strong> pour confirmer ou refuser ce rendez-vous.</p>
        <br>
        <a href="{dashboard_url}" style="{_BTN}">Gérer ce rendez-vous →</a>
        <br><br>
        <p style="color:#6b7280;font-size:13px">
          Si vous confirmez, le client recevra automatiquement un email de confirmation.
        </p>
        """,
    })


def send_appointment_confirmation(contact_email: str, contact_name: str, appointment: dict, tenant_name: str) -> None:
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(appointment.get("scheduled_at", "").replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = appointment.get("scheduled_at", "—")

    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": "Confirmation de votre rendez-vous",
        "html": f"""
        <h2>Rendez-vous confirmé ✓</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre rendez-vous avec <strong>{tenant_name}</strong> est confirmé
        pour le <strong>{date_str}</strong>.</p>
        <p>Vous recevrez un rappel 24 h avant.</p>
        <p style="color:#6b7280;font-size:13px">En cas d'empêchement, merci de prévenir dès que possible.</p>
        """,
    })


def send_appointment_cancellation(
    contact_email: str,
    contact_name: str,
    appointment: dict,
    tenant_name: str,
    booking_url: str = "",
    was_pending: bool = False,
) -> None:
    """
    Email au client lors d'une annulation ou d'un refus de RDV.
    - was_pending=True : le professionnel n'a pas validé la demande → propose de rechoisir
    - was_pending=False : RDV confirmé annulé → propose de recontacter
    """
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(appointment.get("scheduled_at", "").replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = appointment.get("scheduled_at", "—")

    if was_pending:
        subject = "Votre demande de rendez-vous n'a pas pu être acceptée"
        body = f"""
        <h2>Demande de rendez-vous non confirmée</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre demande de rendez-vous avec <strong>{tenant_name}</strong>
        pour le <strong>{date_str}</strong> n'a malheureusement pas pu être acceptée.</p>
        <p>Vous pouvez choisir un autre créneau directement en ligne :</p>
        {f'<br><a href="{booking_url}" style="{_BTN}">Choisir un autre créneau →</a><br>' if booking_url else ""}
        <br>
        <p style="color:#6b7280;font-size:13px">
          N'hésitez pas à nous contacter si vous avez des questions.
        </p>
        """
    else:
        subject = "Annulation de votre rendez-vous"
        body = f"""
        <h2>Rendez-vous annulé</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre rendez-vous avec <strong>{tenant_name}</strong>
        prévu le <strong>{date_str}</strong> a été annulé.</p>
        <p>N'hésitez pas à reprendre contact pour convenir d'une nouvelle date.</p>
        {f'<br><a href="{booking_url}" style="{_BTN}">Reprendre rendez-vous →</a><br>' if booking_url else ""}
        """

    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": subject,
        "html": body,
    })


def send_team_invite(email: str, tenant_name: str, invite_url: str, role: str) -> None:
    role_labels = {"owner": "Propriétaire", "admin": "Administrateur", "member": "Membre"}
    role_label = role_labels.get(role, role.capitalize())
    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [email],
        "subject": f"Invitation à rejoindre {tenant_name}",
        "html": f"""
        <h2>Vous avez été invité(e) à rejoindre {tenant_name}</h2>
        <p>Vous avez reçu une invitation en tant que <strong>{role_label}</strong>.</p>
        <p>Cliquez sur le bouton ci-dessous pour accepter :</p>
        <br>
        <a href="{invite_url}" style="{_BTN}">Accepter l'invitation →</a>
        <br><br>
        <p style="color:#6b7280;font-size:13px;">Ce lien est valable 7 jours. Si vous n'attendiez pas cette invitation, ignorez cet email.</p>
        """,
    })


def send_lead_acknowledgement(contact_email: str, contact_name: str, tenant_name: str) -> None:
    """Accuse de réception au prospect après soumission du formulaire de contact."""
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": f"{tenant_name} — Votre message a bien été reçu",
        "html": f"""
        <h2>Merci, {contact_name} !</h2>
        <p>Votre message a bien été reçu par <strong>{tenant_name}</strong>.</p>
        <p>Nous examinerons votre demande et vous recontacterons dans les meilleurs délais.</p>
        <p style="color:#6b7280;font-size:13px">
          Si vous avez une urgence, n'hésitez pas à nous appeler directement.
        </p>
        """,
    })


def send_booking_request_received(
    contact_email: str,
    contact_name: str,
    appointment: dict,
    tenant_name: str,
) -> None:
    """Accuse de réception au client après une demande de rendez-vous (statut pending)."""
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(appointment.get("scheduled_at", "").replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = appointment.get("scheduled_at", "—")

    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": f"{tenant_name} — Votre demande de rendez-vous a été reçue",
        "html": f"""
        <h2>Demande de rendez-vous reçue ✓</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre demande de rendez-vous avec <strong>{tenant_name}</strong>
        pour le <strong>{date_str}</strong> a bien été enregistrée.</p>
        <p>Le professionnel va examiner votre demande et vous enverra une confirmation par email.</p>
        <p style="color:#6b7280;font-size:13px">
          Si vous ne pouvez finalement pas vous déplacer, merci de nous le signaler dès que possible.
        </p>
        """,
    })


def send_appointment_reminder(contact_email: str, contact_name: str, appointment: dict, tenant_name: str) -> None:
    from datetime import datetime
    try:
        dt = datetime.fromisoformat(appointment.get("scheduled_at", "").replace("Z", "+00:00"))
        date_str = dt.strftime("%A %d/%m/%Y à %H:%M")
    except Exception:
        date_str = appointment.get("scheduled_at", "—")

    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": "Rappel : votre rendez-vous demain",
        "html": f"""
        <h2>Rappel de rendez-vous</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre rendez-vous avec <strong>{tenant_name}</strong> est prévu
        le <strong>{date_str}</strong>.</p>
        <p>En cas d'empêchement, merci de nous prévenir dès que possible.</p>
        """,
    })
