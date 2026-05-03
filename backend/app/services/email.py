import resend
from app.core.config import settings

resend.api_key = settings.resend_api_key


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
        <a href="{settings.frontend_url}/dashboard/leads/{lead.get('id')}">
            Voir la demande dans le tableau de bord →
        </a>
        """,
    })


def send_appointment_confirmation(contact_email: str, contact_name: str, appointment: dict, tenant_name: str) -> None:
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": "Confirmation de votre rendez-vous",
        "html": f"""
        <h2>Rendez-vous confirmé</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre rendez-vous avec <strong>{tenant_name}</strong> est confirmé
        pour le <strong>{appointment.get('scheduled_at')}</strong>.</p>
        <p>Vous recevrez un rappel 24h avant.</p>
        """,
    })


def send_appointment_cancellation(contact_email: str, contact_name: str, appointment: dict, tenant_name: str) -> None:
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": "Annulation de votre rendez-vous",
        "html": f"""
        <h2>Rendez-vous annulé</h2>
        <p>Bonjour {contact_name},</p>
        <p>Nous avons le regret de vous informer que votre rendez-vous avec <strong>{tenant_name}</strong>
        prévu le <strong>{appointment.get('scheduled_at')}</strong> a été annulé.</p>
        <p>N'hésitez pas à reprendre contact pour convenir d'une nouvelle date.</p>
        """,
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
        <a href="{invite_url}" style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">
            Accepter l'invitation →
        </a>
        <br><br>
        <p style="color:#6b7280;font-size:13px;">Ce lien est valable 7 jours. Si vous n'attendiez pas cette invitation, ignorez cet email.</p>
        """,
    })


def send_appointment_reminder(contact_email: str, contact_name: str, appointment: dict, tenant_name: str) -> None:
    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": "Rappel : votre rendez-vous demain",
        "html": f"""
        <h2>Rappel de rendez-vous</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre rendez-vous avec <strong>{tenant_name}</strong> est prévu demain
        à <strong>{appointment.get('scheduled_at')}</strong>.</p>
        <p>En cas d'empêchement, merci de nous prévenir.</p>
        """,
    })
