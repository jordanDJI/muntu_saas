/**
 * Sérialise des données structurées pour une balise
 * <script type="application/ld+json">.
 *
 * JSON.stringify n'échappe pas « < » : une valeur contenant
 * « </script><script>… » fermerait la balise et exécuterait du code. Les
 * fiches annuaire, les sites tenant et les segments d'URL injectent du texte
 * saisi par des tiers dans ces balises — toujours passer par ce helper.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
