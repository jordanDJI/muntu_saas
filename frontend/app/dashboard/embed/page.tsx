"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";
import { UpgradeGate } from "../components/UpgradeGate";
import { IntegrationsPanel, ChatbotReadiness, type Integration } from "../components/IntegrationsPanel";
import { useLanguage } from "../../../contexts/LanguageContext";

// Ces codes partent sur le site d'un client : ils doivent pointer vers la prod
// même quand le dashboard est ouvert en local ou sur une preview Vercel.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co").replace(/\/$/, "");

function CopyBlock({ label, code, id, copyLabel, copiedLabel }: { label: string; code: string; id: string; copyLabel: string; copiedLabel: string }) {
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
          {copied ? copiedLabel : copyLabel}
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
  const { t } = useLanguage();
  const [tenantSlug, setTenantSlug] = useState("");
  const [siteData, setSiteData] = useState<{ ga4_id?: string; meta_pixel_id?: string; gtm_id?: string } | null>(null);
  const [selected, setSelected] = useState<Integration | null>(null);

  useEffect(() => {
    const load = async () => {
      // Via l'API : le join imbriqué sur `tenant` depuis le client ne renvoyait
      // rien, et le `.single()` cassait pour les comptes multi-espaces.
      const tenant = await api.getMyTenant().catch(() => null);
      setTenantSlug(tenant?.slug ?? "");

      const sites = await api.getSites().catch(() => []) as any[];
      const tracking = sites?.[0]?.site_style?.tracking;
      if (tracking) setSiteData(tracking);
    };
    load();
  }, []);

  // Présélection : la première intégration active, et suivi des changements
  // (renommage, désactivation) de celle qui est affichée.
  const onLoaded = useCallback((rows: Integration[]) => {
    setSelected(prev => {
      if (prev) return rows.find(r => r.id === prev.id) ?? null;
      return rows.find(r => r.status === "active") ?? null;
    });
  }, []);

  // ── Snippets ──────────────────────────────────────────────────────────────

  const key = selected?.key ?? "";
  const attrs = (widget: string) =>
    `data-saas-widget="${widget}" data-saas-slug="${tenantSlug}" data-saas-integration="${key}" data-saas-lang="auto"`;
  const loaderTag = `<script src="${APP_URL}/embed.js" async></script>`;
  const langComment = `<!-- Langue : data-saas-lang="fr|en|de|nl", ou "auto" pour suivre la langue de la page -->`;

  const chatbotSnippet = `<!-- Chatbot IA (widget flottant) — avant </body>, une seule fois par page -->
${langComment}
<div ${attrs("chatbot")}></div>
${loaderTag}`;

  const bookSnippet = `<!-- Réservation : placez ce div là où le calendrier doit apparaître -->
${langComment}
<div ${attrs("book")}></div>`;

  const contactSnippet = `<!-- Formulaire de contact : placez ce div là où il doit apparaître -->
${langComment}
<div ${attrs("contact")}></div>`;

  const widgetUrl = (widget: "book" | "contact") =>
    `${APP_URL}/embed/${widget}/${tenantSlug}?integration=${key}`;
  const iframeSnippet = (widget: "book" | "contact", height: number) =>
    `<iframe src="${widgetUrl(widget)}" style="width:100%;height:${height}px;border:none;border-radius:16px" title="${widget === "book" ? "Réservation" : "Contact"}"></iframe>`;

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

  const ready = !!tenantSlug && !!selected;
  const copy = { copyLabel: t.emb_copy, copiedLabel: t.emb_copied };

  return (
    <UpgradeGate feature="embed_widget">
    <main className="max-w-3xl mx-auto p-6 space-y-10 pb-20">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
        <div>
          <h1 className="text-2xl font-bold">Intégrer sur votre site existant</h1>
          <p className="text-sm text-gray-500 mt-0.5">Créez une intégration par support (site, page, lien en bio) pour mesurer les demandes de chacun.</p>
        </div>
      </div>

      {/* Choix de l'intégration */}
      <section className="bg-white border rounded-2xl p-5">
        <IntegrationsPanel showCreate selectedId={selected?.id} onSelect={setSelected} onLoaded={onLoaded} />
      </section>

      {!ready ? (
        <div className="bg-gray-50 border rounded-xl px-4 py-4 text-sm text-gray-600">
          {tenantSlug ? "Créez ou sélectionnez une intégration pour obtenir son code." : t.dash_loading}
        </div>
      ) : selected!.status === "disabled" ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 text-sm text-amber-800">
          L&apos;intégration « {selected!.name} » est désactivée : ses widgets ne s&apos;affichent plus. Réactivez-la pour réutiliser son code.
        </div>
      ) : selected!.kind === "website" ? (
        <>
          <div className="bg-primary-50 border border-primary-100 rounded-xl px-4 py-3 space-y-2">
            <p className="text-sm font-semibold text-primary-800">Étape préalable : chargeur universel</p>
            <p className="text-xs text-primary-700">Ajoutez ce script une seule fois avant <code>&lt;/body&gt;</code>, même avec plusieurs widgets. Toujours en <code>https://</code>.</p>
            <CopyBlock label="Script universel (une fois par page)" code={loaderTag} id="loader-code" {...copy} />
          </div>

          <div id="embed-chatbot"><WidgetCard number={1} title={t.emb_chatbot_title} subtitle={t.emb_chatbot_desc}>
            <div className="space-y-4">
              <ChatbotReadiness />
              <CopyBlock label={t.emb_with_js} code={chatbotSnippet} id="chatbot-code" {...copy} />
            </div>
          </WidgetCard></div>

          <div id="embed-booking"><WidgetCard number={2} title={t.emb_booking_title} subtitle={t.emb_booking_desc}>
            <div className="space-y-4">
              <CopyBlock label={t.emb_code_label} code={bookSnippet} id="book-code" {...copy} />
              <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
                <p className="font-medium mb-1">Conseil d&apos;intégration</p>
                <p>Placez le widget dans un conteneur pleine largeur, pas dans une case de grille étroite. Sa hauteur est fixe (720 px) : si vous avez beaucoup de questions personnalisées et que le bas est coupé, forcez une hauteur plus grande dans le CSS de votre site.</p>
              </div>
            </div>
          </WidgetCard></div>

          <WidgetCard number={3} title={t.emb_contact_title} subtitle={t.emb_contact_desc}>
            <CopyBlock label={t.emb_code_label} code={contactSnippet} id="contact-code" {...copy} />
          </WidgetCard>
        </>
      ) : selected!.kind === "iframe" ? (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            Pour les outils qui acceptent une iframe mais pas de script (Notion, Carrd…). Le chatbot flottant n&apos;est pas disponible dans ce mode : il a besoin du chargeur <code>embed.js</code>.
          </div>
          <WidgetCard number={1} title={t.emb_booking_title} subtitle={t.emb_booking_desc}>
            <CopyBlock label={t.emb_code_label} code={iframeSnippet("book", 720)} id="book-iframe" {...copy} />
          </WidgetCard>
          <WidgetCard number={2} title={t.emb_contact_title} subtitle={t.emb_contact_desc}>
            <CopyBlock label={t.emb_code_label} code={iframeSnippet("contact", 620)} id="contact-iframe" {...copy} />
          </WidgetCard>
        </>
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
            Pour les supports qui n&apos;acceptent que des liens : bio Instagram, fiche Google, Linktree, signature d&apos;email… Chaque demande arrivée par ce lien est comptée pour « {selected!.name} ».
          </div>
          <WidgetCard number={1} title="Lien de réservation" subtitle="Ouvre directement le calendrier de prise de rendez-vous">
            <CopyBlock label="URL" code={widgetUrl("book")} id="book-link" {...copy} />
          </WidgetCard>
          <WidgetCard number={2} title="Lien de contact" subtitle="Ouvre directement le formulaire de contact">
            <CopyBlock label="URL" code={widgetUrl("contact")} id="contact-link" {...copy} />
          </WidgetCard>
        </>
      )}

      {/* Tracking */}
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
            {ga4Script && <CopyBlock label="Google Analytics 4 — dans &lt;head&gt;" code={ga4Script} id="ga4-code" {...copy} />}
            {metaScript && <CopyBlock label="Meta Pixel — dans &lt;head&gt;" code={metaScript} id="meta-code" {...copy} />}
            {gtmScript && <CopyBlock label="Google Tag Manager — dans &lt;head&gt; et &lt;body&gt;" code={gtmScript} id="gtm-code" {...copy} />}
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
