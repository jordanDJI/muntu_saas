"""
Prospects SIRENE : retrouver des coordonnées professionnelles publiques (migration 088).

Recherche **ciblée, fiche par fiche** — pas une collecte de masse :
1. Gemini, avec la recherche Google, propose le site officiel et les coordonnées que
   l'entreprise publie elle-même (site, fiche Google).
2. Le backend lit lui-même le site proposé (page d'accueil + page contact / mentions)
   et ne marque « vérifiée » qu'une coordonnée réellement présente sur ce site, qui
   mentionne bien l'entreprise. Le reste est gardé « à vérifier » pour l'humain.
3. Sources exclues : LinkedIn, annuaires et agrégateurs (Pages Jaunes, societe.com,
   Pappers…). La CNIL a sanctionné en 2024 la collecte de coordonnées sur LinkedIn
   (KASPR, 240 000 €), et ces annuaires interdisent l'extraction dans leurs CGU.

Chaque coordonnée garde sa source (`contact_source`) : au premier contact, il faut
dire d'où elle vient (art. 14 RGPD). Rien n'est envoyé automatiquement.

Les fonctions sans réseau sont testées dans tests/test_prospect_contacts.py.
"""
from __future__ import annotations

import asyncio
import html as html_lib
import ipaddress
import json
import logging
import re
import socket
import unicodedata
from datetime import datetime, timedelta, timezone
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger(__name__)

MODEL = "gemini-2.5-flash"
MAX_LOOKUPS = 3                      # recherches automatiques par fiche
RETRY_AFTER = timedelta(days=30)     # une jeune entreprise crée sa fiche Google en quelques semaines
FIRST_AUTO_LOOKUP_AGE_DAYS = 30      # pas de recherche automatique avant 30 jours d'existence
DAILY_AUTO_CAP = 30                  # plafond quotidien de la tâche planifiée (coût Gemini)
MAX_PAGE_BYTES = 1_500_000
USER_AGENT = "KlientysBot/1.0 (+https://klientys.co)"

EXCLUDED_DOMAINS = (
    "linkedin.com", "pagesjaunes.fr", "societe.com", "pappers.fr", "infogreffe.fr",
    "verif.com", "manageo.fr", "annuaire-entreprises.data.gouv.fr", "entreprises.lefigaro.fr",
    "corporama.com", "kompass.com", "118712.fr", "118000.fr", "annuaire.118712.fr",
    "facebook.com", "instagram.com", "tiktok.com", "x.com", "twitter.com",
)

SECTOR_ACTIVITY = {
    "health": "santé", "beauty": "beauté / soins", "coaching": "coaching / sport",
    "finance": "comptabilité / finance", "trade": "artisanat / bâtiment",
    "restaurant": "restauration", "commerce": "commerce de détail",
}

# Bornes (?<!\d) / (?!\d) : sans elles, un SIRET des mentions légales donnait un faux numéro.
_PHONE_RE = re.compile(r"(?<![\d+])(?:(?:\+|00)33[\s.\-]?(?:\(0\)[\s.\-]?)?|0)[1-9](?:[\s.\-]?\d{2}){4}(?!\d)")
_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_IGNORED_EMAIL_PARTS = ("example", "exemple", "sentry", "wixpress", "domain.", "votre", "your",
                        "noreply", "no-reply", "@2x", ".png", ".jpg", ".webp", ".svg")


class LookupUnavailable(Exception):
    """Recherche impossible pour l'instant (quota ou crédit Gemini, panne) : ne compte pas comme un essai."""

    def __init__(self, message: str, retry_after: int | None = None):
        super().__init__(message)
        self.retry_after = retry_after


# ── Règles pures ───────────────────────────────────────────────────────────────

def retry_delay(error_text: str) -> int | None:
    """Délai demandé par Gemini après un 429 (« retry in 41.5s » / « retryDelay: '41s' »)."""
    match = re.search(r"retry in ([\d.]+)\s*s", error_text or "", re.I) \
        or re.search(r"retryDelay'?\"?:\s*'?\"?(\d+)s", error_text or "")
    return int(float(match.group(1))) + 1 if match else None


def is_quota_error(error_text: str) -> bool:
    return any(code in (error_text or "") for code in ("429", "RESOURCE_EXHAUSTED"))


