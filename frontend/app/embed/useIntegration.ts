"use client";
import { useEffect, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type IntegrationState = {
  // loading : ping en cours · active : affichage normal · disabled : intégration
  // désactivée par le tenant · not_ready : chatbot sans les éléments requis
  status: "loading" | "active" | "disabled" | "not_ready";
  // Clé à joindre aux envois (lead / RDV / message chatbot) pour l'attribution
  key: string | null;
  // true : page ouverte directement (type « lien »), pas dans une iframe
  standalone: boolean;
};

function hostFromReferrer(): string | null {
  try {
    return document.referrer ? new URL(document.referrer).hostname : null;
  } catch {
    return null;
  }
}

// Au chargement d'un widget : déclare le support au serveur et apprend s'il
// peut s'afficher. Dans une iframe, un widget refusé demande à embed.js de le
// masquer, pour ne laisser ni cadre vide ni bulle en erreur chez le client.
export function useIntegration(slug: string, widget: "chatbot" | "book" | "contact"): IntegrationState {
  const [state, setState] = useState<IntegrationState>({ status: "loading", key: null, standalone: false });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const standalone = window.parent === window;
    // embed.js transmet l'hôte exact. Sans lui (iframe collée à la main), le
    // referrer donne l'origine du site — sauf si sa Referrer-Policy l'interdit.
    const host = standalone ? null : (params.get("host") || hostFromReferrer());
    const keyParam = params.get("integration");

    let cancelled = false;
    fetch(`${API_URL}/api/v1/integrations/public/${encodeURIComponent(slug)}/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ integration: keyParam, host, widget }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        // Ping en échec (réseau, backend à froid) : on affiche quand même.
        // Les envois restent contrôlés côté serveur.
        if (!d) { setState({ status: "active", key: keyParam, standalone }); return; }
        const status = !d.active ? "disabled" : (widget === "chatbot" && d.chatbot_ready === false) ? "not_ready" : "active";
        setState({ status, key: d.integration ?? null, standalone });
        if (status !== "active" && !standalone) window.parent.postMessage({ type: "saas-widget-hide" }, "*");
      })
      .catch(() => { if (!cancelled) setState({ status: "active", key: keyParam, standalone }); });

    return () => { cancelled = true; };
  }, [slug, widget]);

  return state;
}
