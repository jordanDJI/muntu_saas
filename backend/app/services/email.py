import resend
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.core.config import settings

resend.api_key = settings.resend_api_key

_BTN = "background:#4f46e5;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block"


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
        <div style="margin:16px 0;padding:14px 16px;background:#f8fafc;border-left:4px solid #4f46e5;border-radius:4px">
          <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em">Message du client</p>
          <p style="margin:0;color:#1e293b;white-space:pre-wrap">{message.strip()}</p>
        </div>"""

    resend.Emails.send({
        "from": f"{settings.email_from_name} <{settings.email_from}>",
        "to": [tenant_email],
        "subject": f"Nouveau RDV en attente — {contact_name}" + (f" ({party_size} pers.)" if party_size > 1 else ""),
        "html": f"""
        <h2>Nouveau rendez-vous en attente de confirmation</h2>
        <p>Bonjour,</p>
        <p>Un nouveau rendez-vous vient d'être demandé via votre site :</p>
        <table style="margin:16px 0;border-collapse:collapse">
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Client</td><td><strong>{contact_name}</strong></td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Email</td><td>{contact.get('email', '—')}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Téléphone</td><td>{contact.get('phone', '—')}</td></tr>
          <tr><td style="padding:4px 12px 4px 0;color:#6b7280">Date</td><td><strong>{date_str}</strong></td></tr>
          {group_row}
        </table>
        {message_block}
        <p>Connectez-vous à votre espace <strong>{tenant_name}</strong> pour confirmer ou refuser ce rendez-vous.</p>
        <br>
        <a href="{dashboard_url}" style="{_BTN}">Gérer ce rendez-vous →</a>
        <br><br>
        <p style="color:#6b7280;font-size:13px">
          Si vous confirmez, le client recevra automatiquement un email de confirmation.
        </p>
        """,
    })


def send_appointment_confirmation(contact_email: str, contact_name: str, appointment: dict, tenant_name: str, tz_name: str = "UTC") -> None:
    date_str = _fmt_dt(appointment.get("scheduled_at", ""), tz_name)

    party_size = appointment.get("party_size", 1)
    group_line = f"<p>Réservation pour <strong>{party_size} personnes</strong>.</p>" if party_size > 1 else ""

    resend.Emails.send({
        "from": f"{tenant_name} <{settings.email_from}>",
        "to": [contact_email],
        "subject": "Confirmation de votre rendez-vous",
        "html": f"""
        <h2>Rendez-vous confirmé ✓</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre rendez-vous avec <strong>{tenant_name}</strong> est confirmé
        pour le <strong>{date_str}</strong>.</p>
        {group_line}
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
    tz_name: str = "UTC",
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
        subject = "Votre demande de rendez-vous n'a pas pu être acceptée"
        body = f"""
        <h2>Demande de rendez-vous non confirmée</h2>
        <p>Bonjour {contact_name},</p>
        <p>Votre demande de rendez-vous avec <strong>{tenant_name}</strong>
        pour le <strong>{date_str}</strong> n'a malheureusement pas pu être acceptée.</p>
        {group_line}
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


def send_support_account_invite(email: str, role: str, setup_link: str) -> None:
    role_labels = {"viewer": "Observateur (lecture seule)", "support": "Support opérationnel"}
    role_label = role_labels.get(role, role)
    role_perms = {
        "viewer":  "Vous pouvez consulter les informations des tenants et les logs.",
        "support": "Vous pouvez consulter les informations des tenants, confirmer les emails, réinitialiser les mots de passe, prolonger les périodes d'essai, synchroniser Stripe et réinitialiser les domaines.",
    }
    perms_text = role_perms.get(role, "")
    resend.Emails.send({
        "from": f"Klientys Admin <{settings.email_from}>",
        "to": [email],
        "subject": "Votre accès support Klientys",
        "html": f"""
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">
            Accès support Klientys
          </h2>
          <p style="color:#444;line-height:1.65;margin-bottom:16px">
            Un compte support vous a été créé sur la plateforme Klientys avec le niveau
            <strong>{role_label}</strong>.
          </p>
          <div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;padding:14px 18px;margin-bottom:24px">
            <p style="margin:0;font-size:13px;color:#0369a1;line-height:1.6">
              <strong>Vos permissions :</strong><br>{perms_text}
            </p>
          </div>
          {"" if not setup_link else f'<p style="color:#444;margin-bottom:20px">Définissez votre mot de passe pour accéder au panel :</p><a href="{setup_link}" style="{_BTN}">Définir mon mot de passe →</a><br><br><p style="font-size:12px;color:#9ca3af">Ce lien est valable 24h.</p>'}
        </div>
        """,
    })


def send_impersonation_notice(tenant_email: str, tenant_name: str, admin_email: str, accessed_at: str) -> None:
    """Notifie le tenant qu'un administrateur Klientys a accédé à son compte."""
    resend.Emails.send({
        "from": f"Klientys Sécurité <{settings.email_from}>",
        "to": [tenant_email],
        "subject": "Accès administrateur à votre compte Klientys",
        "html": f"""
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:32px 24px">
          <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">
            Accès administrateur à votre compte
          </h2>
          <p style="color:#444;line-height:1.65;margin-bottom:16px">
            Un administrateur Klientys a accédé à votre espace <strong>{tenant_name}</strong>
            le <strong>{accessed_at}</strong> à des fins de support ou de maintenance.
          </p>
          <div style="background:#fef9ec;border:1px solid #f5d87a;border-radius:8px;padding:14px 18px;margin-bottom:24px">
            <p style="margin:0;font-size:13px;color:#7a5800;line-height:1.6">
              Cet accès est strictement encadré par nos
              <a href="https://klientys.co/legal/cgu" style="color:#7a5800">Conditions Générales d'Utilisation</a>
              (article 13). Il est tracé et auditable. Aucune donnée bancaire n'est accessible par ce biais.
            </p>
          </div>
          <p style="color:#444;line-height:1.65;margin-bottom:24px">
            Si vous n'avez pas sollicité de support et que cet accès vous semble anormal,
            contactez-nous immédiatement à
            <a href="mailto:support@klientys.co" style="color:#4f46e5">support@klientys.co</a>.
          </p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin-bottom:24px">
          <p style="font-size:12px;color:#9ca3af;line-height:1.6">
            Klientys SRL — Ce message est généré automatiquement, merci de ne pas y répondre directement.
          </p>
        </div>
        """,
    })


def send_booking_request_received(
    contact_email: str,
    contact_name: str,
    appointment: dict,
    tenant_name: str,
    tz_name: str = "UTC",
) -> None:
    """Accuse de réception au client après une demande de rendez-vous (statut pending)."""
    date_str = _fmt_dt(appointment.get("scheduled_at", ""), tz_name)

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


async def send_campaign_email(
    to_email: str,
    to_name: str,
    subject: str,
    body: str,
    sender_name: str,
    reply_url: str = "",
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
    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff">
      <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:2px solid #4f46e5">
        <span style="font-size:20px;font-weight:700;color:#4f46e5">{sender_name}</span>
      </div>
      {body_html}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Vous recevez cet email car vous êtes client de {sender_name}.
      </p>
      {reply_block}
    </div>
    """
    resend.Emails.send({
        "from": f"{sender_name} <{settings.email_from}>",
        "to":   [to_email],
        "subject": subject,
        "html": html,
    })