def normalize_phone(raw: str | None) -> str | None:
    """Format français « 0X XX XX XX XX », ou None si ce n'est pas un numéro français."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("0033"):
        digits = "0" + digits[4:]
    elif digits.startswith("33") and len(digits) == 11:
        digits = "0" + digits[2:]
    if digits.startswith("330") and len(digits) == 12:   # +33 (0)6…
        digits = digits[2:]
    if len(digits) != 10 or not digits.startswith("0") or digits[1] == "0":
        return None
    return " ".join(digits[i:i + 2] for i in range(0, 10, 2))


def domain_of(url: str | None) -> str:
    host = (urlparse(url or "").hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


def is_excluded(url: str | None) -> bool:
    host = domain_of(url)
    return bool(host) and any(host == d or host.endswith("." + d) for d in EXCLUDED_DOMAINS)


def _fold(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def page_text(html: str) -> str:
    html = re.sub(r"(?is)<(script|style|noscript)[^>]*>.*?</\1>", " ", html or "")
    return html_lib.unescape(re.sub(r"(?s)<[^>]+>", " ", html))


def extract_contacts(html: str) -> tuple[list[str], list[str]]:
    """Téléphones (normalisés) et emails trouvés dans une page, liens tel:/mailto: compris."""
    raw = html or ""
    hrefs = " ".join(re.findall(r'(?i)href=["\'](?:tel|mailto):([^"\'?]+)', raw))
    text = page_text(raw) + " " + html_lib.unescape(hrefs)
    phones: list[str] = []
    for match in _PHONE_RE.findall(text):
        phone = normalize_phone(match)
        if phone and phone not in phones:
            phones.append(phone)
    emails: list[str] = []
    for match in _EMAIL_RE.findall(text):
        email = match.strip(".").lower()
        if not any(p in email for p in _IGNORED_EMAIL_PARTS) and email not in emails:
            emails.append(email)
    return phones, emails


def mentions_company(text: str, name: str, city: str | None, postal_code: str | None) -> bool:
    """La page parle-t-elle bien de cette entreprise ? (nom, ou ville / code postal)."""
    folded = f" {_fold(text)} "
    words = [w for w in _fold(name).split() if len(w) >= 4]
    if words and sum(f" {w} " in folded for w in words) >= max(1, len(words) // 2):
        return True
    return bool((postal_code and postal_code in folded) or (city and f" {_fold(city)} " in folded))


def parse_model_json(text: str) -> dict:
    """Premier objet JSON de la réponse du modèle (la recherche Google interdit le mode JSON strict)."""
    match = re.search(r"\{.*\}", text or "", re.S)
    if not match:
        return {}
    try:
        data = json.loads(match.group(0))
        return data if isinstance(data, dict) else {}
    except json.JSONDecodeError:
        return {}


def contact_links(base_url: str, html: str) -> list[str]:
    """Pages « contact » / « mentions légales » du même site, au plus deux."""
    found: list[str] = []
    for href in re.findall(r'(?i)href=["\']([^"\'#]+)["\']', html or ""):
        if re.search(r"(?i)contact|mentions|legal|a-propos|about", href):
            url = urljoin(base_url, href)
            if domain_of(url) == domain_of(base_url) and url not in found:
                found.append(url)
        if len(found) >= 2:
            break
    return found


def decide(suggestion: dict, site_ok: bool, site_phones: list[str], site_emails: list[str],
           website: str | None) -> dict:
    """Coordonnées retenues : vérifiées si lues sur le site de l'entreprise, sinon « à vérifier »."""
    phone = normalize_phone(suggestion.get("phone"))
    email = (suggestion.get("email") or "").strip().lower() or None
    source = suggestion.get("source_url")
    weak = suggestion.get("confidence") == "faible" or is_excluded(source)

    result = {"contact_phone": None, "contact_email": None, "contact_website": None,
              "contact_source": None, "contact_verified": False}
    if site_ok:
        result["contact_website"] = website
        kept_phone = phone if phone in site_phones else (site_phones[0] if site_phones else None)
        kept_email = email if email in site_emails else _best_email(site_emails, website)
        if kept_phone or kept_email:
            result.update(contact_phone=kept_phone, contact_email=kept_email,
                          contact_source=website, contact_verified=True)
            return result
        result["contact_source"] = website
    if not weak and (phone or email):
        # Proposé par la recherche (souvent la fiche Google) mais non lu sur le site :
        # gardé pour vérification humaine, jamais marqué « vérifié ».
        result.update(contact_phone=result["contact_phone"] or phone,
                      contact_email=result["contact_email"] or email,
                      contact_source=source or result["contact_source"] or "recherche Google")
    return result


