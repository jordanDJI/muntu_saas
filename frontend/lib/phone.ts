/**
 * Filtre un champ téléphone à la saisie : uniquement des chiffres, avec un "+" optionnel
 * en tout premier caractère (format international). Aucune lettre, espace, tiret ou parenthèse.
 */
export function sanitizePhoneInput(value: string): string {
  const hasLeadingPlus = value.trimStart().startsWith("+");
  const digitsOnly = value.replace(/[^0-9]/g, "");
  return hasLeadingPlus ? `+${digitsOnly}` : digitsOnly;
}
