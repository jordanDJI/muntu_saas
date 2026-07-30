"use client";
import { useState, useEffect, useCallback } from "react";
import Image from "next/image";

type Colors = { accent: string; light: string; hero: string };

function getPhotos(offer: any): string[] {
  if (offer.photos?.length) return offer.photos;
  if (offer.image_url) return [offer.image_url];
  return [];
}

function OfferCard({ offer, colors, onClick }: { offer: any; colors: Colors; onClick: () => void }) {
  const photos = getPhotos(offer);
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 border border-gray-100/80 w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{ "--tw-ring-color": colors.accent } as React.CSSProperties}
    >
      {photos.length > 0 ? (
        <div className="relative">
          <Image src={photos[0]} alt={offer.name} width={400} height={160} className="w-full h-40 object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
          {photos.length > 1 && (
            <span className="absolute bottom-2 right-2 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded-full">
              {photos.length} photos
            </span>
          )}
        </div>
      ) : (
        <div className="h-2 w-full" style={{ backgroundColor: colors.accent }} />
      )}
      <div className="p-5">
        <h3 className="font-semibold text-gray-900 text-lg leading-snug">{offer.name}</h3>
        {offer.description && (
          <p className="text-gray-500 mt-2 text-sm leading-relaxed line-clamp-2">{offer.description}</p>
        )}
        {((offer.duration_min ?? offer.duration_minutes) || (offer.price_eur ?? offer.price_from)) && (
          <div className="flex gap-2 mt-4 flex-wrap">
            {(offer.duration_min ?? offer.duration_minutes) && (
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium text-white" style={{ backgroundColor: colors.accent }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                {offer.duration_min ?? offer.duration_minutes} min
              </span>
            )}
            {(offer.price_eur ?? offer.price_from) && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: colors.light, color: colors.hero }}>
                {offer.price_eur ?? offer.price_from} €
              </span>
            )}
          </div>
        )}
        {getPhotos(offer).length > 0 && (
          <p className="mt-3 text-xs font-medium" style={{ color: colors.accent }}>Voir les photos →</p>
        )}
      </div>
    </button>
  );
}

function ServiceModal({
  offer,
  colors,
  onClose,
  bookingHref,
}: {
  offer: any;
  colors: Colors;
  onClose: () => void;
  bookingHref?: string;
}) {
  const photos = getPhotos(offer);
  const [idx, setIdx] = useState(0);

  const prev = useCallback(() => setIdx((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % photos.length), [photos.length]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={offer.name}
      >
        {/* Carrousel photos */}
        {photos.length > 0 && (
          <div className="relative bg-gray-100 flex-shrink-0">
            <Image
              src={photos[idx]}
              alt={`${offer.name} — photo ${idx + 1}`}
              width={700}
              height={400}
              className="w-full h-64 sm:h-80 object-cover"
              sizes="(max-width: 768px) 100vw, 700px"
            />
            {photos.length > 1 && (
              <>
                <button
                  onClick={prev}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow transition"
                  aria-label="Photo précédente"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <button
                  onClick={next}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/80 hover:bg-white flex items-center justify-center shadow transition"
                  aria-label="Photo suivante"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 18l6-6-6-6"/></svg>
                </button>
                {/* Indicateurs */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.map((_, pi) => (
                    <button
                      key={pi}
                      onClick={() => setIdx(pi)}
                      className="w-2 h-2 rounded-full transition-all"
                      style={{ backgroundColor: pi === idx ? colors.accent : "rgba(255,255,255,0.6)" }}
                      aria-label={`Photo ${pi + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Contenu */}
        <div className="p-6 overflow-y-auto">
          <div className="flex items-start justify-between gap-4 mb-3">
            <h2 className="text-xl font-bold text-gray-900 leading-snug">{offer.name}</h2>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
              aria-label="Fermer"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Prix / durée */}
          {((offer.duration_min ?? offer.duration_minutes) || (offer.price_eur ?? offer.price_from)) && (
            <div className="flex gap-2 flex-wrap mb-4">
              {(offer.duration_min ?? offer.duration_minutes) && (
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-white" style={{ backgroundColor: colors.accent }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                  {offer.duration_min ?? offer.duration_minutes} min
                </span>
              )}
              {(offer.price_eur ?? offer.price_from) && (
                <span className="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold" style={{ backgroundColor: colors.light, color: colors.hero }}>
                  {offer.price_eur ?? offer.price_from} €
                </span>
              )}
            </div>
          )}

          {offer.description && (
            <p className="text-gray-600 text-sm leading-relaxed whitespace-pre-line">{offer.description}</p>
          )}

          {bookingHref && (
            <a
              href={bookingHref}
              className="mt-6 inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-white text-sm transition hover:opacity-90"
              style={{ backgroundColor: colors.accent }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
              Prendre rendez-vous
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ServiceSection({
  offers,
  colors,
  useCategories,
  offersByCategory,
  isPreview,
  bookingHref,
}: {
  offers: any[];
  colors: Colors;
  useCategories: boolean;
  offersByCategory: Record<string, any[]>;
  isPreview: boolean;
  bookingHref?: string;
}) {
  const [selected, setSelected] = useState<any | null>(null);

  if (offers.length === 0) {
    return isPreview ? (
      <p className="text-center text-gray-400 italic text-sm">Prestations non configurées — complétez l'étape 5 du site-builder.</p>
    ) : null;
  }

  return (
    <>
      {useCategories ? (
        <div className="space-y-10">
          {Object.entries(offersByCategory).map(([cat, catOffers]) => (
            <div key={cat}>
              <h3 className="text-xl font-bold mb-5 pb-2 border-b" style={{ color: colors.hero, borderColor: colors.light }}>{cat}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {catOffers.map((offer: any) => (
                  <OfferCard key={offer.id} offer={offer} colors={colors} onClick={() => setSelected(offer)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer: any) => (
            <OfferCard key={offer.id} offer={offer} colors={colors} onClick={() => setSelected(offer)} />
          ))}
        </div>
      )}

      {selected && (
        <ServiceModal
          offer={selected}
          colors={colors}
          onClose={() => setSelected(null)}
          bookingHref={bookingHref}
        />
      )}
    </>
  );
}
