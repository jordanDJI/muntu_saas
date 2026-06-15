"use client";

import { useState } from "react";

type Props = {
  photos: string[];
  display: "horizontal" | "vertical";
  accentColor: string;
};

export default function GallerySection({ photos, display, accentColor }: Props) {
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (photos.length === 0) return null;

  const prev = () => setLightbox((i) => (i !== null ? (i - 1 + photos.length) % photos.length : null));
  const next = () => setLightbox((i) => (i !== null ? (i + 1) % photos.length : null));

  return (
    <>
      {/* ── Galerie ── */}
      <section id="galerie" className="py-16 px-6 bg-white" data-reveal>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <span
              className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4"
              style={{ backgroundColor: `${accentColor}18`, color: accentColor }}
            >
              Galerie
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">Notre galerie</h2>
          </div>

          {display === "horizontal" ? (
            /* ─── Défilement horizontal — 4 photos visibles + scroll ─── */
            <div className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide">
              {photos.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="flex-none w-72 sm:w-80 aspect-video snap-start rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-offset-2 group"
                  style={{ ["--tw-ring-color" as any]: accentColor }}
                >
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          ) : (
            /* ─── Grille verticale — 2 colonnes ─── */
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {photos.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="aspect-video rounded-2xl overflow-hidden focus:outline-none group"
                >
                  <img
                    src={url}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Lightbox ── */}
      {lightbox !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={() => setLightbox(null)}
        >
          {/* Image */}
          <img
            src={photos[lightbox]}
            alt={`Photo ${lightbox + 1}`}
            className="max-w-[92vw] max-h-[90vh] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Compteur */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-white/70 font-medium">
            {lightbox + 1} / {photos.length}
          </div>

          {/* Fermer */}
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
          >
            ×
          </button>

          {/* Précédent */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
            >
              ‹
            </button>
          )}

          {/* Suivant */}
          {photos.length > 1 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white text-xl transition-colors"
            >
              ›
            </button>
          )}
        </div>
      )}
    </>
  );
}