def _best_email(emails: list[str], website: str | None) -> str | None:
    """Préférer une adresse du domaine du site (celles d'une agence web figurent parfois en pied de page)."""
    site = domain_of(website)
    same = [e for e in emails if site and e.endswith("@" + site)]
    return (same or emails or [None])[0]


def build_prompt(prospect: dict) -> str:
    activity = SECTOR_ACTIVITY.get(prospect.get("sector") or "", "")
    address = ", ".join(filter(None, [prospect.get("street"),
                                      " ".join(filter(None, [prospect.get("postal_code"), prospect.get("city")]))]))
    return f"""Trouve les coordonnées professionnelles publiques de cette entreprise française récemment créée.
Nom : {prospect.get("name")}
Activité : {activity} (code NAF {prospect.get("naf_code") or "inconnu"})
Adresse : {address or "inconnue"}

Cherche uniquement son site internet officiel, et le téléphone et l'email que l'entreprise publie elle-même (sur son site ou sa fiche Google).
N'utilise jamais LinkedIn, Pages Jaunes, societe.com, Pappers, Infogreffe, les réseaux sociaux ni les annuaires d'entreprises.
Ne donne un résultat que s'il correspond à cette entreprise précise : même nom ET même ville. Dans le doute, mets null.

Réponds uniquement par un objet JSON, sans texte autour :
{{"website": "url ou null", "phone": "numéro ou null", "email": "email ou null", "source_url": "page où figurent le téléphone ou l'email, ou null", "confidence": "haute | moyenne | faible"}}"""


# ── Réseau ─────────────────────────────────────────────────────────────────────

async def _is_public(url: str) -> bool:
    """Refuse les adresses internes : l'URL vient d'un modèle, elle n'est pas fiable."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        return False
    try:
        infos = await asyncio.to_thread(socket.getaddrinfo, parsed.hostname, None)
    except OSError:
        return False
    return all(ipaddress.ip_address(info[4][0]).is_global for info in infos)


async def _fetch(client: httpx.AsyncClient, url: str) -> tuple[str | None, str | None]:
    """(url finale, html) — redirections suivies à la main pour revérifier chaque hôte."""
    for _ in range(4):
        if is_excluded(url) or not await _is_public(url):
            return None, None
        try:
            resp = await client.get(url)
        except httpx.HTTPError:
            return None, None
        if resp.is_redirect and resp.headers.get("location"):
            url = urljoin(url, resp.headers["location"])
            continue
        if resp.status_code != 200 or "html" not in resp.headers.get("content-type", ""):
            return None, None
        return url, resp.content[:MAX_PAGE_BYTES].decode(resp.encoding or "utf-8", errors="replace")
    return None, None


async def _ask_model(prospect: dict, wait_on_quota: bool = False) -> dict:
    """Suggestion du modèle. Erreur Gemini → LookupUnavailable (jamais un « rien trouvé »).

    `wait_on_quota` : en tâche de fond, un 429 est attendu une fois (délai indiqué par
    Google, 60 s au plus) puis retenté ; en appel direct depuis l'admin, on rend la main.
    """
    from app.services.llm import _client, _record_usage

    def call():
        resp = _client().models.generate_content(
            model=MODEL,
            contents=build_prompt(prospect),
            config={"tools": [{"google_search": {}}], "temperature": 0},
        )
        _record_usage(resp)
        return resp.text or ""

    for attempt in (1, 2):
        try:
            return parse_model_json(await asyncio.to_thread(call))
        except Exception as exc:
            text = str(exc)
            delay = retry_delay(text) if is_quota_error(text) else None
            if delay is not None and wait_on_quota and attempt == 1 and delay <= 60:
                logger.info("Gemini : quota atteint, nouvel essai dans %d s", delay)
                await asyncio.sleep(delay)
                continue
            if is_quota_error(text):
                raise LookupUnavailable("Quota Gemini atteint.", delay) from exc
            if "402" in text or "credits are depleted" in text:
                raise LookupUnavailable("Crédit Gemini épuisé.") from exc
            raise LookupUnavailable(f"Gemini indisponible : {text[:120]}") from exc
    raise LookupUnavailable("Quota Gemini atteint.")


async def find_contacts(prospect: dict, wait_on_quota: bool = False) -> dict:
    """Coordonnées d'un prospect (colonnes `contact_*` de prospect_company)."""
    suggestion = await _ask_model(prospect, wait_on_quota)
    website = suggestion.get("website")
    website = website if isinstance(website, str) and website.startswith("http") and not is_excluded(website) else None

    site_ok, phones, emails = False, [], []
    if website:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=False,
                                     headers={"User-Agent": USER_AGENT}) as client:
            final_url, home = await _fetch(client, website)
            if home and mentions_company(page_text(home), prospect.get("name", ""),
                                         prospect.get("city"), prospect.get("postal_code")):
                site_ok, website = True, final_url
                phones, emails = extract_contacts(home)
                for link in contact_links(final_url, home):
                    _, page = await _fetch(client, link)
                    if page:
                        more_phones, more_emails = extract_contacts(page)
                        phones += [p for p in more_phones if p not in phones]
                        emails += [e for e in more_emails if e not in emails]
    return decide(suggestion, site_ok, phones, emails, website)


