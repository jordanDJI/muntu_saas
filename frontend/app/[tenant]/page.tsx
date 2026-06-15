import type { Metadata } from "next";
import Script from "next/script";
import Image from "next/image";
import ContactForm from "./contact-form";
import SiteFooter from "./site-footer";
import ChatbotWidget from "../../components/ChatbotWidget";
import PreviewBanner from "./preview-banner";
import NavBar from "./navbar";
import { AtoutIconSVG } from "../../lib/atout-icons";
import { getSectorVocab } from "../../lib/sectorVocabulary";
import CookieBanner from "../../components/CookieBanner";
import TrackingScripts from "../../components/TrackingScripts";
import GallerySection from "../../components/GallerySection";

// Palettes de couleurs applicables via CSS inline (évite les problèmes de purge Tailwind)
const COLOR_HEX: Record<string, { hero: string; accent: string; light: string }> = {
  indigo: { hero: "#4338ca", accent: "#4f46e5", light: "#e0e7ff" },
  blue: { hero: "#1e3a8a", accent: "#1d4ed8", light: "#dbeafe" },
  green: { hero: "#15803d", accent: "#16a34a", light: "#dcfce7" },
  red: { hero: "#b91c1c", accent: "#dc2626", light: "#fee2e2" },
  purple: { hero: "#7e22ce", accent: "#9333ea", light: "#f3e8ff" },
  slate: { hero: "#475569", accent: "#64748b", light: "#f1f5f9" },
  teal: { hero: "#0f766e", accent: "#14b8a6", light: "#ccfbf1" },
  cyan: { hero: "#155e75", accent: "#0891b2", light: "#cffafe" },
  emerald: { hero: "#166534", accent: "#10b981", light: "#d1fae5" },
  amber: { hero: "#b45309", accent: "#f59e0b", light: "#fef3c7" },
  orange: { hero: "#c2410c", accent: "#f97316", light: "#ffedd5" },
  rose: { hero: "#be123c", accent: "#f43f5e", light: "#ffe4e6" },
  primary: { hero: "#4338ca", accent: "#6366f1", light: "#e0e7ff" },
  secondary: { hero: "#0f766e", accent: "#14b8a6", light: "#ccfbf1" },
  success: { hero: "#166534", accent: "#22c55e", light: "#dcfce7" },
  warning: { hero: "#b45309", accent: "#f59e0b", light: "#fef3c7" },
  danger: { hero: "#b91c1c", accent: "#ef4444", light: "#fee2e2" },
  neutral: { hero: "#334155", accent: "#64748b", light: "#f8fafc" },
  highlight: { hero: "#7e22ce", accent: "#a855f7", light: "#f3e8ff" },
};

const FONT_FAMILY: Record<string, string> = {
  modern: "system-ui, -apple-system, sans-serif",
  classic: "Georgia, 'Times New Roman', serif",
  handwritten: "'Brush Script MT', 'Segoe Script', cursive",
  rounded: "ui-rounded, 'Nunito', 'Varela Round', sans-serif",
  bold: "Impact, 'Arial Black', sans-serif",
  humanist: "'Gill Sans', 'Trebuchet MS', sans-serif",
  tech: "Consolas, 'Courier New', monospace",
};

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

function getVideoEmbed(url: string): { type: "youtube" | "vimeo" | "direct"; embedUrl: string } | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  if (yt) return { type: "youtube", embedUrl: `https://www.youtube.com/embed/${yt[1]}?rel=0` };
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return { type: "vimeo", embedUrl: `https://player.vimeo.com/video/${vm[1]}` };
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { type: "direct", embedUrl: url };
  return null;
}

function OfferCard({ offer, colors }: { offer: any; colors: { accent: string; light: string; hero: string } }) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 border border-gray-100/80">
      {offer.image_url ? (
        <Image src={offer.image_url} alt={offer.name} width={400} height={160} className="w-full h-40 object-cover" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
      ) : (
        <div className="h-2 w-full" style={{ backgroundColor: colors.accent }} />
      )}
      <div className="p-5">
        <h3 className="font-semibold text-gray-900 text-lg leading-snug">{offer.name}</h3>
        {offer.description && (
          <p className="text-gray-500 mt-2 text-sm leading-relaxed">{offer.description}</p>
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
      </div>
    </div>
  );
}

