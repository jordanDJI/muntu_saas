"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, supabase } from "../../../lib/api";

// ── Constantes ────────────────────────────────────────────────────────────────

const COLOR_PALETTES = [
  { key: "indigo",   label: "Indigo",          hex: "#4338ca" },
  { key: "blue",     label: "Bleu marine",     hex: "#1e3a8a" },
  { key: "purple",   label: "Violet",          hex: "#7e22ce" },
  { key: "highlight",label: "Violet clair",    hex: "#a855f7" },
  { key: "teal",     label: "Sarcelle",        hex: "#0f766e" },
  { key: "cyan",     label: "Cyan",            hex: "#155e75" },
  { key: "green",    label: "Vert nature",     hex: "#15803d" },
  { key: "emerald",  label: "Émeraude",        hex: "#166534" },
  { key: "amber",    label: "Ambre",           hex: "#b45309" },
  { key: "orange",   label: "Orange",          hex: "#c2410c" },
  { key: "red",      label: "Rouge",           hex: "#b91c1c" },
  { key: "rose",     label: "Rose",            hex: "#be123c" },
  { key: "slate",    label: "Gris ardoise",    hex: "#475569" },
  { key: "neutral",  label: "Gris neutre",     hex: "#334155" },
];

const FONT_STYLES = [
  { key: "modern",      label: "Moderne et épuré",          hint: "Très lisible, professionnel",     preview: "system-ui, sans-serif" },
  { key: "classic",     label: "Classique et élégant",      hint: "Traditionnel, raffiné",           preview: "Georgia, serif" },
  { key: "handwritten", label: "Manuscrit / Artisanal",     hint: "Plus humain, chaleureux",         preview: "cursive" },
  { key: "rounded",     label: "Arrondi & Accessible",      hint: "Doux, inclusif, accessible",     preview: "ui-rounded, sans-serif" },
  { key: "bold",        label: "Gras & Impactant",          hint: "Fort, affirmé, mémorable",        preview: "Impact, sans-serif" },
  { key: "humanist",    label: "Humaniste & Chaleureux",    hint: "Convivial, proche des gens",      preview: "Gill Sans, sans-serif" },
  { key: "tech",        label: "Technique & Précis",        hint: "Consulting, IT, industrie",       preview: "Consolas, monospace" },
];

const PAGES = [
  { key: "home",     label: "Accueil",                    desc: "La vitrine principale",             locked: true },
  { key: "about",    label: "Présentation",               desc: "Qui vous êtes, votre parcours" },
  { key: "services", label: "Services / Prestations",     desc: "Ce que vous proposez exactement" },
  { key: "contact",  label: "Contact",                    desc: "Plan, téléphone, adresse email",    locked: true },
];

const PHOTO_SECTIONS = [
  {
    key: "hero",
    label: "Photo principale (héro)",
    hint: "Format paysage (16:9) · min. 1200 × 600 px",
    guide: {
      desc: "Occupe toute la largeur tout en haut de votre site. C'est la première image que voient vos visiteurs — elle sert de fond derrière votre titre et votre slogan.",
      format: "Format paysage (16:9) • min. 1200 × 600 px",
      examples: "Salle de soins, bureau professionnel, équipe au travail, ambiance de votre activité",
      highlight: "hero" as const,
    },
  },
  {
    key: "about",
    label: "Photo « À propos »",
    hint: "Format portrait ou carré · min. 600 × 700 px",
    guide: {
      desc: "S'affiche côte à côte avec votre texte de présentation dans la section « À propos ». Elle humanise votre page et inspire confiance.",
      format: "Format portrait ou carré • min. 600 × 700 px",
      examples: "Votre portrait professionnel, vous en action, photo de votre équipe ou cabinet",
      highlight: "about" as const,
    },
  },
  {
    key: "services",
    label: "Fond section Prestations",
    hint: "Format paysage large · min. 1400 × 600 px",
    guide: {
      desc: "Utilisée comme arrière-plan décoratif derrière vos cartes de prestations. Un voile blanc semi-transparent est appliqué automatiquement pour que les cartes restent lisibles.",
      format: "Format paysage large • min. 1400 × 600 px • préférez une image peu chargée",
      examples: "Texture douce, photo floue/atmosphérique de votre environnement, motif discret",
      highlight: "services" as const,
    },
  },
  {
    key: "contact",
    label: "Photo section Contact",
    hint: "Format portrait ou carré · min. 400 × 500 px",
    guide: {
      desc: "S'affiche à gauche du formulaire de contact pour rassurer et humaniser la prise de contact. Elle doit inspirer la bienveillance.",
      format: "Format portrait ou carré • min. 400 × 500 px",
      examples: "Votre espace d'accueil, votre bureau ou cabinet, un portrait souriant",
      highlight: "contact" as const,
    },
  },
];

type PhotoHighlight = "hero" | "about" | "services" | "contact";

