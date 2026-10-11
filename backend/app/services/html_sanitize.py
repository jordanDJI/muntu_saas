"""
Sanitization HTML du contenu éditorial (blog_post.body_html).

body_html est produit par un agent IA externe (prompt injection possible) ou
une traduction Gemini, relu par un humain dans /admin/content avant publication —
mais cette relecture est visuelle sur un rendu déjà exécuté : /admin/content et la
page publique du blog injectent tous les deux body_html via dangerouslySetInnerHTML,
sans repasser par un sanitizer. Un payload XSS glissé dans le HTML s'exécute donc
dans la session de l'admin dès l'aperçu, avant toute publication.

On nettoie une seule fois, à l'écriture (chaque endpoint qui pose body_html),
plutôt qu'à la lecture : plus simple à garantir exhaustif qu'un sanitizer à ajouter
sur chaque future surface de rendu.
"""
import bleach

ALLOWED_TAGS = [
    "h1", "h2", "h3", "h4", "p", "br", "hr",
    "strong", "b", "em", "i", "u", "s",
    "ul", "ol", "li",
    "a", "blockquote", "code", "pre",
    "img", "figure", "figcaption",
    "table", "thead", "tbody", "tr", "th", "td",
    "span", "div",
]

ALLOWED_ATTRIBUTES = {
    "a": ["href", "title", "rel", "target"],
    "img": ["src", "alt", "title", "width", "height"],
    "span": ["class"],
    "div": ["class"],
    "table": ["class"],
    "td": ["colspan", "rowspan"],
    "th": ["colspan", "rowspan"],
}

ALLOWED_PROTOCOLS = ["http", "https", "mailto"]


def sanitize_blog_html(html: str | None) -> str | None:
    """Neutralise scripts/handlers/URLs dangereuses tout en gardant la mise en forme éditoriale."""
    if not html:
        return html
    return bleach.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        strip=True,
        strip_comments=True,
    )
