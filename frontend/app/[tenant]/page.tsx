import type { Metadata } from "next";
import Script from "next/script";
import Image from "next/image";
import ContactForm from "./contact-form";
import SiteFooter from "./site-footer";
import ChatbotWidget from "../../components/ChatbotWidget";
import PreviewBanner from "./preview-banner";
import NavBar from "./navbar";
import { AtoutIconSVG } from "../../lib/atout-icons";

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
  const customCss: string = siteStyle.custom_css ?? "";
  const pagesEnabled: string[] = siteStyle.pages_enabled ?? ["home", "about", "services", "contact"];
  const showAbout = pagesEnabled.includes("about") && (isPreview || !!site.description);
  const showServices = pagesEnabled.includes("services") && (isPreview || (site.service_offer?.length > 0));

  return (
    <main className="min-h-screen bg-white text-gray-900" style={{ fontFamily: font }}>
      {previewBanner}

      {/* ── Tracking scripts ──────────────────────────────────────────────── */}
      {tracking.gtm_id && (
        <Script id="gtm" strategy="afterInteractive">{`
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
          var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
          j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${tracking.gtm_id}');
        `}</Script>
      )}
      {tracking.ga4_id && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${tracking.ga4_id}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer=window.dataLayer||[];
            function gtag(){dataLayer.push(arguments);}
            gtag('js',new Date());gtag('config','${tracking.ga4_id}');
          `}</Script>
        </>
      )}
      {tracking.meta_pixel_id && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init','${tracking.meta_pixel_id}');fbq('track','PageView');
        `}</Script>
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
        isPreview={isPreview}
      />

      {/* ── Behaviour tracker ────────────────────────────────────────────── */}
      <Script id="pp-tracker" strategy="afterInteractive">{`
        (function(){
          var SLUG='${tenantSlug}',API='${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'}';
          var sid=sessionStorage.getItem('_pp_sid');
          if(!sid){sid=Math.random().toString(36).slice(2)+Date.now().toString(36);sessionStorage.setItem('_pp_sid',sid);}
          function send(type,section,data){
            fetch(API+'/api/v1/analytics/event',{method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({tenant_slug:SLUG,session_id:sid,event_type:type,section:section||null,data:data||null}),
              keepalive:true}).catch(function(){});
          }
          send('pageview');
          if(window.IntersectionObserver){
            var seen={};
            var obs=new IntersectionObserver(function(entries){
              entries.forEach(function(e){
                if(e.isIntersecting&&!seen[e.target.id]){seen[e.target.id]=1;send('section_view',e.target.id);}
              });
            },{threshold:0.3});
            ['hero','a-propos','prestations','contact'].forEach(function(id){
              var el=document.getElementById(id);if(el)obs.observe(el);
            });
          }
          document.addEventListener('click',function(e){
            var el=e.target.closest('[data-track]');
            if(el)send('cta_click',null,{action:el.getAttribute('data-track')});
          });
          document.addEventListener('submit',function(e){
            var f=e.target.closest('form[data-track-form]');
            if(f)send('form_submit',f.getAttribute('data-track-form'));
          });
        })();
      `}</Script>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section
        id="hero"
        className="relative min-h-[88vh] flex flex-col justify-center items-center text-center px-6 overflow-hidden"
      >
        {/* Background */}
        {photoUrls.hero ? (
          <>
            <Image src={photoUrls.hero} alt="" fill className="object-cover object-center" priority sizes="100vw" />
            <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${colors.hero}e6 0%, ${colors.accent}bb 100%)` }} />
          </>
        ) : (
          <div className="absolute inset-0" style={{ background: `linear-gradient(160deg, ${colors.hero} 0%, ${colors.accent} 100%)` }} />
        )}
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
          <div className={`max-w-5xl mx-auto${photoUrls.about ? " grid sm:grid-cols-2 gap-12 items-center" : " max-w-3xl"}`}>
            {photoUrls.about && (
              <div className="relative">
                <Image
                  src={photoUrls.about}
                  alt={`${site.title} — présentation`}
                  width={600}
                  height={420}
                  className="w-full h-72 sm:h-96 object-cover rounded-3xl shadow-xl"
                />
                <div className="absolute -bottom-4 -right-4 w-24 h-24 rounded-2xl opacity-30 -z-10" style={{ backgroundColor: colors.accent }} />
              </div>
            )}
            <div className={photoUrls.about ? "" : "text-center"}>
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
        </section>
      )}

      {/* ── PRESTATIONS ──────────────────────────────────────────────────── */}
      {showServices && (
        <section id="prestations" className="py-20 px-6 relative overflow-hidden" data-reveal style={{ backgroundColor: "#f8fafc" }}>
          {photoUrls.services && (
            <>
              <Image src={photoUrls.services} alt="" fill className="object-cover object-center" sizes="100vw" />
              <div className="absolute inset-0 bg-white/85 backdrop-blur-sm" />
            </>
          )}
          <div className="relative z-10 max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full mb-4" style={{ backgroundColor: colors.light, color: colors.hero }}>
                Prestations
              </span>
              <h2 className="tc-s text-3xl sm:text-5xl font-bold text-gray-900">Nos services</h2>
            </div>
            {site.service_offer?.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {site.service_offer.map((offer: any) => (
                  <div
                    key={offer.id}
                    className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 border border-gray-100/80"
                  >
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
                ))}
              </div>
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
        <section className="py-20 px-6 bg-white" data-reveal>
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

          <div className={`grid gap-10 ${photoUrls.contact ? "sm:grid-cols-[auto_1fr_1fr]" : "sm:grid-cols-2"} items-start`}>
            {photoUrls.contact && (
              <Image src={photoUrls.contact} alt={`Contacter ${site.title}`} width={320} height={280} className="w-full h-56 sm:h-auto object-cover rounded-3xl shadow-lg" />
            )}

            {/* Infos */}
            <div className="space-y-4">
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

      {/* ── Schema.org LocalBusiness ─────────────────────────────────────── */}
      {!isPreview && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LocalBusiness",
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
      )}
    </main>
  );
}
