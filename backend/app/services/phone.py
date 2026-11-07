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


def restore_leading_zero(value: str | None, country: str | None) -> tuple[str | None, bool]:
    """Rétablit le 0 initial d'un numéro national qu'Excel a converti en nombre.

    Ouvrir un CSV dans Excel puis l'enregistrer transforme « 06 12 00 00 02 » en
    612000002. En France et en Belgique, un numéro au format national commence
    toujours par 0 : un numéro sans 0 ni indicatif, à la longueur d'un numéro
    amputé de son 0, est donc sans ambiguïté.

    - FR : 10 chiffres en national → 9 chiffres sans le 0.
    - BE : fixe 9 chiffres → 8 sans le 0 ; mobile 10 chiffres (04…) → 9 commençant par 4.

    Renvoie (numéro, corrigé ?). Les numéros internationaux (+…) et les autres
    pays ne sont jamais modifiés.
    """
    if not value:
        return value, False
    digits = clean_phone(value)
    if not digits or not digits.isdigit() or digits.startswith("0"):
        return value, False
    country = (country or "").upper()
    if country == "FR" and len(digits) == 9:
        return "0" + digits, True
    if country == "BE" and (len(digits) == 8 or (len(digits) == 9 and digits.startswith("4"))):
        return "0" + digits, True
    return value, False