async def lookup_and_store(sb, prospect: dict, wait_on_quota: bool = False) -> dict:
    """Recherche + enregistrement. Sans résultat, une nouvelle recherche est planifiée.

    Une recherche qui n'a pas pu avoir lieu (LookupUnavailable) ne touche pas la fiche :
    auparavant un quota Gemini atteint était enregistré comme « rien trouvé » et
    consommait l'un des trois essais.
    """
    now = datetime.now(timezone.utc)
    try:
        found = await find_contacts(prospect, wait_on_quota)
    except LookupUnavailable:
        raise
    except Exception as exc:
        logger.warning("Recherche de coordonnées échouée (%s) : %s", prospect.get("id"), exc, exc_info=True)
        raise LookupUnavailable("Erreur pendant la recherche.") from exc
    count = int(prospect.get("contact_lookup_count") or 0) + 1
    updates = {
        "contact_lookup_count": count,
        "contact_checked_at": now.isoformat(),
        "contact_next_check_at": (now + RETRY_AFTER).isoformat() if count < MAX_LOOKUPS else None,
    }
    # Ne jamais effacer une coordonnée saisie ou trouvée auparavant par un résultat vide.
    if any(found.get(k) for k in ("contact_phone", "contact_email", "contact_website")):
        updates.update({k: v for k, v in found.items() if v is not None or k == "contact_verified"})
        updates["contact_next_check_at"] = None
    res = sb.table("prospect_company").update(updates).eq("id", prospect["id"]).execute()
    return (res.data or [{**prospect, **updates}])[0]


async def run_due_lookups(sb, limit: int = DAILY_AUTO_CAP) -> int:
    """Tâche planifiée : fiches sans coordonnées, âgées d'au moins 30 jours, dont la recherche est due."""
    now = datetime.now(timezone.utc)
    now_iso = now.strftime("%Y-%m-%dT%H:%M:%SZ")  # sans « + », mal lu dans un filtre d'URL
    oldest_created = (now - timedelta(days=FIRST_AUTO_LOOKUP_AGE_DAYS)).date().isoformat()
    rows = (
        sb.table("prospect_company").select("*")
        .eq("status", "new")
        .is_("contact_phone", "null").is_("contact_email", "null").is_("contact_website", "null")
        .lt("contact_lookup_count", MAX_LOOKUPS)
        .lte("created_on", oldest_created)
        .or_(f"contact_next_check_at.is.null,contact_next_check_at.lte.{now_iso}")
        .order("created_on").limit(limit).execute().data or []
    )
    return await lookup_batch(sb, rows)


async def lookup_batch(sb, prospects: list[dict]) -> int:
    """Recherches en série ; s'arrête au premier refus de Gemini (inutile d'insister)."""
    done = 0
    for prospect in prospects:
        try:
            await lookup_and_store(sb, prospect, wait_on_quota=True)
            done += 1
        except LookupUnavailable as exc:
            logger.warning("Recherche de coordonnées interrompue après %d fiche(s) : %s", done, exc)
            break
    return done