function SiteWireframe({ highlight }: { highlight: PhotoHighlight }) {
  const ring = "ring-2 ring-indigo-500";
  return (
    <div className="space-y-1 text-[0px]">
      {/* Nav */}
      <div className="h-3 bg-gray-200 rounded-sm flex items-center px-1 gap-1">
        <div className="w-6 h-1.5 bg-gray-400 rounded-sm" />
        <div className="ml-auto flex gap-0.5">
          <div className="w-4 h-1 bg-gray-400 rounded-sm" />
          <div className="w-4 h-1 bg-gray-400 rounded-sm" />
        </div>
      </div>
      {/* Hero */}
      <div className={`h-11 rounded-sm flex flex-col items-center justify-center gap-0.5 transition-all ${highlight === "hero" ? `bg-indigo-400 ${ring}` : "bg-gray-300"}`}>
        {highlight === "hero"
          ? <span className="text-white font-bold" style={{ fontSize: 7 }}>📷 VOTRE PHOTO — Zone héro</span>
          : null}
        <div className={`h-1 w-14 rounded-sm ${highlight === "hero" ? "bg-white/50" : "bg-gray-400"}`} />
        <div className={`h-0.5 w-9 rounded-sm ${highlight === "hero" ? "bg-white/30" : "bg-gray-400"}`} />
      </div>
      {/* About */}
      <div className={`h-9 rounded-sm flex items-center gap-1 px-1 ${highlight === "about" ? `bg-white ${ring}` : "bg-gray-50"}`}>
        <div className={`w-9 h-7 rounded-sm flex-shrink-0 flex items-center justify-center ${highlight === "about" ? "bg-indigo-400" : "bg-gray-200"}`}>
          {highlight === "about" && <span className="text-white" style={{ fontSize: 6 }}>📷</span>}
        </div>
        <div className="flex-1 space-y-0.5 py-1">
          <div className={`h-0.5 rounded-sm ${highlight === "about" ? "bg-indigo-200" : "bg-gray-200"}`} />
          <div className={`h-0.5 rounded-sm w-4/5 ${highlight === "about" ? "bg-indigo-200" : "bg-gray-200"}`} />
          <div className={`h-0.5 rounded-sm ${highlight === "about" ? "bg-indigo-200" : "bg-gray-200"}`} />
        </div>
        {highlight === "about" && (
          <span className="text-indigo-600 font-bold flex-shrink-0" style={{ fontSize: 6 }}>← ICI</span>
        )}
      </div>
      {/* Services */}
      <div className={`h-11 rounded-sm flex flex-col items-center justify-center gap-1 px-1 ${highlight === "services" ? `bg-indigo-100 ${ring}` : "bg-gray-100"}`}>
        {highlight === "services" && (
          <span className="text-indigo-700 font-bold" style={{ fontSize: 6 }}>📷 FOND — Section prestations</span>
        )}
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`w-9 h-5 rounded-sm ${highlight === "services" ? "bg-white shadow-sm" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      {/* Contact */}
      <div className={`h-9 rounded-sm flex items-center gap-1 px-1 ${highlight === "contact" ? `bg-white ${ring}` : "bg-gray-50"}`}>
        <div className={`w-9 h-7 rounded-sm flex-shrink-0 flex items-center justify-center ${highlight === "contact" ? "bg-indigo-400" : "bg-gray-200"}`}>
          {highlight === "contact" && <span className="text-white" style={{ fontSize: 6 }}>📷</span>}
        </div>
        <div className={`flex-1 h-7 rounded-sm ${highlight === "contact" ? "bg-indigo-50" : "bg-gray-200"}`} />
        {highlight === "contact" && (
          <span className="text-indigo-600 font-bold flex-shrink-0" style={{ fontSize: 6 }}>← ICI</span>
        )}
      </div>
      {/* Footer */}
      <div className="h-3 bg-gray-700 rounded-sm" />
    </div>
  );
}

const STEPS = [
  { label: "Votre image" },
  { label: "Votre contenu" },
  { label: "Identité" },
  { label: "Contact & Réseaux" },
  { label: "Zones" },
  { label: "Prestations" },
  { label: "Atouts" },
  { label: "Témoignages" },
  { label: "Suivi & Lancement" },
];

// ── Types ─────────────────────────────────────────────────────────────────────

type Offer = { name: string; description: string; duration_min: string; price_eur: string; image_url: string };
type Value = { icon: string; title: string; description: string };
type Testimonial = { author_name: string; author_role: string; content: string; rating: number };

const EMPTY_OFFER = (): Offer => ({ name: "", description: "", duration_min: "", price_eur: "", image_url: "" });
const EMPTY_VALUE = (): Value => ({ icon: "⭐", title: "", description: "" });
const EMPTY_TESTIMONIAL = (): Testimonial => ({ author_name: "", author_role: "", content: "", rating: 5 });

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SiteBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  // Step 0 — Image & Style
  const [logoOption, setLogoOption] = useState<"has_logo" | "needs_creation" | "text_only">("text_only");
  const [primaryColor, setPrimaryColor] = useState("indigo");
  const [fontStyle, setFontStyle] = useState("modern");

  // Step 1 — Contenu
  const [pagesEnabled, setPagesEnabled] = useState<string[]>(["home", "about", "services", "contact"]);
  const [photosOption, setPhotosOption] = useState<"has_photos" | "needs_stock">("needs_stock");

  // Step 2 — Identité
  const [title, setTitle] = useState("");
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");

  // Step 3 — Contact & Réseaux
  const [phone, setPhone] = useState("");
  const [emailContact, setEmailContact] = useState("");
  const [address, setAddress] = useState("");
  const [facebook, setFacebook] = useState("");
  const [instagram, setInstagram] = useState("");
  const [linkedin, setLinkedin] = useState("");

  // Step 4 — Zones
  const [zones, setZones] = useState<string[]>([""]);

  // Step 5 — Prestations
  const [offers, setOffers] = useState<Offer[]>([EMPTY_OFFER()]);

  // Step 0 — Logo URL + modales
  const [logoUrl, setLogoUrl] = useState("");
  const [showLogoUrlHelp, setShowLogoUrlHelp] = useState(false);
  const [showLogoServiceModal, setShowLogoServiceModal] = useState(false);

  // Step 3 — 2e téléphone (stocké dans social_links)
  const [phone2, setPhone2] = useState("");

  // Step 4 — Zones autocomplete
  const [zoneSuggestions, setZoneSuggestions] = useState<{ idx: number; items: string[] } | null>(null);
  const zoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 6 — Valeurs
  const [values, setValues] = useState<Value[]>([EMPTY_VALUE()]);
  const [showAtoutsHelp, setShowAtoutsHelp] = useState(false);
  const [emojiPickerIdx, setEmojiPickerIdx] = useState<number | null>(null);

  // Step 7 — Témoignages
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // Step 8 — Suivi & Lancement
  const [ga4Id, setGa4Id] = useState("");
  const [metaPixelId, setMetaPixelId] = useState("");
  const [gtmId, setGtmId] = useState("");
  const [customCss, setCustomCss] = useState("");

  // Step 1 — Photos par section (conditionnel si has_photos)
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [openGuide, setOpenGuide] = useState<string | null>(null);

  const [noSite, setNoSite] = useState(false);
  const [loadError, setLoadError] = useState<"session" | string | null>(null);
  const [creating, setCreating] = useState(false);

  // ── Chargement du site existant ─────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      let sites: any[];
      try {
        sites = await api.getSites();
      } catch {
        // JWT peut manquer du tenant_id juste après l'onboarding → on tente un refresh
        try {
          await supabase.auth.refreshSession();
          sites = await api.getSites();
        } catch (err2: any) {
          const msg: string = err2?.message ?? "";
          const isSession = msg.toLowerCase().includes("tenant") || msg.includes("403") || msg.includes("Forbidden");
          setLoadError(isSession ? "session" : msg || "Erreur de chargement");
          setNoSite(true);
          return;
        }
      }
      if (!sites.length) { setNoSite(true); return; }
      const s = sites[0];
      setSiteId(s.id);

      // Récupérer le slug tenant pour le lien de prévisualisation
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: membership } = await supabase
          .from("membership")
          .select("tenant:tenant_id(slug)")
          .eq("user_id", user.id)
          .single();
        if (membership?.tenant) setTenantSlug((membership.tenant as any).slug ?? "");
      }

      // Style
      const style = s.site_style ?? {};
      setLogoOption(style.logo_option ?? "text_only");
      setLogoUrl(style.logo_url ?? "");
      setPrimaryColor(style.primary_color ?? "indigo");
      setFontStyle(style.font_style ?? "modern");
      setPagesEnabled(style.pages_enabled ?? ["home", "about", "services", "contact"]);
      setPhotosOption(style.photos_option ?? "needs_stock");
      setPhotoUrls(style.photo_urls ?? {});
      setGa4Id(style.tracking?.ga4_id ?? "");
      setMetaPixelId(style.tracking?.meta_pixel_id ?? "");
      setGtmId(style.tracking?.gtm_id ?? "");
      setCustomCss(style.custom_css ?? "");

      // Identité
      setTitle(s.title ?? "");
      setTagline(s.tagline ?? "");
      setDescription(s.description ?? "");

      // Contact
      setPhone(s.phone ?? "");
      setEmailContact(s.email_contact ?? "");
      setAddress(s.address ?? "");
      setFacebook(s.social_links?.facebook ?? "");
      setInstagram(s.social_links?.instagram ?? "");
      setLinkedin(s.social_links?.linkedin ?? "");
      setPhone2(s.social_links?.phone2 ?? "");

      // Zones
      setZones(s.coverage_zones?.length ? s.coverage_zones : [""]);

      // Valeurs
      setValues(s.values_list?.length ? s.values_list : [EMPTY_VALUE()]);

      // Prestations & Témoignages
      const [offersData, testimonialsData] = await Promise.all([
        api.getSiteOffers(s.id),
        api.getSiteTestimonials(s.id),
      ]);
      setOffers(
        offersData.length
          ? offersData.map((o: any) => ({
              name: o.name ?? "",
              description: o.description ?? "",
              duration_min: o.duration_min?.toString() ?? "",
              price_eur: o.price_eur?.toString() ?? "",
              image_url: o.image_url ?? "",
            }))
          : [EMPTY_OFFER()]
      );
      setTestimonials(testimonialsData.length ? testimonialsData : []);
    };
    load().catch(console.error);
  }, []);

  const flash = (text: string, ok = true) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  // ── Helper : construit l'objet site_style complet ──────────────────────────

  const buildSiteStyle = () => ({
    logo_option: logoOption,
    ...(logoUrl ? { logo_url: logoUrl } : {}),
    primary_color: primaryColor,
    font_style: fontStyle,
    pages_enabled: pagesEnabled,
    photos_option: photosOption,
    photo_urls: photoUrls,
    tracking: { ga4_id: ga4Id, meta_pixel_id: metaPixelId, gtm_id: gtmId },
    ...(customCss ? { custom_css: customCss } : {}),
  });

  // ── Sauvegarde par étape ────────────────────────────────────────────────────

  const saveStep = async (): Promise<boolean> => {
    if (!siteId) { flash("Aucun site trouvé", false); return false; }
    setSaving(true);
    try {
      switch (step) {
        case 0:
        case 1:
        case 8:
          await api.updateSite(siteId, { site_style: buildSiteStyle() });
          break;
        case 2:
          await api.updateSite(siteId, { title, tagline, description });
          break;
        case 3:
          await api.updateSite(siteId, {
            phone, email_contact: emailContact, address,
            social_links: { facebook, instagram, linkedin, ...(phone2 ? { phone2 } : {}) },
          });
          break;
        case 4:
          await api.updateSite(siteId, { coverage_zones: zones.filter((z) => z.trim()) });
          break;
        case 5:
          await api.replaceSiteOffers(siteId, offers
            .filter((o) => o.name.trim())
            .map((o) => ({
              name: o.name,
              description: o.description || undefined,
              duration_min: o.duration_min ? parseInt(o.duration_min) : undefined,
              price_eur: o.price_eur ? parseFloat(o.price_eur) : undefined,
              image_url: o.image_url || undefined,
            })));
          break;
        case 6:
          await api.updateSite(siteId, { values_list: values.filter((v) => v.title.trim()) });
          break;
        case 7:
          await api.replaceSiteTestimonials(siteId,
            testimonials.filter((t) => t.author_name.trim() && t.content.trim()));
          break;
      }
      flash("Sauvegardé ✓");
      return true;
    } catch (e: any) {
      flash(e.message ?? "Erreur", false);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const next = async () => { const ok = await saveStep(); if (ok && step < STEPS.length - 1) setStep(step + 1); };
  const prev = () => setStep(step - 1);

  const previewSite = async () => {
    if (!tenantSlug) return;
    await saveStep();
    window.open(`/${tenantSlug}?preview=1`, "_blank");
  };

  const publish = async () => {
    if (!siteId) return;
    await saveStep();
    await api.publishSite(siteId);
    flash("Site publié ! Redirection…");
    setTimeout(() => router.push("/dashboard"), 1800);
  };

  // ── Liste dynamique ─────────────────────────────────────────────────────────

  const listAdd = <T,>(set: (fn: (p: T[]) => T[]) => void, empty: () => T) =>
    set((p) => [...p, empty()]);
  const listRemove = <T,>(set: (fn: (p: T[]) => T[]) => void, i: number) =>
    set((p) => p.filter((_, idx) => idx !== i));
  const listUpdate = <T,>(set: (fn: (p: T[]) => T[]) => void, i: number, patch: Partial<T>) =>
    set((p) => p.map((item, idx) => (idx === i ? { ...item, ...patch } : item)));

  const togglePage = (key: string) => {
    const locked = PAGES.find((p) => p.key === key)?.locked;
    if (locked) return;
    setPagesEnabled((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const createDefaultSite = async () => {
    setCreating(true);
    try {
      const site = await api.createSite({ title: "Mon site", audience_mode: "b2c", default_language: "fr" }) as any;
      setSiteId(site.id);
      setNoSite(false);
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      const isSession = msg.toLowerCase().includes("tenant") || msg.includes("403");
      setLoadError(isSession ? "session" : msg || "Erreur de création");
    } finally {
      setCreating(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (noSite) return (
    <div className="max-w-2xl mx-auto p-6 text-center space-y-6 pt-20">
      {loadError === "session" ? (
        <>
          <p className="text-gray-800 font-medium">Session non à jour</p>
          <p className="text-sm text-gray-500">
            Votre session ne contient pas encore l'identifiant de votre espace.
            Déconnectez-vous et reconnectez-vous pour corriger ça.
          </p>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
          >
            Se reconnecter
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-500">Aucun site trouvé pour votre compte.</p>
          {loadError && <p className="text-red-500 text-sm">{loadError}</p>}
          <button
            onClick={createDefaultSite}
            disabled={creating}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? "Création…" : "Créer mon site"}
          </button>
        </>
      )}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          Retour au dashboard
        </Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 pb-16">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <h1 className="text-2xl font-bold">Configurer mon site</h1>
        </div>
        {tenantSlug && (
          <a
            href={`/${tenantSlug}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-indigo-600 hover:underline border border-indigo-200 px-3 py-1.5 rounded-lg"
          >
            Voir mon site ↗
          </a>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {STEPS.map((_s, i) => (
            <button key={i} onClick={() => setStep(i)}
              className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-indigo-600" : "bg-gray-200"}`} />
          ))}
        </div>
        <p className="text-sm text-gray-500">
          Étape {step + 1} / {STEPS.length} —{" "}
          <span className="font-medium text-gray-700">{STEPS[step].label}</span>
        </p>
      </div>

      {/* Flash message */}
      {msg && (
        <div className={`text-sm px-4 py-2.5 rounded-lg ${msg.ok ? "bg-green-50 text-green-700 border border-green-100" : "bg-red-50 text-red-600 border border-red-100"}`}>
          {msg.text}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 0 — VOTRE IMAGE
      ────────────────────────────────────────────────────────────────────── */}
      {step === 0 && (
        <div className="space-y-6">

          {/* Logo */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Votre logo</h2>
            {[
              { key: "has_logo",       label: "J'en ai un",           hint: "Renseignez l'URL de votre logo" },
              { key: "needs_creation", label: "Je n'en ai pas",       hint: "Découvrez notre service de création de logo" },
              { key: "text_only",      label: "Texte simple suffit",  hint: "Votre nom s'affiche en belle typographie" },
            ].map((opt) => (
              <label key={opt.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${logoOption === opt.key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="logo" value={opt.key} checked={logoOption === opt.key}
                  onChange={() => {
                    setLogoOption(opt.key as any);
                    if (opt.key === "needs_creation") setShowLogoServiceModal(true);
                  }} className="mt-1 accent-indigo-600" />
                <div>
                  <p className="font-medium text-sm text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                </div>
              </label>
            ))}

            {/* Champ URL logo */}
            {logoOption === "has_logo" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="lbl mb-0">URL de votre logo</label>
                  <button
                    type="button"
                    onClick={() => setShowLogoUrlHelp((v) => !v)}
                    className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 border transition-colors border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500"
                  >?</button>
                </div>
                {showLogoUrlHelp && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm space-y-2">
                    <p className="font-semibold text-indigo-800">Comment mettre mon logo en ligne ?</p>
                    <ol className="list-decimal list-inside space-y-1 text-indigo-700 text-xs">
                      <li>Uploadez votre logo sur <strong>Google Drive</strong>, <strong>Dropbox</strong> ou <strong>ImgBB</strong> (gratuit)</li>
                      <li>Obtenez le lien direct de partage (doit se terminer par .png, .jpg ou .svg)</li>
                      <li>Collez ce lien dans le champ ci-dessous</li>
                    </ol>
                    <p className="text-xs text-indigo-500">Astuce : ImgBB.com est le plus simple — glissez votre image et copiez le "Direct link".</p>
                  </div>
                )}
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="inp"
                  placeholder="https://i.ibb.co/mon-logo.png"
                />
                {logoUrl && (
                  <img src={logoUrl} alt="Aperçu logo" className="h-12 object-contain rounded border border-gray-200 p-1" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
            )}

            {/* Modal service création logo */}
            {showLogoServiceModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowLogoServiceModal(false)}>
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Création de logo</h3>
                    <button onClick={() => setShowLogoServiceModal(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                  </div>
                  <div className="text-center py-2">
                    <div className="text-5xl mb-3">🎨</div>
                    <p className="text-sm text-gray-600">Pas de logo ? Pas de problème. Notre équipe peut vous créer un logo professionnel adapté à votre activité.</p>
                  </div>
                  <div className="bg-indigo-50 rounded-xl p-4 space-y-1 text-sm text-indigo-700">
                    <p>✅ Logo vectoriel (PNG + SVG)</p>
                    <p>✅ 3 propositions de design</p>
                    <p>✅ Retouches illimitées</p>
                    <p>✅ Livré sous 5 jours ouvrés</p>
                  </div>
                  <p className="text-xs text-gray-400 text-center">Contactez-nous après avoir complété ce formulaire pour recevoir un devis.</p>
                  <button onClick={() => setShowLogoServiceModal(false)} className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">
                    Compris, je continue
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Couleurs */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Couleurs de votre site</h2>
            <p className="text-sm text-gray-500">Choisissez la palette qui correspond à votre image.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {COLOR_PALETTES.map((c) => (
                <button
                  key={c.key}
                  onClick={() => setPrimaryColor(c.key)}
                  className={`flex items-center gap-2.5 p-2.5 border rounded-xl text-left transition-all ${primaryColor === c.key ? "border-indigo-500 ring-2 ring-indigo-200 bg-indigo-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span className="w-7 h-7 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: c.hex }} />
                  <span className="text-xs font-medium text-gray-700 leading-tight">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Police */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Style d'écriture (police)</h2>
            {FONT_STYLES.map((f) => (
              <label key={f.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${fontStyle === f.key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="font" value={f.key} checked={fontStyle === f.key}
                  onChange={() => setFontStyle(f.key)} className="mt-1 accent-indigo-600" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">{f.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.hint}</p>
                  <p className="text-base text-gray-700 mt-1" style={{ fontFamily: f.preview }}>Aa — Bonjour, bienvenue</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 1 — VOTRE CONTENU
      ────────────────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-6">

          {/* Pages */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Pages de votre site</h2>
            <p className="text-sm text-gray-500">Cochez les pages utiles pour votre activité. Accueil et Contact sont obligatoires.</p>
            <div className="space-y-3">
              {PAGES.map((page) => (
                <label key={page.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${pagesEnabled.includes(page.key) ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"} ${page.locked ? "opacity-80" : ""}`}>
                  <input
                    type="checkbox"
                    checked={pagesEnabled.includes(page.key)}
                    onChange={() => togglePage(page.key)}
                    disabled={page.locked}
                    className="mt-0.5 w-4 h-4 accent-indigo-600"
                  />
                  <div>
                    <p className="font-medium text-sm text-gray-800">
                      {page.label}
                      {page.locked && <span className="ml-2 text-xs text-gray-400">(obligatoire)</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{page.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">Photos</h2>
            {[
              { key: "has_photos",  label: "J'ai mes propres photos professionnelles", hint: "Renseignez les URLs ci-dessous pour chaque section de votre site" },
              { key: "needs_stock", label: "Je n'ai pas de photos",                    hint: "Nous sélectionnerons de belles photos libres de droits adaptées à votre secteur" },
            ].map((opt) => (
              <label key={opt.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${photosOption === opt.key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="photos" value={opt.key} checked={photosOption === opt.key}
                  onChange={() => setPhotosOption(opt.key as any)} className="mt-1 accent-indigo-600" />
                <div>
                  <p className="font-medium text-sm text-gray-800">{opt.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{opt.hint}</p>
                </div>
              </label>
            ))}

            {/* Champs photos par section — visibles uniquement si has_photos */}
            {photosOption === "has_photos" && (
              <div className="border-t pt-4 space-y-5">
                <p className="text-sm font-medium text-gray-700">Renseignez l'URL de chaque photo <span className="font-normal text-gray-400">(hébergez-les sur Google Drive, Dropbox, ou votre serveur)</span></p>
                {PHOTO_SECTIONS.map((section) => (
                  <div key={section.key} className="relative">

                    {/* Label + bouton guide */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-700">{section.label}</span>
                      <button
                        type="button"
                        onClick={() => setOpenGuide(openGuide === section.key ? null : section.key)}
                        className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 transition-colors border ${
                          openGuide === section.key
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-white text-gray-400 border-gray-300 hover:border-indigo-400 hover:text-indigo-600"
                        }`}
                        title="Voir le guide de placement"
                      >
                        ?
                      </button>
                    </div>

                    {/* Popover guide — s'ouvre en dessous du label */}
                    {openGuide === section.key && (
                      <div className="absolute left-0 top-7 z-50 w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 space-y-3">
                        {/* Flèche */}
                        <div className="absolute -top-2 left-6 w-4 h-4 bg-white border-l border-t border-gray-200 rotate-45" />

                        {/* Mini wireframe */}
                        <div className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Emplacement sur votre site</p>
                          <SiteWireframe highlight={section.guide.highlight} />
                        </div>

                        {/* Détails */}
                        <p className="text-sm text-gray-700 leading-relaxed">{section.guide.desc}</p>

                        <div className="space-y-1.5 text-xs text-gray-500">
                          <p><span className="font-semibold text-gray-600">Format recommandé :</span> {section.guide.format}</p>
                          <p><span className="font-semibold text-gray-600">Idées de photos :</span> {section.guide.examples}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setOpenGuide(null)}
                          className="w-full text-xs text-center text-indigo-600 hover:underline pt-1"
                        >
                          Fermer
                        </button>
                      </div>
                    )}

                    <input
                      value={photoUrls[section.key] ?? ""}
                      onChange={(e) => setPhotoUrls((prev) => ({ ...prev, [section.key]: e.target.value }))}
                      className="inp"
                      placeholder="https://exemple.com/ma-photo.jpg"
                    />
                    <p className="text-xs text-gray-400 mt-1">{section.hint}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 2 — IDENTITÉ
      ────────────────────────────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Identité de votre activité</h2>
          <div>
            <label className="lbl">Nom de l'activité *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="inp" placeholder="Ex : EvaCare, Muntu Cura, Cabinet Dubois…" />
          </div>
          <div>
            <label className="lbl">Accroche principale <span className="text-gray-400 font-normal">(tagline)</span></label>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="inp" placeholder="Ex : Nous prenons soin de vous · L'artisan de confiance" />
          </div>
          <div>
            <label className="lbl">Description de votre activité</label>
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
              className="inp resize-none"
              placeholder="Présentez votre activité, votre expérience, votre approche, ce qui vous distingue…" />
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 3 — CONTACT & RÉSEAUX
      ────────────────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Coordonnées & réseaux sociaux</h2>
          <div>
            <label className="lbl">Téléphone principal</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className="inp" placeholder="+32 (0)466 42 23 77" />
          </div>
          <div>
            <label className="lbl">Téléphone secondaire <span className="text-gray-400 font-normal">(optionnel)</span></label>
            <input value={phone2} onChange={(e) => setPhone2(e.target.value)} className="inp" placeholder="+32 (0)2 123 45 67" />
          </div>
          <div>
            <label className="lbl">Email de contact</label>
            <input type="email" value={emailContact} onChange={(e) => setEmailContact(e.target.value)} className="inp" placeholder="contact@monactivite.be" />
          </div>
          <div>
            <label className="lbl">Adresse</label>
            <input value={address} onChange={(e) => setAddress(e.target.value)} className="inp" placeholder="Rue de l'Exemple 12, 1000 Bruxelles" />
          </div>
          <div className="pt-3 border-t space-y-3">
            <p className="text-sm font-medium text-gray-700">Réseaux sociaux <span className="text-gray-400 font-normal">(optionnel)</span></p>
            {[
              { label: "Facebook",  value: facebook,  set: setFacebook,  ph: "https://facebook.com/…" },
              { label: "Instagram", value: instagram, set: setInstagram, ph: "https://instagram.com/…" },
              { label: "LinkedIn",  value: linkedin,  set: setLinkedin,  ph: "https://linkedin.com/in/…" },
            ].map((r) => (
              <div key={r.label} className="flex gap-2 items-center">
                <span className="w-24 text-sm text-gray-500">{r.label}</span>
                <input value={r.value} onChange={(e) => r.set(e.target.value)} className="inp flex-1" placeholder={r.ph} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 4 — ZONES
      ────────────────────────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Zones d'intervention</h2>
          <p className="text-sm text-gray-500">Listez les villes, communes ou régions que vous couvrez.</p>
          {zones.map((z, i) => (
            <div key={i} className="relative flex gap-2">
              <div className="relative flex-1">
                <input
                  value={z}
                  onChange={(e) => {
                    const v = e.target.value;
                    setZones((prev) => prev.map((z2, idx) => idx === i ? v : z2));
                    if (zoneTimerRef.current) clearTimeout(zoneTimerRef.current);
                    if (v.length < 2) { setZoneSuggestions(null); return; }
                    zoneTimerRef.current = setTimeout(async () => {
                      try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(v)}&format=json&limit=6&addressdetails=1`);
                        const data = await res.json();
                        const items: string[] = [];
                        for (const d of data) {
                          const a = d.address ?? {};
                          const name = a.city || a.town || a.village || a.county || a.state || d.display_name.split(",")[0];
                          if (name && !items.includes(name)) items.push(name);
                        }
                        setZoneSuggestions({ idx: i, items });
                      } catch {}
                    }, 350);
                  }}
                  onBlur={() => setTimeout(() => setZoneSuggestions(null), 150)}
                  className="inp w-full"
                  placeholder="Ex : Bruxelles, Hal, Brabant wallon…"
                />
                {zoneSuggestions?.idx === i && zoneSuggestions.items.length > 0 && (
                  <ul className="absolute z-40 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden text-sm">
                    {zoneSuggestions.items.map((s) => (
                      <li key={s}>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                          onMouseDown={() => {
                            setZones((prev) => prev.map((z2, idx) => idx === i ? s : z2));
                            setZoneSuggestions(null);
                          }}
                        >{s}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {zones.length > 1 && (
                <button onClick={() => listRemove(setZones, i)} className="text-red-400 hover:text-red-600 px-2">✕</button>
              )}
            </div>
          ))}
          <button onClick={() => listAdd(setZones, () => "")} className="text-sm text-indigo-600 hover:underline">
            + Ajouter une zone
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 5 — PRESTATIONS
      ────────────────────────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
            La durée et le prix sont <strong>facultatifs</strong>. Ne remplissez que ce que vous souhaitez afficher.
          </div>
          {offers.map((o, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Prestation {i + 1}</span>
                {offers.length > 1 && (
                  <button onClick={() => listRemove(setOffers, i)} className="text-red-400 hover:text-red-600 text-sm">Supprimer</button>
                )}
              </div>
              <input value={o.name} onChange={(e) => listUpdate(setOffers, i, { name: e.target.value })}
                className="inp" placeholder="Nom de la prestation *" />
              <textarea rows={2} value={o.description}
                onChange={(e) => listUpdate(setOffers, i, { description: e.target.value })}
                className="inp resize-none" placeholder="Description (optionnel)" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">Durée (min) — facultatif</label>
                  <input type="number" value={o.duration_min}
                    onChange={(e) => listUpdate(setOffers, i, { duration_min: e.target.value })}
                    className="inp" placeholder="60" />
                </div>
                <div>
                  <label className="lbl">Prix (€) — facultatif</label>
                  <input type="number" value={o.price_eur}
                    onChange={(e) => listUpdate(setOffers, i, { price_eur: e.target.value })}
                    className="inp" placeholder="50" />
                </div>
              </div>
              <div>
                <label className="lbl">Image de la prestation <span className="text-gray-400 font-normal">(URL — optionnel)</span></label>
                <input value={o.image_url} onChange={(e) => listUpdate(setOffers, i, { image_url: e.target.value })}
                  className="inp" placeholder="https://i.ibb.co/ma-photo.jpg" />
                {o.image_url && (
                  <img src={o.image_url} alt="aperçu" className="mt-2 h-20 w-full object-cover rounded-lg border border-gray-200"
                    onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
            </div>
          ))}
          <button onClick={() => listAdd(setOffers, EMPTY_OFFER)} className="text-sm text-indigo-600 hover:underline">
            + Ajouter une prestation
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 6 — ATOUTS
      ────────────────────────────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-500">Ces atouts rassureront vos visiteurs et se retrouveront sur votre site. Maximum 6.</p>
            <button
              onClick={() => setShowAtoutsHelp(true)}
              className="shrink-0 w-6 h-6 rounded-full border border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors text-xs font-bold leading-none flex items-center justify-center"
              title="Qu'est-ce qu'un atout ?"
            >
              ?
            </button>
          </div>

          {showAtoutsHelp && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowAtoutsHelp(false)}>
              <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 text-base">C'est quoi un "Atout" ?</h3>
                  <button onClick={() => setShowAtoutsHelp(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <p className="text-sm text-gray-600">
                  Un atout est une raison concrète pour laquelle un client devrait vous choisir plutôt qu'un autre. C'est ce qui vous différencie : votre expérience, votre méthode, votre disponibilité…
                </p>
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Exemples</p>
                  <div className="space-y-2">
                    {[
                      { icon: "🏅", title: "10 ans d'expérience", desc: "Une expertise acquise auprès de centaines de patients en cabinet libéral." },
                      { icon: "📅", title: "Disponible 7j/7", desc: "Je m'adapte à votre emploi du temps, y compris le week-end." },
                      { icon: "🏠", title: "Déplacements à domicile", desc: "Je me déplace chez vous dans un rayon de 20 km sans frais supplémentaires." },
                    ].map((ex) => (
                      <div key={ex.title} className="flex gap-3 items-start">
                        <span className="text-xl">{ex.icon}</span>
                        <div>
                          <p className="text-sm font-medium text-gray-800">{ex.title}</p>
                          <p className="text-xs text-gray-500">{ex.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <button onClick={() => setShowAtoutsHelp(false)} className="w-full bg-indigo-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-indigo-700 transition-colors">
                  J'ai compris
                </button>
              </div>
            </div>
          )}
          {values.map((v, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Atout {i + 1}</span>
                {values.length > 1 && (
                  <button onClick={() => listRemove(setValues, i)} className="text-red-400 hover:text-red-600 text-sm">Supprimer</button>
                )}
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setEmojiPickerIdx(emojiPickerIdx === i ? null : i)}
                    className="inp w-14 text-center text-xl cursor-pointer hover:border-indigo-400 transition-colors"
                  >{v.icon || "⭐"}</button>
                  {emojiPickerIdx === i && (
                    <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 w-64">
                      <p className="text-xs text-gray-400 mb-2 font-medium">Choisissez une icône</p>
                      <div className="grid grid-cols-8 gap-1">
                        {["⭐","🏅","🎯","💪","🌟","✅","🔑","💡","🚀","🤝","📋","🎓","🏆","💎","🔒","🌍","📱","💻","🕐","🏠","🚗","✈️","❤️","🌿","🛡️","📞","🗓️","🔧","📊","🎨","🏥","🌸","👑","💰","🔍","📍","🤗","😊","🎁","⚡","🌺","🦷","💊","🩺","🧘","🍃","🧡","🫶","🎪"].map((em) => (
                          <button
                            key={em}
                            type="button"
                            onClick={() => { listUpdate(setValues, i, { icon: em }); setEmojiPickerIdx(null); }}
                            className={`text-xl p-1 rounded-lg hover:bg-indigo-50 transition-colors ${v.icon === em ? "bg-indigo-100" : ""}`}
                          >{em}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <input value={v.title} onChange={(e) => listUpdate(setValues, i, { title: e.target.value })}
                  className="inp flex-1" placeholder="Titre de l'atout *" />
              </div>
              <textarea rows={2} value={v.description}
                onChange={(e) => listUpdate(setValues, i, { description: e.target.value })}
                className="inp resize-none" placeholder="Décrivez cet atout en 1-2 phrases…" />
            </div>
          ))}
          {values.length < 6 && (
            <button onClick={() => listAdd(setValues, EMPTY_VALUE)} className="text-sm text-indigo-600 hover:underline">
              + Ajouter un atout
            </button>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 7 — TÉMOIGNAGES
      ────────────────────────────────────────────────────────────────────── */}
      {step === 7 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Ajoutez des avis de clients ou partenaires. Laissez vide si vous n'en avez pas encore.</p>
          {testimonials.map((t, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">Témoignage {i + 1}</span>
                <button onClick={() => listRemove(setTestimonials, i)} className="text-red-400 hover:text-red-600 text-sm">Supprimer</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input value={t.author_name} onChange={(e) => listUpdate(setTestimonials, i, { author_name: e.target.value })}
                  className="inp" placeholder="Nom *" />
                <input value={t.author_role} onChange={(e) => listUpdate(setTestimonials, i, { author_role: e.target.value })}
                  className="inp" placeholder="Rôle (ex : WZC Brugge)" />
              </div>
              <textarea rows={3} value={t.content} onChange={(e) => listUpdate(setTestimonials, i, { content: e.target.value })}
                className="inp resize-none" placeholder="Ce que dit votre client…" />
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500 mr-1">Note :</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => listUpdate(setTestimonials, i, { rating: star })}
                    className={`text-xl transition-colors ${star <= t.rating ? "text-yellow-400" : "text-gray-200"}`}>★</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => listAdd(setTestimonials, EMPTY_TESTIMONIAL)} className="text-sm text-indigo-600 hover:underline">
            + Ajouter un témoignage
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 8 — SUIVI & LANCEMENT
      ────────────────────────────────────────────────────────────────────── */}
      {step === 8 && (
        <div className="space-y-6">

          {/* Tracking */}
          <div className="bg-white rounded-xl shadow p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-gray-800">Suivi & Analytics</h2>
              <p className="text-sm text-gray-500 mt-1">Collez vos identifiants pour mesurer les visites de votre site. Laissez vide si vous n'avez pas encore de compte Analytics.</p>
            </div>

            <div>
              <label className="lbl flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded bg-orange-500" />
                Google Analytics 4 (GA4)
              </label>
              <input value={ga4Id} onChange={(e) => setGa4Id(e.target.value)} className="inp"
                placeholder="G-XXXXXXXXXX" />
              <p className="text-xs text-gray-400 mt-1">Trouvez votre ID dans Google Analytics → Admin → Flux de données</p>
            </div>

            <div>
              <label className="lbl flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded bg-blue-600" />
                Meta Pixel (Facebook / Instagram Ads)
              </label>
              <input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} className="inp"
                placeholder="123456789012345" />
              <p className="text-xs text-gray-400 mt-1">Trouvez votre Pixel ID dans Meta Business Suite → Gestionnaire d'événements</p>
            </div>

            <div>
              <label className="lbl flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded bg-blue-400" />
                Google Tag Manager (GTM)
              </label>
              <input value={gtmId} onChange={(e) => setGtmId(e.target.value)} className="inp"
                placeholder="GTM-XXXXXXX" />
              <p className="text-xs text-gray-400 mt-1">Format : GTM-XXXXXXX — trouvez-le dans votre conteneur GTM</p>
            </div>
          </div>

          {/* CSS personnalisé — premium */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">CSS personnalisé</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">Premium</span>
            </div>
            <p className="text-sm text-gray-500">Ajoutez du CSS pour personnaliser l'apparence de votre site de façon avancée.</p>
            <textarea
              rows={8}
              value={customCss}
              onChange={(e) => setCustomCss(e.target.value)}
              className="inp resize-y font-mono text-xs"
              placeholder={`/* Exemples */\n.hero-section { min-height: 600px; }\nh1 { letter-spacing: -0.02em; }\n.card { border-radius: 1.5rem; }`}
            />
          </div>

          {/* Publication */}
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-indigo-900">Tout est prêt ?</h2>
            <p className="text-sm text-indigo-700">Votre site sera visible publiquement. Vous pourrez toujours revenir modifier ces réglages.</p>
            {tenantSlug && (
              <button onClick={previewSite} disabled={saving}
                className="w-full border border-indigo-400 text-indigo-700 bg-white font-semibold py-3 rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors">
                {saving ? "Sauvegarde…" : "👁 Prévisualiser mon site"}
              </button>
            )}
            <button onClick={publish} disabled={saving}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? "Sauvegarde…" : "Sauvegarder & Publier mon site"}
            </button>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={prev} className="flex-1 border rounded-xl py-2.5 text-gray-600 hover:bg-gray-50 font-medium">
            ← Retour
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={next} disabled={saving}
            className="flex-1 bg-indigo-600 text-white font-semibold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? "Sauvegarde…" : "Sauvegarder & Continuer →"}
          </button>
        )}
      </div>

      <style jsx global>{`
        .lbl { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
        .inp { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; transition: border-color 0.15s; }
        .inp:focus { border-color: #6366f1; box-shadow: 0 0 0 2px #e0e7ff; }
      `}</style>
    </div>
  );
}
