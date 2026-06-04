"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api, supabase } from "../../../lib/api";
import { UpgradeGate } from "../components/UpgradeGate";

function CopyBlock({ label, code, id }: { label: string; code: string; id: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <button onClick={copy}
          className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-primary-50 text-primary-600 hover:bg-primary-100"}`}>
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <pre id={id} className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

interface WidgetCardProps {
  number: number;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}
function WidgetCard({ number, title, subtitle, children }: WidgetCardProps) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-lg flex items-center justify-center text-sm font-bold">{number}</span>
        <div>
          <h2 className="font-semibold text-gray-800">{title}</h2>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function EmbedPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [siteData, setSiteData] = useState<{ ga4_id?: string; meta_pixel_id?: string; gtm_id?: string } | null>(null);
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: membership } = await supabase
        .from("membership")
        .select("tenant:tenant_id(slug)")
        .eq("user_id", user.id)
        .single();
      const slug = (membership?.tenant as any)?.slug ?? "";
      setTenantSlug(slug);

      const sites = await api.getSites().catch(() => []) as any[];
      const tracking = sites?.[0]?.site_style?.tracking;
      if (tracking) setSiteData(tracking);
    };
    load();
  }, []);

  // ── Snippets ──────────────────────────────────────────────────────────────

  const loaderTag = `<script src="${appUrl}/embed.js" async></script>`;

  const chatbotSnippet = `<!-- Chatbot IA (widget flottant) -->
<!-- Collez ce loader une fois avant </body> -->
<script src="${appUrl}/embed.js" async></script>

<!-- Puis ajoutez ce tag n'importe où dans la page -->
<div data-saas-widget="chatbot" data-saas-slug="${tenantSlug}"></div>`;

  const chatbotManualSnippet = `<!-- Alternative manuelle (sans embed.js) -->
<script>
(function(){
  var iframe=document.createElement('iframe');
  iframe.src='${appUrl}/embed/chatbot/${tenantSlug}';
  iframe.style.cssText='position:fixed;bottom:24px;right:24px;width:60px;height:60px;border:none;z-index:2147483647;border-radius:50%;box-shadow:0 4px 20px rgba(0,0,0,.15);transition:width .3s,height .3s,border-radius .3s;overflow:hidden';
  iframe.setAttribute('data-saas-type','chatbot');
  document.body.appendChild(iframe);
  window.addEventListener('message',function(e){
    if(e.data&&e.data.type==='saas-chatbot-resize'){
      iframe.style.width=e.data.w;iframe.style.height=e.data.h;iframe.style.borderRadius=e.data.r||'50%';
    }
  });
})();
</script>`;

  const bookSnippet = `<!-- Widget de réservation (calendrier en ligne) -->
<!-- Loader à ajouter une fois, si pas déjà présent -->
<script src="${appUrl}/embed.js" async></script>

<!-- Placez ce div là où vous voulez le widget -->
<div data-saas-widget="book" data-saas-slug="${tenantSlug}"></div>`;

  const contactSnippet = `<!-- Formulaire de contact -->
<!-- Loader à ajouter une fois, si pas déjà présent -->
<script src="${appUrl}/embed.js" async></script>

<!-- Placez ce div là où vous voulez le formulaire -->
<div data-saas-widget="contact" data-saas-slug="${tenantSlug}"></div>`;

  const ga4Script = siteData?.ga4_id ? `<!-- Google Analytics 4 — dans <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${siteData.ga4_id}"></script>
<script>
  window.dataLayer=window.dataLayer||[];
  function gtag(){dataLayer.push(arguments);}
  gtag('js',new Date());
  gtag('config','${siteData.ga4_id}');
</script>` : "";

  const metaScript = siteData?.meta_pixel_id ? `<!-- Meta Pixel — dans <head> -->
<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init','${siteData.meta_pixel_id}');
  fbq('track','PageView');
</script>` : "";

  const gtmScript = siteData?.gtm_id ? `<!-- Google Tag Manager — dans <head> -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${siteData.gtm_id}');</script>

<!-- Google Tag Manager (noscript) — après <body> -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${siteData.gtm_id}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : "";

  const loading = !tenantSlug;

  return (
    <UpgradeGate feature="embed_widget">
    <main className="max-w-3xl mx-auto p-6 space-y-10 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold">Intégrer sur votre site existant</h1>
          <p className="text-sm text-gray-500 mt-0.5">Copiez-collez ces codes pour ajouter les widgets sur n&apos;importe quel site.</p>
        </div>
      </div>

      {/* Loader info */}
      <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 space-y-2">
        <p className="text-sm font-semibold text-primary-800">Étape préalable : chargeur universel</p>
        <p className="text-xs text-primary-700">Ajoutez ce script une seule fois avant <code>&lt;/body&gt;</code> pour activer tous les widgets ci-dessous.</p>
        {!loading && <CopyBlock label="Script universel (une fois par site)" code={loaderTag} id="loader-code" />}
      </div>

      {/* 1 — Chatbot */}
      <WidgetCard number={1} title="Chatbot IA" subtitle="Assistant flottant en bas à droite, accessible depuis toutes les pages">
        {loading ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">Chargement…</div>
        ) : (
          <div className="space-y-4">
            <CopyBlock label="Avec embed.js (recommandé)" code={chatbotSnippet} id="chatbot-code" />
            <details className="text-xs text-gray-500 cursor-pointer">
              <summary className="hover:text-gray-700">Voir le code manuel (sans embed.js)</summary>
              <div className="mt-2">
                <CopyBlock label="Code autonome" code={chatbotManualSnippet} id="chatbot-manual" />
              </div>
            </details>
          </div>
        )}
      </WidgetCard>

      {/* 2 — Booking */}
      <WidgetCard number={2} title="Widget de réservation" subtitle="Calendrier + créneaux + formulaire — à intégrer sur une page dédiée">
        {loading ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">Chargement…</div>
        ) : (
          <div className="space-y-4">
            <CopyBlock label="Code à intégrer sur votre page" code={bookSnippet} id="book-code" />
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
              <p className="font-medium mb-1">Conseil d&apos;intégration</p>
              <p>Placez le widget dans un bloc centré de 480–600 px de large pour le meilleur rendu. Il s&apos;adapte automatiquement en hauteur selon l&apos;étape.</p>
            </div>
          </div>
        )}
      </WidgetCard>

      {/* 3 — Contact */}
      <WidgetCard number={3} title="Formulaire de contact" subtitle="Génère un lead dans votre dashboard à chaque envoi">
        {loading ? (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">Chargement…</div>
        ) : (
          <div className="space-y-4">
            <CopyBlock label="Code à intégrer sur votre page" code={contactSnippet} id="contact-code" />
          </div>
        )}
      </WidgetCard>

      {/* 4 — Tracking */}
      <WidgetCard number={4} title="Tracking & Analytics" subtitle="Mesurez les visites et le comportement sur votre site">
        {(!siteData?.ga4_id && !siteData?.meta_pixel_id && !siteData?.gtm_id) ? (
          <div className="bg-gray-50 border rounded-xl px-4 py-4 text-sm text-gray-600 space-y-2">
            <p>Aucun ID de tracking configuré pour l&apos;instant.</p>
            <Link href="/dashboard/site-builder" className="text-primary-600 hover:underline font-medium">
              → Configurer dans le constructeur de site (étape 9)
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {ga4Script && <CopyBlock label="Google Analytics 4 — dans &lt;head&gt;" code={ga4Script} id="ga4-code" />}
            {metaScript && <CopyBlock label="Meta Pixel — dans &lt;head&gt;" code={metaScript} id="meta-code" />}
            {gtmScript && <CopyBlock label="Google Tag Manager — dans &lt;head&gt; et &lt;body&gt;" code={gtmScript} id="gtm-code" />}
          </div>
        )}
      </WidgetCard>

      {/* Instructions */}
      <section className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Comment intégrer sur votre CMS ?</h2>
        <div className="space-y-3 text-sm text-gray-600">
          {[
            { icon: "🔧", title: "WordPress", desc: 'Plugin "Insert Headers and Footers" → Footer. Ou Apparence → Éditeur → footer.php' },
            { icon: "🎨", title: "Wix", desc: "Paramètres → Avancé → Code personnalisé → Bas de page" },
            { icon: "📦", title: "Squarespace", desc: "Paramètres → Avancé → Injection de code → Pied de page" },
            { icon: "🌊", title: "Webflow", desc: "Paramètres du projet → Code personnalisé → Avant </body>" },
            { icon: "🛒", title: "Shopify", desc: "Thèmes → Modifier le code → theme.liquid → avant </body>" },
          ].map((item) => (
            <div key={item.title} className="flex gap-3">
              <span className="text-xl flex-shrink-0">{item.icon}</span>
              <div>
                <p className="font-medium text-gray-700">{item.title}</p>
                <p className="text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

    </main>
    </UpgradeGate>
  );
}
