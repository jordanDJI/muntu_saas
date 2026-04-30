import { createClient } from "@supabase/supabase-js";
import Script from "next/script";
import ContactForm from "./contact-form";
import ChatbotWidget from "../../components/ChatbotWidget";

// Palettes de couleurs applicables via CSS inline (évite les problèmes de purge Tailwind)
const COLOR_HEX: Record<string, { hero: string; accent: string; light: string }> = {
  indigo: { hero: "#4338ca", accent: "#4f46e5", light: "#e0e7ff" },
  blue:   { hero: "#1e3a8a", accent: "#1d4ed8", light: "#dbeafe" },
  green:  { hero: "#15803d", accent: "#16a34a", light: "#dcfce7" },
  red:    { hero: "#b91c1c", accent: "#dc2626", light: "#fee2e2" },
  purple: { hero: "#7e22ce", accent: "#9333ea", light: "#f3e8ff" },
  slate:  { hero: "#475569", accent: "#64748b", light: "#f1f5f9" },
};

const FONT_FAMILY: Record<string, string> = {
  modern:      "system-ui, -apple-system, sans-serif",
  classic:     "Georgia, 'Times New Roman', serif",
  handwritten: "'Brush Script MT', 'Segoe Script', cursive",
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function getSiteData(slug: string) {
  const { data: tenant } = await supabaseAdmin
    .from("tenant")
    .select("id, name")
    .eq("slug", slug)
    .single();

  if (!tenant) return null;

  const { data: site } = await supabaseAdmin
    .from("site")
    .select("*, service_offer(*), service_area(*), testimonial(*)")
    .eq("tenant_id", tenant.id)
    .eq("status", "published")
    .single();

  return site ? { ...site, tenant } : null;
}

export default async function TenantSitePage({ params }: { params: Promise<{ tenant: string }> }) {
  const { tenant: tenantSlug } = await params;
  const site = await getSiteData(tenantSlug);

  if (!site) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Site introuvable ou non publié.</p>
      </main>
    );
  }

  const social = site.social_links ?? {};
  const zones: string[] = site.coverage_zones?.length
    ? site.coverage_zones
    : (site.service_area ?? []).map((a: any) => a.city).filter(Boolean);
  const values: any[] = site.values_list ?? [];
  const testimonials: any[] = site.testimonial ?? [];

  // Styles dynamiques depuis site_style
  const siteStyle = site.site_style ?? {};
  const colors = COLOR_HEX[siteStyle.primary_color ?? "indigo"] ?? COLOR_HEX.indigo;
  const font = FONT_FAMILY[siteStyle.font_style ?? "modern"] ?? FONT_FAMILY.modern;
  const tracking = siteStyle.tracking ?? {};
  const photoUrls = siteStyle.photo_urls ?? {};
  const customCss: string = siteStyle.custom_css ?? "";
  const pagesEnabled: string[] = siteStyle.pages_enabled ?? ["home", "about", "services", "contact"];
  const showAbout = pagesEnabled.includes("about");
  const showServices = pagesEnabled.includes("services");

  return (
    <main className="min-h-screen bg-white text-gray-900" style={{ fontFamily: font }}>

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

      {/* ── CSS personnalisé premium ───────────────────────────────────────── */}
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      {/* Absence banner */}
      {site.absence_mode && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-center py-3 px-6 text-sm">
          {site.absence_message ?? "Actuellement indisponible — merci de revenir ultérieurement."}
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg" style={{ color: colors.hero }}>{site.title}</span>
          <div className="hidden sm:flex items-center gap-6 text-sm font-medium text-gray-600">
            {showServices && site.service_offer?.length > 0 && <a href="#prestations" className="hover:opacity-80 transition-opacity" style={{ color: colors.accent }}>Prestations</a>}
            {showAbout && site.description && <a href="#a-propos" className="hover:opacity-80 transition-opacity" style={{ color: colors.accent }}>À propos</a>}
            <a href="#contact" className="hover:opacity-80 transition-opacity" style={{ color: colors.accent }}>Contact</a>
          </div>
          <a
            href="#contact"
            className="text-white text-sm font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: colors.accent }}
          >
            Nous contacter
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="text-white py-24 px-6 text-center relative"
        style={photoUrls.hero
          ? { backgroundImage: `url(${photoUrls.hero})`, backgroundSize: "cover", backgroundPosition: "center" }
          : { backgroundColor: colors.hero }}
      >
        {photoUrls.hero && <div className="absolute inset-0" style={{ backgroundColor: `${colors.hero}cc` }} />}
        <div className="relative z-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold">{site.title}</h1>
          {site.tagline && (
            <p className="mt-4 text-xl max-w-2xl mx-auto" style={{ color: "rgba(255,255,255,0.8)" }}>{site.tagline}</p>
          )}
          {zones.length > 0 && (
            <p className="mt-3 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
              {zones.join(" · ")}
            </p>
          )}
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#contact" className="bg-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition-opacity" style={{ color: colors.hero }}>
              Prendre rendez-vous
            </a>
            <a href="#prestations" className="border border-white/50 text-white font-semibold px-8 py-3 rounded-xl hover:bg-white/10 transition-colors">
              Nos prestations
            </a>
          </div>
        </div>
      </section>

      {/* À propos */}
      {showAbout && site.description && (
        <section id="a-propos" className="py-16 px-6">
          <div className={`max-w-3xl mx-auto text-center${photoUrls.about ? " sm:grid sm:grid-cols-2 sm:gap-10 sm:text-left sm:max-w-5xl sm:items-center" : ""}`}>
            {photoUrls.about && (
              <img src={photoUrls.about} alt="À propos" className="w-full h-64 object-cover rounded-2xl shadow-md mb-6 sm:mb-0" />
            )}
            <div>
              <h2 className="text-2xl font-bold mb-6">À propos</h2>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{site.description}</p>
            </div>
          </div>
        </section>
      )}

      {/* Prestations */}
      {showServices && site.service_offer?.length > 0 && (
        <section id="prestations" className="py-16 px-6 relative" style={photoUrls.services ? { backgroundImage: `url(${photoUrls.services})`, backgroundSize: "cover", backgroundPosition: "center" } : { backgroundColor: "#f9fafb" }}>
          {photoUrls.services && <div className="absolute inset-0 bg-white/80" />}
          <div className="relative z-10 max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">Nos prestations</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {site.service_offer.map((offer: any) => (
                <div key={offer.id} className="bg-white border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                  <h3 className="font-semibold text-lg">{offer.name}</h3>
                  {offer.description && (
                    <p className="text-gray-500 mt-2 text-sm leading-relaxed">{offer.description}</p>
                  )}
                  {((offer.duration_min ?? offer.duration_minutes) || (offer.price_eur ?? offer.price_from)) && (
                    <div className="flex gap-3 mt-4 text-sm flex-wrap">
                      {(offer.duration_min ?? offer.duration_minutes) && (
                        <span className="px-3 py-1 rounded-full text-white" style={{ backgroundColor: colors.accent }}>
                          {offer.duration_min ?? offer.duration_minutes} min
                        </span>
                      )}
                      {(offer.price_eur ?? offer.price_from) && (
                        <span className="px-3 py-1 rounded-full font-medium" style={{ backgroundColor: colors.light, color: colors.hero }}>
                          {offer.price_eur ?? offer.price_from} €
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Zones d'intervention */}
      {zones.length > 0 && (
        <section className="py-12 px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-xl font-bold mb-4 text-gray-700">Zones d'intervention</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {zones.map((z: string) => (
                <span key={z} className="px-4 py-1.5 rounded-full text-sm font-medium" style={{ backgroundColor: colors.light, color: colors.hero }}>
                  {z}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Nos atouts */}
      {values.length > 0 && (
        <section className="py-16 px-6" style={{ backgroundColor: colors.light }}>
          <div className="max-w-5xl mx-auto">
            <h2 className="text-2xl font-bold mb-10 text-center">Pourquoi nous choisir ?</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {values.map((v: any, i: number) => (
                <div key={i} className="bg-white rounded-xl p-5 shadow-sm space-y-2">
                  <span className="text-3xl">{v.icon}</span>
                  <h3 className="font-semibold text-gray-900">{v.title}</h3>
                  {v.description && <p className="text-sm text-gray-500 leading-relaxed">{v.description}</p>}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Témoignages */}
      {testimonials.length > 0 && (
        <section className="py-16 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-8 text-center">Ce que disent nos clients</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {testimonials.map((t: any) => (
                <div key={t.id} className="bg-white border rounded-xl p-5 shadow-sm space-y-3">
                  <div className="flex">
                    {Array.from({ length: t.rating ?? 5 }).map((_, i) => (
                      <span key={i} className="text-yellow-400 text-sm">★</span>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed italic">"{t.content}"</p>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{t.author_name}</p>
                    {t.author_role && <p className="text-xs text-gray-400">{t.author_role}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Contact */}
      <section id="contact" className="bg-gray-50 py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold mb-8 text-center">Prendre contact</h2>
          <div className={`grid gap-10 ${photoUrls.contact ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {photoUrls.contact && (
              <img src={photoUrls.contact} alt="Contact" className="w-full h-48 sm:h-full object-cover rounded-2xl shadow-md" />
            )}
            <div className="space-y-4">
              {site.phone && (
                <div className="flex items-start gap-3">
                  <span className="text-xl">📞</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Téléphone</p>
                    <a href={`tel:${site.phone}`} className="hover:underline text-sm" style={{ color: colors.accent }}>{site.phone}</a>
                  </div>
                </div>
              )}
              {site.email_contact && (
                <div className="flex items-start gap-3">
                  <span className="text-xl">✉️</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Email</p>
                    <a href={`mailto:${site.email_contact}`} className="hover:underline text-sm" style={{ color: colors.accent }}>{site.email_contact}</a>
                  </div>
                </div>
              )}
              {site.address && (
                <div className="flex items-start gap-3">
                  <span className="text-xl">📍</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Adresse</p>
                    <p className="text-sm text-gray-500">{site.address}</p>
                  </div>
                </div>
              )}
              {(social.facebook || social.instagram || social.linkedin) && (
                <div className="flex gap-3 pt-2">
                  {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline" style={{ color: colors.accent }}>Facebook</a>}
                  {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline" style={{ color: colors.accent }}>Instagram</a>}
                  {social.linkedin && <a href={social.linkedin} target="_blank" rel="noreferrer" className="text-sm font-medium hover:underline" style={{ color: colors.accent }}>LinkedIn</a>}
                </div>
              )}
            </div>
            <ContactForm tenantSlug={tenantSlug} accentColor={colors.accent} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-gray-400 py-8 px-6 text-center text-sm" style={{ backgroundColor: colors.hero }}>
        <p className="font-semibold text-white mb-1">{site.title}</p>
        {site.tagline && <p className="mb-3" style={{ color: "rgba(255,255,255,0.6)" }}>{site.tagline}</p>}
        <p style={{ color: "rgba(255,255,255,0.4)" }}>© {new Date().getFullYear()} {site.title}. Tous droits réservés.</p>
      </footer>

      <ChatbotWidget tenantSlug={tenantSlug} />
    </main>
  );
}
