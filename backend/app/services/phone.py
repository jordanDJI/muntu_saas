"""
Validation des numéros de téléphone — chiffres uniquement, + optionnel en tête (format international).
Pas d'espaces, tirets ou parenthèses : la mise en forme est un problème d'affichage, pas de stockage.
"""
import re

PHONE_RE = re.compile(r"^\+?[0-9]+$")

# Séparateurs de mise en forme courants qu'on tolère en entrée (CSV, copier-coller) et qu'on retire.
_FORMATTING_CHARS_RE = re.compile(r"[\s().-]")


def clean_phone(value: str | None) -> str | None:
    """Retire les séparateurs de mise en forme courants. Ne valide pas — utiliser is_valid_phone après."""
    if not value:
        return value
    return _FORMATTING_CHARS_RE.sub("", value.strip())


def is_valid_phone(value: str | None) -> bool:
    if not value:
        return True
    return bool(PHONE_RE.match(value))


def validate_phone_field(value: str | None) -> str | None:
    """À utiliser dans un @field_validator Pydantic. Lève ValueError si invalide après nettoyage."""
    if not value:
        return value
    cleaned = clean_phone(value)
    if not is_valid_phone(cleaned):
        raise ValueError("Le téléphone ne doit contenir que des chiffres et éventuellement un + au début.")
    return cleaned
