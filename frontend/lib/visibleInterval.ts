/**
 * Comme setInterval, mais en pause tant que l'onglet est masqué, avec un appel
 * immédiat au retour sur l'onglet. Le support interrogeait le backend toutes les
 * 10 à 30 s dans chaque onglet ouvert, même en arrière-plan.
 *
 * Renvoie la fonction d'arrêt (à retourner depuis un useEffect).
 */
export function setVisibleInterval(fn: () => void, ms: number): () => void {
  let id: ReturnType<typeof setInterval> | null = null;
  const start = () => { if (id === null) id = setInterval(fn, ms); };
  const stop = () => { if (id !== null) { clearInterval(id); id = null; } };
  const onVisibility = () => {
    if (document.visibilityState === "visible") { fn(); start(); } else { stop(); }
  };
  if (typeof document === "undefined" || document.visibilityState === "visible") start();
  document.addEventListener("visibilitychange", onVisibility);
  return () => { stop(); document.removeEventListener("visibilitychange", onVisibility); };
}
