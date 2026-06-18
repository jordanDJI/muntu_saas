"use client";
import { useEffect, useState } from "react";
import { api } from "../../../../lib/api";

type SiteEntry = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  site_title: string | null;
  site_status: string | null;
};

export default function SecretarySitesPage() {
  const [sites, setSites] = useState<SiteEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getSecretarySites().then(setSites).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Sites vitrine</h1>
        <p className="text-sm text-gray-500 mt-1">Accédez aux sites publics des professionnels que vous assistez.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#0D4B58", borderTopColor: "transparent" }} />
        </div>
      ) : sites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <svg className="w-10 h-10 mb-3 opacity-30 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"/><path strokeLinecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/>
          </svg>
          <p className="text-sm text-gray-500">Aucun espace de travail associé.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sites.map((s) => (
            <div key={s.tenant_id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">

              {/* Icône tenant */}
              <div className="w-10 h-10 rounded-xl shrink-0 flex items-center justify-center" style={{ background: "rgba(13,75,88,.08)" }}>
                <svg className="w-5 h-5" fill="none" stroke="#0D4B58" strokeWidth={1.5} viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9"/>
                  <path strokeLinecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18"/>
                </svg>
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {s.tenant_name || s.tenant_slug}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 truncate">{s.site_title || "Site non configuré"}</p>
                  {s.site_status === "published" && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(22,163,74,.1)", color: "#16a34a" }}>Publié</span>
                  )}
                  {s.site_status === "draft" && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(217,119,6,.1)", color: "#d97706" }}>Brouillon</span>
                  )}
                  {!s.site_status && (
                    <span className="text-xs text-gray-400">Non configuré</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {s.tenant_slug && (
                  <a
                    href={`/${s.tenant_slug}?preview=true`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border border-gray-200 text-gray-600 hover:border-primary-300 hover:text-primary-600"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                    </svg>
                    Prévisualiser
                  </a>
                )}
                {s.site_status === "published" && s.tenant_slug && (
                  <a
                    href={`/${s.tenant_slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-80"
                    style={{ background: "#0D4B58" }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                    </svg>
                    Voir le site
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
