/**
 * Hôtes dont next/image peut optimiser les images (doit rester aligné sur
 * `images.remotePatterns` dans next.config.ts).
 *
 * Les tenants peuvent coller l'URL d'une image hébergée n'importe où : ces
 * images s'affichent avec `unoptimized`, chargées directement par le
 * navigateur, au lieu d'ouvrir l'optimiseur de klientys.co à tous les domaines.
 */
const OPTIMIZABLE_HOST_SUFFIXES = [".supabase.co", "klientys.co"];

export function isOptimizableImage(src: string | null | undefined): boolean {
  if (!src) return false;
  if (src.startsWith("/")) return true;
  try {
    const { protocol, hostname } = new URL(src);
    return protocol === "https:" && OPTIMIZABLE_HOST_SUFFIXES.some((s) => hostname === s.replace(/^\./, "") || hostname.endsWith(s));
  } catch {
    return false;
  }
}
