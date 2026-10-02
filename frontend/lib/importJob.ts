/**
 * Garde la trace d'un import de contacts en cours à travers la navigation —
 * le traitement continue en arrière-plan côté serveur même si le tenant change de page.
 */
const KEY = "klientys_contact_import_job";

export function setActiveImportJob(jobId: string): void {
  try { localStorage.setItem(KEY, jobId); } catch {}
}

export function getActiveImportJob(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}

export function clearActiveImportJob(): void {
  try { localStorage.removeItem(KEY); } catch {}
}