async function getSiteData(slug: string, preview = false) {
  try {
    const url = `${API_URL}/api/v1/public/site/${encodeURIComponent(slug)}${preview ? "?preview=true" : ""}`;
    const res = await fetch(url, { cache: preview ? "no-store" : "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams?: Promise<{ preview?: string }>;
}): Promise<Metadata> {
  const { tenant: tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  if (sp?.preview === "1") {
    return { title: "Aperçu — Klientys", robots: { index: false, follow: false } };
  }

  const site = await getSiteData(tenantSlug, false);
  if (!site) return { title: "Site introuvable — Klientys" };

  const title: string = site.title ?? "Site professionnel";
  const zones: string[] = (site.coverage_zones ?? []).filter(Boolean);

  const titleTag = zones.length > 0
    ? `${title} — ${zones.slice(0, 3).join(", ")}`
    : title;

  let desc: string = site.tagline ?? "";
  if (!desc && site.description) {
    desc = site.description.length > 155
      ? site.description.slice(0, 152) + "…"
      : site.description;
  }
  if (!desc) desc = `${title} — Retrouvez toutes les informations et prenez rendez-vous en ligne.`;

  const activeDomain: string | null = site.tenant?.custom_domain ?? null;
  const canonical = activeDomain ? `https://${activeDomain}` : `${APP_URL}/${tenantSlug}`;

  const primaryColor = site.site_style?.primary_color ?? "indigo";
  const ogColor = primaryColor === "custom" ? (site.site_style?.custom_color_hex ?? "indigo") : primaryColor;
  const ogImageUrl = `${APP_URL}/api/og?title=${encodeURIComponent(titleTag.slice(0, 60))}&zone=${encodeURIComponent(zones[0] ?? "")}&color=${encodeURIComponent(ogColor)}`;

  return {
    title: titleTag,
    description: desc,
    robots: { index: true, follow: true },
    alternates: { canonical },
    openGraph: {
      title: titleTag,
      description: desc,
      type: "website",
      url: canonical,
      siteName: "Klientys",
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: titleTag }],
    },
    twitter: { card: "summary_large_image", title: titleTag, description: desc, images: [ogImageUrl] },
  };
}

export default async function TenantSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ tenant: string }>;
  searchParams?: Promise<{ preview?: string }>;
}) {
  const { tenant: tenantSlug } = await params;
  const sp = searchParams ? await searchParams : {};
  const isPreview = sp?.preview === "1";
  const site = await getSiteData(tenantSlug, isPreview);

  if (!site) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Site introuvable ou non publié.</p>
      </main>
    );
  }


  const previewBanner = isPreview ? <PreviewBanner siteId={site.id} /> : null;

  const social = site.social_links ?? {};
  const zones: string[] = (site.coverage_zones ?? []).filter(Boolean);
  const values: any[] = site.values_list ?? [];
  const testimonials: any[] = site.testimonial ?? [];

  // Styles dynamiques depuis site_style
  const siteStyle = site.site_style ?? {};
  const resolvedColors = (() => {
    if (siteStyle.primary_color === "custom" && siteStyle.custom_color_hex) {
      const hex = siteStyle.custom_color_hex as string;
      return { hero: hex, accent: hex, light: hex + "22" };
    }
    return COLOR_HEX[siteStyle.primary_color ?? "indigo"] ?? COLOR_HEX.indigo;
  })();
  const colors = resolvedColors;
  const font = FONT_FAMILY[siteStyle.font_style ?? "modern"] ?? FONT_FAMILY.modern;
  const tracking = siteStyle.tracking ?? {};
  const photoUrls = siteStyle.photo_urls ?? {};
  const videoUrls = siteStyle.video_urls ?? {};
  const galleryPhotos: string[] = siteStyle.gallery_photos ?? [];
  const galleryDisplay: "horizontal" | "vertical" = siteStyle.gallery_display ?? "horizontal";
  const customCss: string = siteStyle.custom_css ?? "";
  const pagesEnabled: string[] = siteStyle.pages_enabled ?? ["home", "about", "services", "contact"];
  const showAbout = pagesEnabled.includes("about") && (isPreview || !!site.description);
  const showServices = pagesEnabled.includes("services") && (isPreview || (site.service_offer?.length > 0));

  const sector: string = site.tenant?.sector ?? "other";
  const sectorVocab = getSectorVocab(sector);
  const openingHours: Record<string, { open: boolean; from: string; to: string }> = siteStyle.opening_hours ?? {};
  const hasOpeningHours = Object.values(openingHours).some((d: any) => d?.open);

  // Grouper les offres par catégorie (pour restaurant/commerce)
  const offers: any[] = site.service_offer ?? [];
  const offersByCategory: Record<string, any[]> = {};
  const offersWithCategory = offers.filter((o: any) => o.category);
  if (offersWithCategory.length > 0) {
    for (const o of offers) {
      const cat = o.category || "Autres";
      if (!offersByCategory[cat]) offersByCategory[cat] = [];
      offersByCategory[cat].push(o);
    }
  }
  const useCategories = Object.keys(offersByCategory).length > 0;

  const DAYS_FR_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const DAYS_KEYS_PUB = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return (
    <main className="min-h-screen bg-white text-gray-900" style={{ fontFamily: font }}>
      {previewBanner}

      {/* ── Tracking (chargé après consentement cookies) ──────────────────── */}
      {!isPreview && (
        <TrackingScripts
          tracking={tracking}
          tenantSlug={tenantSlug}
          apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}
          consentKey={`${tenantSlug}_consent`}
        />
      )}

      {/* ── Fonts + scroll anchors ────────────────────────────────────────── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,600;0,700;1,400&display=swap');
        .tc-s { font-family: 'Cormorant Garamond', Georgia, serif; letter-spacing: -0.01em; }
        section[id], div[id] { scroll-margin-top: 80px; }
      ` }} />

      {/* ── CSS personnalisé premium ───────────────────────────────────────── */}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      {/* Absence banner */}
      {site.absence_mode && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-3 px-6 text-sm">
          {site.absence_message ?? "Actuellement indisponible — merci de revenir ultérieurement."}
        </div>
      )}

      {/* Nav */}
      <NavBar
        logoOption={siteStyle.logo_option ?? "text_only"}
        logoUrl={siteStyle.logo_url ?? ""}
        title={site.title}
        colors={colors}
        showServices={showServices}
        hasServices={(site.service_offer?.length ?? 0) > 0}
        showAbout={showAbout}
        hasDescription={!!site.description}
        hasGallery={galleryPhotos.length > 0}
        isPreview={isPreview}
      />


      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative min-h-[88vh] flex flex-col justify-center items-center text-center px-6 overflow-hidden"
      >
        {/* Background */}
        {(() => {
          const vid = getVideoEmbed(videoUrls.hero);
          if (vid) return (
            <>
              {vid.type === "direct"
                ? <video src={vid.embedUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
                : <iframe src={vid.embedUrl + "?autoplay=1&mute=1&loop=1&controls=0&modestbranding=1"} allow="autoplay; fullscreen" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ transform: "scale(1.1)" }} />
              }
              <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${colors.hero}cc 0%, ${colors.accent}99 100%)` }} />
            </>
          );
          if (photoUrls.hero) return (
            <>
              <Image src={photoUrls.hero} alt="" fill className="object-cover object-center" priority sizes="100vw" />
              <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${colors.hero}e6 0%, ${colors.accent}bb 100%)` }} />
            </>
          );
          return <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${colors.hero} 0%, ${colors.accent} 100%)` }} />;
        })()}
        {/* Decorative orbs */}
        <div className="absolute top-16 right-8 w-80 h-80 rounded-full blur-3xl opacity-20 pointer-events-none" style={{ backgroundColor: "white" }} />
        <div className="absolute bottom-10 left-4 w-60 h-60 rounded-full blur-3xl opacity-10 pointer-events-none" style={{ backgroundColor: "white" }} />

        <div className="relative z-10 max-w-3xl mx-auto">
          {/* Location badge */}
          {zones.length > 0 && (
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white/90 text-xs font-medium px-4 py-1.5 rounded-full mb-6 border border-white/20">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
              {zones.slice(0, 3).join(" · ")}
            </div>
          )}

          <h1 className="tc-s text-5xl sm:text-7xl font-bold text-white leading-tight">
            {site.title}
          </h1>

          {site.tagline && (
            <p className="tc-s mt-5 text-xl sm:text-2xl max-w-2xl mx-auto leading-relaxed italic font-normal" style={{ color: "rgba(255,255,255,0.82)" }}>
              {site.tagline}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <a
              href="#rdv"
              className="bg-white font-semibold px-7 py-3.5 rounded-2xl hover:scale-105 transition-transform shadow-lg text-base"
              style={{ color: colors.hero }}
            >
              Prendre rendez-vous →
            </a>
            {showServices && (
              <a
                href="#prestations"
                className="border-2 border-white/40 text-white font-semibold px-7 py-3.5 rounded-2xl hover:bg-white/10 transition-colors backdrop-blur-sm text-base"
              >
                Nos prestations
              </a>
            )}
          </div>

          {/* Trust signal */}
          {testimonials.length > 0 && (
            <div className="mt-8 flex items-center justify-center gap-2" style={{ color: "rgba(255,255,255,0.65)" }}>
              <div className="flex">
                {[1,2,3,4,5].map((i) => <span key={i} className="text-yellow-300 text-sm">★</span>)}
              </div>
              <span className="text-sm">{testimonials.length} avis client{testimonials.length > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Scroll arrow */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-50">
          <div className="w-px h-8 bg-white/60" />
          <svg width="12" height="8" viewBox="0 0 12 8" fill="none"><path d="M1 1l5 5 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      </section>

      {/* ── À PROPOS ─────────────────────────────────────────────────────── */}
      {showAbout && (
        <section id="a-propos" className="py-20 px-6 bg-white" data-reveal>
          {(() => {
            const vid = getVideoEmbed(videoUrls.about);
            const hasMedia = !!(vid || photoUrls.about);
            return (
              <div className={`max-w-5xl mx-auto${hasMedia ? " grid sm:grid-cols-2 gap-12 items-center" : " max-w-3xl"}`}>
                {hasMedia && (
                  <div className="relative">
                    {vid ? (
                      vid.type === "direct"
                        ? <video src={vid.embedUrl} controls className="w-full h-72 sm:h-96 object-cover rounded-3xl shadow-xl" />
                        : <div className="relative w-full rounded-3xl shadow-xl overflow-hidden" style={{ paddingBottom: "56.25%" }}>
                            <iframe src={vid.embedUrl} allow="fullscreen" allowFullScreen className="absolute inset-0 w-full h-full" />
                          </div>
                    ) : (
                      <>
                        <Image src={photoUrls.about} alt={`${site.title} — présentation`} width={600} height={420} className="w-full h-72 sm:h-96 object-cover rounded-3xl shadow-xl" />
                        <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl opacity-30 -z-10" style={{ backgroundColor: colors.accent }} />
                      </>
                    )}
                  </div>
                )}
                <div className={hasMedia ? "" : "text-center"}>
                  <span className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ backgroundColor: colors.light, color: colors.hero }}>
                    À propos
                  </span>
                  <h2 className="tc-s text-3xl sm:text-5xl font-bold text-gray-900 mb-5 leading-snug">
                    Qui sommes-nous ?
                  </h2>
                  {site.description ? (
                    <p className="text-gray-500 leading-relaxed text-base whitespace-pre-wrap">{site.description}</p>
                  ) : isPreview ? (
                    <p className="text-gray-400 italic text-sm">Description non configurée — complétez l'étape 2 du site-builder.</p>
                  ) : null}
                  {(site.phone || site.email_contact) && (
                    <a
                      href="#contact"
                      className="inline-flex items-center gap-2 mt-7 font-semibold text-sm px-5 py-2.5 rounded-xl transition-opacity hover:opacity-80"
                      style={{ backgroundColor: colors.light, color: colors.hero }}
                    >
                      Nous contacter
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
                    </a>
                  )}
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* ── PRESTATIONS ──────────────────────────────────────────────────── */}
      {showServices && (
        <section id="prestations" className="py-20 px-6 relative overflow-hidden" data-reveal style={{ backgroundColor: "#f8fafc" }}>
          {(() => {
            const vid = getVideoEmbed(videoUrls.services);
            if (vid) return (
              <>
                {vid.type === "direct"
                  ? <video src={vid.embedUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
                  : <iframe src={vid.embedUrl + "?autoplay=1&mute=1&loop=1&controls=0"} allow="autoplay" className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ transform: "scale(1.1)" }} />
                }
                <div className="absolute inset-0 bg-white/85 backdrop-blur-sm" />
              </>
            );
            if (photoUrls.services) return (
              <>
                <Image src={photoUrls.services} alt="" fill className="object-cover object-center" sizes="100vw" />
                <div className="absolute inset-0 bg-white/85 backdrop-blur-sm" />
              </>
            );
            return null;
          })()}
          <div className="relative z-10 max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ backgroundColor: colors.light, color: colors.hero }}>
                {sectorVocab.appointments}
              </span>
              <h2 className="tc-s text-3xl sm:text-5xl font-bold text-gray-900">
                {sector === "restaurant" ? "Notre carte" : sector === "commerce" ? "Nos produits" : "Nos services"}
              </h2>
            </div>
            {offers.length > 0 ? (
              useCategories ? (
                /* Affichage par catégories (restaurant / commerce) */
                <div className="space-y-10">
                  {Object.entries(offersByCategory).map(([cat, catOffers]) => (
                    <div key={cat}>
                      <h3 className="text-xl font-bold mb-5 pb-2 border-b" style={{ color: colors.hero, borderColor: colors.light }}>{cat}</h3>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {catOffers.map((offer: any) => (
                          <OfferCard key={offer.id} offer={offer} colors={colors} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Affichage classique en grille */
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {offers.map((offer: any) => (
                    <OfferCard key={offer.id} offer={offer} colors={colors} />
                  ))}
                </div>
              )
            ) : isPreview ? (
              <p className="text-center text-gray-400 italic text-sm">Prestations non configurées — complétez l'étape 5 du site-builder.</p>
            ) : null}
          </div>
        </section>
      )}

      {/* ── ZONES ────────────────────────────────────────────────────────── */}
      {zones.length > 0 && (
        <div className="py-8 px-6 border-y border-gray-100 bg-white">
          <div className="max-w-3xl mx-auto flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-400 mr-2">Zones d'intervention</span>
            {zones.map((z: string) => (
              <span key={z} className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: colors.light, color: colors.hero }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/></svg>
                {z}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── ATOUTS ───────────────────────────────────────────────────────── */}
      {values.length > 0 && (
        <section className="py-20 px-6" data-reveal style={{ backgroundColor: colors.light }}>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4 bg-white/60" style={{ color: colors.hero }}>
                Nos atouts
              </span>
              <h2 className="tc-s text-3xl sm:text-5xl font-bold" style={{ color: colors.hero }}>Pourquoi nous choisir ?</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {values.map((v: any, i: number) => (
                <div key={i} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow flex gap-4">
                  <div className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.light }}>
                    <AtoutIconSVG icon={v.icon || "star"} className="w-5 h-5" color={colors.hero} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">{v.title}</h3>
                    {v.description && <p className="text-sm text-gray-500 leading-relaxed">{v.description}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── TÉMOIGNAGES ──────────────────────────────────────────────────── */}
      {testimonials.length > 0 && (
        <section id="temoignages" className="py-20 px-6 bg-white" data-reveal>
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ backgroundColor: colors.light, color: colors.hero }}>
                Témoignages
              </span>
              <h2 className="tc-s text-3xl sm:text-5xl font-bold text-gray-900">Ce que disent nos clients</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {testimonials.map((t: any) => (
                <div key={t.id} className="rounded-2xl p-6 border border-gray-100 hover:border-transparent hover:shadow-lg transition-all" style={{ backgroundColor: "#fafafa" }}>
                  <div className="text-4xl leading-none mb-3 font-serif" style={{ color: colors.accent }}>"</div>
                  <div className="flex mb-3">
                    {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                      <span key={i} className="text-yellow-400 text-sm">★</span>
                    ))}
                    {Array.from({ length: 5 - (t.rating ?? 5) }).map((_, i) => (
                      <span key={i} className="text-gray-200 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">{t.content}</p>
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: colors.accent }}>
                      {t.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{t.author_name}</p>
                      {t.author_role && <p className="text-xs text-gray-400">{t.author_role}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── GALERIE ──────────────────────────────────────────────────────── */}
      {galleryPhotos.length > 0 && (
        <GallerySection photos={galleryPhotos} display={galleryDisplay} accentColor={colors.accent} />
      )}

      {/* ── CONTACT ──────────────────────────────────────────────────────── */}
      <section id="contact" className="py-20 px-6 relative overflow-hidden" data-reveal>
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${colors.hero}08 0%, ${colors.accent}10 100%)` }} />
        <div className="relative z-10 max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ backgroundColor: colors.light, color: colors.hero }}>
              Contact
            </span>
            <h2 className="tc-s text-3xl sm:text-5xl font-bold text-gray-900">Prenons contact</h2>
            <p className="mt-3 text-gray-500">Nous vous répondons dans les plus brefs délais.</p>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 items-start">

            {/* Infos + photo éventuelle dans la même colonne */}
            <div className="space-y-4">
              {(() => {
                const vid = getVideoEmbed(videoUrls.contact);
                if (vid) return vid.type === "direct"
                  ? <video src={vid.embedUrl} controls className="w-full rounded-3xl shadow-lg mb-2" style={{ maxHeight: "224px" }} />
                  : <div className="relative w-full rounded-3xl shadow-lg overflow-hidden mb-2" style={{ paddingBottom: "56.25%" }}>
                      <iframe src={vid.embedUrl} allow="fullscreen" allowFullScreen className="absolute inset-0 w-full h-full" />
                    </div>;
                if (photoUrls.contact) return (
                  <Image src={photoUrls.contact} alt={`Contacter ${site.title}`} width={600} height={360} className="w-full h-56 object-cover rounded-3xl shadow-lg mb-2" />
                );
                return null;
              })()}
              <h3 className="font-semibold text-gray-800 text-lg mb-5">Nos coordonnées</h3>
              {site.phone && (
                <a href={`tel:${site.phone}`} data-track="phone" className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow group border border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: colors.light }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.hero }}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.5 3.18 2 2 0 012.18 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.91 8.09a16 16 0 006 6l.56-.56a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Téléphone</p>
                    <p className="text-sm font-semibold group-hover:underline" style={{ color: colors.accent }}>{site.phone}</p>
                  </div>
                </a>
              )}
              {site.email_contact && (
                <a href={`mailto:${site.email_contact}`} data-track="email" className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow group border border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: colors.light }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: colors.hero }}><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Email</p>
                    <p className="text-sm font-semibold group-hover:underline truncate max-w-[180px]" style={{ color: colors.accent }}>{site.email_contact}</p>
                  </div>
                </a>
              )}
              {site.address && (
                <div className="flex items-center gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: colors.light }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: colors.hero }}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-medium">Adresse</p>
                    <p className="text-sm text-gray-600">{site.address}</p>
                  </div>
                </div>
              )}
              {/* Horaires d'ouverture */}
              {hasOpeningHours && (
                <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-400 font-medium mb-3">Horaires d'ouverture</p>
                  <div className="space-y-1.5">
                    {DAYS_KEYS_PUB.map((key, idx) => {
                      const dh = openingHours[key];
                      if (!dh) return null;
                      return (
                        <div key={key} className="flex items-center justify-between text-sm">
                          <span className="text-gray-500 w-10">{DAYS_FR_SHORT[idx]}</span>
                          {dh.open ? (
                            <span className="font-medium text-gray-700">{dh.from} – {dh.to}</span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Fermé</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {(social.facebook || social.instagram || social.linkedin) && (
                <div className="flex gap-2 pt-1">
                  {social.facebook && (
                    <a href={social.facebook} data-track="social_facebook" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold hover:scale-110 transition-transform" style={{ backgroundColor: colors.accent }}>f</a>
                  )}
                  {social.instagram && (
                    <a href={social.instagram} data-track="social_instagram" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold hover:scale-110 transition-transform" style={{ backgroundColor: colors.accent }}>ig</a>
                  )}
                  {social.linkedin && (
                    <a href={social.linkedin} data-track="social_linkedin" target="_blank" rel="noreferrer" className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold hover:scale-110 transition-transform" style={{ backgroundColor: colors.accent }}>in</a>
                  )}
                </div>
              )}
            </div>

            {/* Formulaire */}
            <div id="rdv">
              <ContactForm
                tenantSlug={tenantSlug}
                accentColor={colors.accent}
                offers={(site.service_offer ?? []).map((o: any) => ({ id: o.id, name: o.name }))}
                vocab={sectorVocab}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <SiteFooter
        site={site}
        colors={colors}
        showAbout={showAbout}
        showServices={showServices}
        tracking={tracking}
      />

      {/* Scroll-reveal animation */}
      <Script id="reveal" strategy="afterInteractive">{`
        (function(){
          var els=document.querySelectorAll('[data-reveal]');
          if(!els.length||!window.IntersectionObserver)return;
          els.forEach(function(el){
            el.style.opacity='0';
            el.style.transform='translateY(28px)';
            el.style.transition='opacity 0.6s ease, transform 0.6s ease';
          });
          var obs=new IntersectionObserver(function(entries){
            entries.forEach(function(e){
              if(e.isIntersecting){
                e.target.style.opacity='1';
                e.target.style.transform='none';
                obs.unobserve(e.target);
              }
            });
          },{threshold:0.1});
          els.forEach(function(el){obs.observe(el);});
        })();
      `}</Script>

      <ChatbotWidget tenantSlug={tenantSlug} />

      {/* ── Cookie consent ───────────────────────────────────────────────── */}
      {!isPreview && (
        <CookieBanner
          consentKey={`${tenantSlug}_consent`}
          privacyUrl="https://klientys.co/legal/privacy"
          accentColor={colors.accent}
        />
      )}

      {/* ── Schema.org ──────────────────────────────────────────────────── */}
      {!isPreview && (() => {
        const SCHEMA_TYPES: Record<string, string> = {
          health:     "Physician",
          beauty:     "BeautySalon",
          coaching:   "SportsActivityLocation",
          finance:    "FinancialService",
          trade:      "HomeAndConstructionBusiness",
          restaurant: "FoodEstablishment",
          commerce:   "Store",
          other:      "LocalBusiness",
        };
        const schemaType = SCHEMA_TYPES[sector] ?? "LocalBusiness";

        const DAY_SCHEMA: Record<string, string> = {
          mon: "https://schema.org/Monday",
          tue: "https://schema.org/Tuesday",
          wed: "https://schema.org/Wednesday",
          thu: "https://schema.org/Thursday",
          fri: "https://schema.org/Friday",
          sat: "https://schema.org/Saturday",
          sun: "https://schema.org/Sunday",
        };
        const openingHoursSpec = Object.entries(openingHours)
          .filter(([, v]) => v?.open)
          .map(([day, v]) => ({
            "@type": "OpeningHoursSpecification",
            dayOfWeek: DAY_SCHEMA[day],
            opens: v.from,
            closes: v.to,
          }));

        return (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": schemaType,
                name: site.title,
                description: site.tagline ?? site.description ?? undefined,
                url: `${APP_URL}/${tenantSlug}`,
                ...(site.phone && { telephone: site.phone }),
                ...(site.email_contact && { email: site.email_contact }),
                ...(site.address && {
                  address: (() => {
                    const parts = site.site_style?.address_parts;
                    if (parts?.city) {
                      return {
                        "@type": "PostalAddress",
                        streetAddress: parts.street ?? undefined,
                        postalCode: parts.postal_code ?? undefined,
                        addressLocality: parts.city,
                        addressCountry: parts.country ?? site.tenant?.country ?? "FR",
                      };
                    }
                    return { "@type": "PostalAddress", streetAddress: site.address };
                  })(),
                }),
                ...(openingHoursSpec.length > 0 && { openingHoursSpecification: openingHoursSpec }),
                ...(galleryPhotos.length > 0 && { image: galleryPhotos }),
                ...(zones.length > 0 && {
                  areaServed: zones.map((z: string) => ({ "@type": "City", name: z })),
                }),
                ...(testimonials.length > 0 && {
                  aggregateRating: {
                    "@type": "AggregateRating",
                    ratingValue: (testimonials.reduce((s: number, t: any) => s + (t.rating ?? 5), 0) / testimonials.length).toFixed(1),
                    reviewCount: testimonials.length,
                    bestRating: "5",
                    worstRating: "1",
                  },
                  review: testimonials.map((t: any) => ({
                    "@type": "Review",
                    reviewRating: { "@type": "Rating", ratingValue: String(t.rating ?? 5), bestRating: "5" },
                    author: { "@type": "Person", name: t.author_name },
                    reviewBody: t.content,
                  })),
                }),
                ...(site.service_offer?.length > 0 && {
                  hasOfferCatalog: {
                    "@type": "OfferCatalog",
                    name: "Prestations",
                    itemListElement: site.service_offer.map((o: any) => ({
                      "@type": "Offer",
                      itemOffered: {
                        "@type": "Service",
                        name: o.name,
                        ...(o.description && { description: o.description }),
                        ...(o.price_eur && { offers: { "@type": "Offer", price: o.price_eur, priceCurrency: "EUR" } }),
                      },
                    })),
                  },
                }),
                ...(Object.values(social).some(Boolean) && {
                  sameAs: [social.facebook, social.instagram, social.linkedin].filter(Boolean),
                }),
              }),
            }}
          />
        );
      })()}
    </main>
  );
}
