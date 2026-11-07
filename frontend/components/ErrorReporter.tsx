"use client";
import { useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";
const MAX_REPORTS_PER_PAGE = 5;

/**
 * Remonte les erreurs JavaScript non interceptées vers le backend
 * (POST /api/v1/client-errors), qui les transmet à Sentry. Sans lui, une erreur
 * sur le site d'un tenant ou dans un widget chez un client n'était vue par personne.
 *
 * Aucune donnée personnelle : ni cookie ni identifiant, chemin sans query string.
 */
export default function ErrorReporter() {
  useEffect(() => {
    if (!API) return;
    let sent = 0;
    const seen = new Set<string>();

    const source = () => {
      const p = window.location.pathname;
      if (p.startsWith("/embed")) return "widget";
      if (p.startsWith("/dashboard")) return "dashboard";
      if (p.startsWith("/admin")) return "admin";
      return "site";
    };

    const report = (message: string, stack?: string) => {
      if (!message || sent >= MAX_REPORTS_PER_PAGE) return;
      // Erreurs d'extensions et de scripts tiers : sans intérêt et sans stack exploitable.
      if (message === "Script error." || /extension:\/\//.test(stack ?? "")) return;
      const key = message.slice(0, 200);
      if (seen.has(key)) return;
      seen.add(key);
      sent += 1;
      const body = JSON.stringify({
        message: message.slice(0, 500),
        stack: stack?.slice(0, 4000),
        path: window.location.pathname,
        source: source(),
      });
      try {
        // keepalive : l'envoi survit à une navigation déclenchée par l'erreur
        fetch(`${API}/api/v1/client-errors`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true })
          .catch(() => { /* jamais d'erreur en cascade */ });
      } catch { /* ignore */ }
    };

    const onError = (e: ErrorEvent) => report(e.message, e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e.reason;
      report(r instanceof Error ? r.message : String(r ?? "unhandledrejection"), r instanceof Error ? r.stack : undefined);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
