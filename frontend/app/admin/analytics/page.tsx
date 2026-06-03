"use client";
import { useState } from "react";

// ⚠️ Remplace cette URL par l'URL d'intégration de ton rapport Looker Studio
// Fichier → Paramètres du rapport → Intégration et partage → Activer l'intégration
const LOOKER_EMBED_URL = "";

const K = {
  card:   "#0D1B25",
  card2:  "#0A1520",
  border: "rgba(170,189,216,0.10)",
  text:   "#EEF2F5",
  muted:  "#8BA5B0",
  teal:   "#0D4B58",
  tealL:  "#1A6E82",
  tealXL: "#2A8FA5",
  gold:   "#DDAA40",
};

export default function AdminAnalyticsPage() {
  const [url, setUrl] = useState(LOOKER_EMBED_URL);
  const [editing, setEditing] = useState(!LOOKER_EMBED_URL);
  const [draft, setDraft] = useState(LOOKER_EMBED_URL);

  const save = () => {
    setUrl(draft.trim());
    setEditing(false);
  };

  return (
    <div className="p-8 h-full flex flex-col" style={{ minHeight: "calc(100vh - 0px)" }}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold mb-1" style={{ color: K.text }}>Analytics site</h1>
          <p className="text-sm" style={{ color: K.muted }}>Trafic klientys.co via Looker Studio · Google Analytics 4</p>
        </div>

        <button
          onClick={() => { setDraft(url); setEditing(true); }}
          className="text-xs px-3 py-1.5 rounded-lg transition-colors"
          style={{ background: K.card, border: `1px solid ${K.border}`, color: K.muted }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = K.tealXL; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = K.muted; }}
        >
          {url ? "Changer l'URL" : "Configurer"}
        </button>
      </div>

      {/* Modal config URL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: "#0D1B25", border: `1px solid rgba(170,189,216,0.15)` }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: K.text }}>URL d'intégration Looker Studio</h2>
            <p className="text-xs mb-4" style={{ color: K.muted }}>
              Dans Looker Studio : <span style={{ color: K.tealXL }}>Fichier → Paramètres du rapport → Intégration et partage → Activer l'intégration</span>
            </p>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://lookerstudio.google.com/embed/reporting/..."
              className="w-full rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none"
              style={{ background: "#0A1520", border: `1px solid rgba(170,189,216,0.2)`, color: K.text }}
              autoFocus
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setEditing(false)}
                className="text-sm px-4 py-1.5 rounded-lg"
                style={{ color: K.muted }}
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={!draft.trim()}
                className="text-sm px-4 py-1.5 rounded-lg disabled:opacity-40 transition-colors"
                style={{ background: K.teal, color: "#fff" }}
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenu */}
      {!url ? (
        <div className="flex-1 flex flex-col items-center justify-center rounded-2xl"
          style={{ background: K.card, border: `1px dashed rgba(170,189,216,0.12)` }}>
          <div className="mb-4" style={{ opacity: 0.3 }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ color: K.tealXL }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p className="text-sm font-medium mb-2" style={{ color: K.text }}>Rapport Looker Studio non configuré</p>
          <p className="text-xs mb-5 text-center max-w-sm" style={{ color: K.muted }}>
            Crée un rapport sur <span style={{ color: K.tealXL }}>lookerstudio.google.com</span> connecté à GA4 (G-C04SHMVM34), puis colle l'URL d'intégration ici.
          </p>
          <button
            onClick={() => setEditing(true)}
            className="text-sm px-5 py-2 rounded-xl transition-colors"
            style={{ background: K.teal, color: "#fff" }}
          >
            Configurer le rapport
          </button>
        </div>
      ) : (
        <div className="flex-1 rounded-2xl overflow-hidden" style={{ border: `1px solid ${K.border}`, minHeight: 600 }}>
          <iframe
            src={url}
            className="w-full h-full"
            style={{ minHeight: 600, border: "none" }}
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
