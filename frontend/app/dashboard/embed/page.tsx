"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/api";

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
          className={`text-xs px-3 py-1 rounded-lg font-medium transition-colors ${copied ? "bg-green-100 text-green-700" : "bg-indigo-50 text-indigo-600 hover:bg-indigo-100"}`}>
          {copied ? "Copié ✓" : "Copier"}
        </button>
      </div>
      <pre id={id} className="bg-gray-900 text-green-300 text-xs rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

export default function EmbedPage() {
  const [tenantSlug, setTenantSlug] = useState("");
  const [siteData, setSiteData] = useState<{ ga4_id?: string; meta_pixel_id?: string; gtm_id?: string } | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
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

      // Récupérer tracking IDs depuis le site
      const { data: site } = await supabase
        .from("site")
        .select("site_style")
        .eq("status", "published")
        .single();
      if (site?.site_style?.tracking) setSiteData(site.site_style.tracking);
    };
    load();
  }, []);

  const chatbotScript = `<!-- Chatbot IA — à coller avant </body> -->
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${appUrl}/embed/chatbot/${tenantSlug}';
    iframe.style.cssText = 'position:fixed;bottom:24px;right:24px;width:60px;height:60px;border:none;z-index:9999;border-radius:50%;box-shadow:0 4px 20px rgba(0,0,0,0.15)';
    iframe.id = 'saas-chatbot';
    document.body.appendChild(iframe);
    window.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'saas-chatbot-resize') {
        var el = document.getElementById('saas-chatbot');
        if (el) { el.style.width = e.data.w; el.style.height = e.data.h; el.style.borderRadius = e.data.r || '50%'; }
      }
    });
  })();
</script>`;

  const ga4Script = siteData?.ga4_id ? `<!-- Google Analytics 4 — à coller dans <head> -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${siteData.ga4_id}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${siteData.ga4_id}');
</script>` : "";

  const metaScript = siteData?.meta_pixel_id ? `<!-- Meta Pixel — à coller dans <head> -->
<script>
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '${siteData.meta_pixel_id}');
  fbq('track', 'PageView');
</script>` : "";

  const gtmScript = siteData?.gtm_id ? `<!-- Google Tag Manager — à coller dans <head> -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${siteData.gtm_id}');</script>

<!-- Google Tag Manager (noscript) — à coller après <body> -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${siteData.gtm_id}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>` : "";

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-10 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold">Intégrer sur votre site existant</h1>
          <p className="text-sm text-gray-500 mt-0.5">Copiez-collez ces codes sur votre site pour ajouter le chatbot et le tracking.</p>
        </div>
      </div>

      {/* Chatbot */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">1</span>
          <div>
            <h2 className="font-semibold text-gray-800">Chatbot IA</h2>
            <p className="text-xs text-gray-500">Ajoute un assistant intelligent sur votre site existant</p>
          </div>
        </div>

        {tenantSlug ? (
          <CopyBlock
            label="Collez ce code avant la balise </body> de votre site"
            code={chatbotScript}
            id="chatbot-code"
          />
        ) : (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
            Chargement de votre identifiant...
          </div>
        )}

        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700 space-y-1">
          <p className="font-medium">Plateformes compatibles :</p>
          <p>WordPress, Wix, Squarespace, Webflow, Shopify, ou tout site HTML/JS personnalisé.</p>
        </div>
      </section>

      {/* Tracking */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold">2</span>
          <div>
            <h2 className="font-semibold text-gray-800">Tracking & Analytics</h2>
            <p className="text-xs text-gray-500">Mesurez les visites et le comportement sur votre site existant</p>
          </div>
        </div>

        {(!siteData?.ga4_id && !siteData?.meta_pixel_id && !siteData?.gtm_id) ? (
          <div className="bg-gray-50 border rounded-xl px-4 py-4 text-sm text-gray-600 space-y-2">
            <p>Aucun ID de tracking configuré pour l&apos;instant.</p>
            <Link href="/dashboard/site-builder" className="text-indigo-600 hover:underline font-medium">
              → Configurer dans le constructeur de site (étape 9)
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {ga4Script && <CopyBlock label="Google Analytics 4 — dans <head>" code={ga4Script} id="ga4-code" />}
            {metaScript && <CopyBlock label="Meta Pixel — dans <head>" code={metaScript} id="meta-code" />}
            {gtmScript && <CopyBlock label="Google Tag Manager — dans <head> et <body>" code={gtmScript} id="gtm-code" />}
          </div>
        )}
      </section>

      {/* Instructions */}
      <section className="bg-gray-50 rounded-2xl p-6 space-y-4">
        <h2 className="font-semibold text-gray-800">Comment intégrer ces codes ?</h2>
        <div className="space-y-3 text-sm text-gray-600">
          {[
            { icon: "🔧", title: "WordPress", desc: 'Utilisez le plugin "Insert Headers and Footers" ou collez dans Apparence → Éditeur de thème → header.php' },
            { icon: "🎨", title: "Wix", desc: "Paramètres → Paramètres avancés → Code personnalisé → Ajouter un code" },
            { icon: "📦", title: "Squarespace", desc: "Paramètres → Avancé → Code d'injection → En-tête / Pied de page" },
            { icon: "🌊", title: "Webflow", desc: "Paramètres du projet → Code personnalisé → Dans <head> ou avant </body>" },
            { icon: "🛒", title: "Shopify", desc: "Thèmes → Modifier le code → theme.liquid → Collez dans <head> ou avant </body>" },
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
  );
}
