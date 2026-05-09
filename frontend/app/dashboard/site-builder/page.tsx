"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, supabase } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";
import type { T as TranslationT } from "../../../lib/i18n";

// ── Constantes statiques (sans texte) ────────────────────────────────────────

const COLOR_PALETTE_DEFS: { key: string; tKey: keyof TranslationT; hex: string }[] = [
  { key: "indigo",    tKey: "sb_col_indigo",         hex: "#4338ca" },
  { key: "blue",      tKey: "sb_col_bleu",           hex: "#1e3a8a" },
  { key: "purple",    tKey: "sb_col_violet",         hex: "#7e22ce" },
  { key: "highlight", tKey: "sb_col_violet_clair",   hex: "#a855f7" },
  { key: "teal",      tKey: "sb_col_sarcelle",       hex: "#0f766e" },
  { key: "cyan",      tKey: "sb_col_cyan",           hex: "#155e75" },
  { key: "green",     tKey: "sb_col_vert",           hex: "#15803d" },
  { key: "emerald",   tKey: "sb_col_emeraude",       hex: "#166534" },
  { key: "amber",     tKey: "sb_col_ambre",          hex: "#b45309" },
  { key: "orange",    tKey: "sb_col_orange",         hex: "#c2410c" },
  { key: "red",       tKey: "sb_col_rouge",          hex: "#b91c1c" },
  { key: "rose",      tKey: "sb_col_rose",           hex: "#be123c" },
  { key: "slate",     tKey: "sb_col_gris_ardoise",   hex: "#475569" },
  { key: "neutral",   tKey: "sb_col_gris_neutre",    hex: "#334155" },
];

const FONT_STYLE_DEFS = [
  { key: "modern",      lKey: "sb_font_modern_lbl" as const,  hKey: "sb_font_modern_hint" as const,  preview: "system-ui, sans-serif" },
  { key: "classic",     lKey: "sb_font_classic_lbl" as const, hKey: "sb_font_classic_hint" as const, preview: "Georgia, serif" },
  { key: "handwritten", lKey: "sb_font_hand_lbl" as const,    hKey: "sb_font_hand_hint" as const,    preview: "cursive" },
  { key: "rounded",     lKey: "sb_font_round_lbl" as const,   hKey: "sb_font_round_hint" as const,   preview: "ui-rounded, sans-serif" },
  { key: "bold",        lKey: "sb_font_bold_lbl" as const,    hKey: "sb_font_bold_hint" as const,    preview: "Impact, sans-serif" },
  { key: "humanist",    lKey: "sb_font_human_lbl" as const,   hKey: "sb_font_human_hint" as const,   preview: "Gill Sans, sans-serif" },
  { key: "tech",        lKey: "sb_font_tech_lbl" as const,    hKey: "sb_font_tech_hint" as const,    preview: "Consolas, monospace" },
];

const PAGE_DEFS = [
  { key: "home",     lKey: "sb_page_home" as const,     dKey: "sb_page_home_desc" as const,     locked: true },
  { key: "about",    lKey: "sb_page_about" as const,    dKey: "sb_page_about_desc" as const },
  { key: "services", lKey: "sb_page_services" as const, dKey: "sb_page_services_desc" as const },
  { key: "contact",  lKey: "sb_page_contact" as const,  dKey: "sb_page_contact_desc" as const,  locked: true },
];

const PHOTO_SECTION_DEFS = [
  { key: "hero",     lKey: "sb_photo_hero_lbl" as const,     hKey: "sb_photo_hero_hint" as const,
    guide: { dKey: "sb_guide_hero_desc" as const, fKey: "sb_guide_hero_format" as const, eKey: "sb_guide_hero_ex" as const, highlight: "hero" as const } },
  { key: "about",    lKey: "sb_photo_about_lbl" as const,    hKey: "sb_photo_about_hint" as const,
    guide: { dKey: "sb_guide_about_desc" as const, fKey: "sb_guide_about_format" as const, eKey: "sb_guide_about_ex" as const, highlight: "about" as const } },
  { key: "services", lKey: "sb_photo_services_lbl" as const, hKey: "sb_photo_services_hint" as const,
    guide: { dKey: "sb_guide_services_desc" as const, fKey: "sb_guide_services_format" as const, eKey: "sb_guide_services_ex" as const, highlight: "services" as const } },
  { key: "contact",  lKey: "sb_photo_contact_lbl" as const,  hKey: "sb_photo_contact_hint" as const,
    guide: { dKey: "sb_guide_contact_desc" as const, fKey: "sb_guide_contact_format" as const, eKey: "sb_guide_contact_ex" as const, highlight: "contact" as const } },
];

type PhotoHighlight = "hero" | "about" | "services" | "contact";

// ── Icônes Atouts ─────────────────────────────────────────────────────────────

const ATOUT_ICONS: { key: string; label: string; paths: string[] }[] = [
  { key: "star",      label: "Étoile",         paths: ["M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"] },
  { key: "shield",    label: "Protection",      paths: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"] },
  { key: "award",     label: "Excellence",      paths: ["M12 15a7 7 0 100-14 7 7 0 000 14z", "M8.21 13.89L7 23l5-3 5 3-1.21-9.12"] },
  { key: "heart",     label: "Bienveillance",   paths: ["M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"] },
  { key: "clock",     label: "Disponibilité",   paths: ["M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z", "M12 6v6l4 2"] },
  { key: "home",      label: "Domicile",        paths: ["M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z", "M9 22V12h6v10"] },
  { key: "users",     label: "Équipe",          paths: ["M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2", "M9 7a4 4 0 100 8 4 4 0 000-8", "M23 21v-2a4 4 0 00-3-3.87", "M16 3.13a4 4 0 010 7.75"] },
  { key: "map-pin",   label: "Localisation",    paths: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z", "M12 10a2 2 0 100-4 2 2 0 000 4"] },
  { key: "check",     label: "Fiabilité",       paths: ["M22 11.08V12a10 10 0 11-5.93-9.14", "M22 4L12 14.01l-3-3"] },
  { key: "briefcase", label: "Expertise",       paths: ["M20 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z", "M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"] },
  { key: "leaf",      label: "Nature",          paths: ["M17 8C8 10 5.9 16.17 3.82 19c2.14-4.14 5.11-7 8.18-8", "M17 8c0 0-2 5-7 8"] },
  { key: "lightbulb", label: "Innovation",      paths: ["M9 21h6", "M12 3a6 6 0 016 6c0 2.22-1.21 4.16-3 5.2V17H9v-2.8C7.21 13.16 6 11.22 6 9a6 6 0 016-6z"] },
  { key: "phone",     label: "Joignable",       paths: ["M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"] },
  { key: "calendar",  label: "Agenda",          paths: ["M19 4H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2z", "M16 2v4", "M8 2v4", "M3 10h18"] },
  { key: "thumbs-up", label: "Satisfaction",    paths: ["M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z", "M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"] },
  { key: "globe",     label: "International",   paths: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M2 12h20", "M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"] },
  { key: "lock",      label: "Confidentialité", paths: ["M19 11H5a2 2 0 00-2 2v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z", "M17 11V7a5 5 0 00-10 0v4"] },
  { key: "zap",       label: "Rapidité",        paths: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"] },
  { key: "trending",  label: "Performance",     paths: ["M23 6l-9.5 9.5-5-5L1 18", "M17 6h6v6"] },
  { key: "smile",     label: "Convivialité",    paths: ["M12 22a10 10 0 100-20 10 10 0 000 20z", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"] },
];

function AtoutIconSVG({ icon, className = "w-5 h-5" }: { icon: string; className?: string }) {
  const found = ATOUT_ICONS.find((ic) => ic.key === icon);
  if (found) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
           className={className}>
        {found.paths.map((d, idx) => <path key={idx} d={d} />)}
      </svg>
    );
  }
  return <span className="text-xl leading-none">{icon}</span>;
}

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

const STEP_KEYS = [
  "sb_step0", "sb_step1", "sb_step2", "sb_step3", "sb_step4",
  "sb_step5", "sb_step6", "sb_step7", "sb_step8",
] as const;

// ── Types ─────────────────────────────────────────────────────────────────────

type Offer = { name: string; description: string; duration_min: string; price_eur: string; image_url: string };
type Value = { icon: string; title: string; description: string };
type Testimonial = { author_name: string; author_role: string; content: string; rating: number };

const EMPTY_OFFER = (): Offer => ({ name: "", description: "", duration_min: "", price_eur: "", image_url: "" });
const EMPTY_VALUE = (): Value => ({ icon: "star", title: "", description: "" });
const EMPTY_TESTIMONIAL = (): Testimonial => ({ author_name: "", author_role: "", content: "", rating: 5 });

function isUnsupportedPhotoUrl(url: string): string | null {
  if (!url) return null;
  if (/photos\.app\.goo\.gl|photos\.google\.com/i.test(url))
    return "Les liens Google Photos ne peuvent pas être intégrés directement. Ouvrez la photo → ⋮ → « Partager » → copiez le lien de l'image (clic droit → « Ouvrir l'image »), ou utilisez Imgur / ibb.co.";
  if (/drive\.google\.com\/file/i.test(url))
    return "Les liens Google Drive ne s'affichent pas directement. Utilisez un hébergeur comme Imgur ou ibb.co.";
  if (/instagram\.com|facebook\.com/i.test(url))
    return "Les liens Instagram et Facebook ne peuvent pas être intégrés. Téléchargez l'image et hébergez-la sur Imgur ou ibb.co.";
  return null;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SiteBuilderPage() {
  const router = useRouter();
  const { t } = useLanguage();

  const STEPS = STEP_KEYS.map((k) => ({ label: t[k] }));
  const COLOR_PALETTES = COLOR_PALETTE_DEFS.map((c) => ({ ...c, label: t[c.tKey] as string }));
  const FONT_STYLES = FONT_STYLE_DEFS.map((f) => ({ ...f, label: t[f.lKey], hint: t[f.hKey] }));
  const PAGES = PAGE_DEFS.map((p) => ({ ...p, label: t[p.lKey], desc: t[p.dKey] }));
  const PHOTO_SECTIONS = PHOTO_SECTION_DEFS.map((s) => ({
    ...s,
    label: t[s.lKey],
    hint: t[s.hKey],
    guide: { ...s.guide, desc: t[s.guide.dKey], format: t[s.guide.fKey], examples: t[s.guide.eKey] },
  }));

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
  const [addressStreet, setAddressStreet] = useState("");
  const [addressPostal, setAddressPostal] = useState("");
  const [addressCity, setAddressCity] = useState("");
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
  const [iconPickerIdx, setIconPickerIdx] = useState<number | null>(null);

  // Step validation errors
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});

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

  // Upload photos
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadCbRef = useRef<((file: File) => void) | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const triggerUpload = (cb: (file: File) => void) => {
    uploadCbRef.current = cb;
    fileInputRef.current?.click();
  };

  const uploadPhoto = async (file: File, section: string, onSuccess: (url: string) => void) => {
    setUploading(section);
    try {
      const { url } = await api.uploadSitePhoto(file, section);
      onSuccess(url);
    } catch (e: any) {
      alert(`${t.sb_uploading} ${e.message}`);
    } finally {
      setUploading(null);
    }
  };

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
      try {
        const tenant = await api.getMyTenant();
        if (tenant?.slug) setTenantSlug(tenant.slug);
      } catch { /* slug reste vide */ }

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
      const ap = style.address_parts ?? {};
      setAddressStreet(ap.street ?? ((!ap.city && s.address) ? s.address : ""));
      setAddressPostal(ap.postal_code ?? "");
      setAddressCity(ap.city ?? "");
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
    if (!siteId) { flash(t.sb_no_site, false); return false; }
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
        case 3: {
          const addrParts = { street: addressStreet, postal_code: addressPostal, city: addressCity };
          const fullAddress = [addressStreet, addressPostal, addressCity].filter(Boolean).join(", ");
          await api.updateSite(siteId, {
            phone, email_contact: emailContact, address: fullAddress,
            social_links: { facebook, instagram, linkedin, ...(phone2 ? { phone2 } : {}) },
            site_style: { ...buildSiteStyle(), address_parts: addrParts },
          });
          break;
        }
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
      flash("✓");
      return true;
    } catch (e: any) {
      flash(e.message ?? "Erreur", false);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const validateStep = (): boolean => {
    const errors: Record<string, string> = {};

    if (step === 2) {
      if (!title.trim()) errors.title = t.sb_err_title_req;
    }

    if (step === 3) {
      if (!phone.trim() && !emailContact.trim()) {
        errors.contactRequired = t.sb_err_contact_req;
      }
      if (emailContact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailContact)) {
        errors.emailContact = t.sb_err_email_inv;
      }
    }

    if (step === 4) {
      if (!zones.some((z) => z.trim())) {
        errors.zones = t.sb_err_zones_req;
      }
    }

    if (step === 5) {
      if (pagesEnabled.includes("services") && !offers.some((o) => o.name.trim())) {
        errors.offers = t.sb_err_offers_req;
      }
      offers.forEach((o, i) => {
        if ((o.description || o.duration_min || o.price_eur || o.image_url) && !o.name.trim()) {
          errors[`offer_${i}_name`] = t.sb_err_offer_name;
        }
      });
    }

    if (step === 6) {
      values.forEach((v, i) => {
        if (v.description && !v.title.trim()) {
          errors[`value_${i}_title`] = t.sb_err_value_title;
        }
      });
    }

    if (step === 7) {
      testimonials.forEach((testimonial, i) => {
        if ((testimonial.content || testimonial.author_role) && !testimonial.author_name.trim()) {
          errors[`testimonial_${i}_name`] = t.sb_err_testi_name;
        }
        if ((testimonial.author_name || testimonial.author_role) && !testimonial.content.trim()) {
          errors[`testimonial_${i}_content`] = t.sb_err_testi_content;
        }
      });
    }

    setStepErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const next = async () => {
    if (!validateStep()) return;
    const ok = await saveStep();
    if (ok && step < STEPS.length - 1) setStep(step + 1);
  };
  const prev = () => { setStepErrors({}); setStep(step - 1); };

  const previewSite = async () => {
    if (!tenantSlug) return;
    await saveStep();
    window.open(`/${tenantSlug}?preview=1`, "_blank");
  };

  const publish = async () => {
    if (!siteId) return;
    setSaving(true);
    try {
      await saveStep();
      await api.publishSite(siteId);
      flash("✓ Site publié !");
      setTimeout(() => router.push("/dashboard/appointments"), 1800);
    } catch (e: any) {
      flash(e.message ?? "Erreur lors de la publication", false);
    } finally {
      setSaving(false);
    }
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
          <p className="text-gray-800 font-medium">{t.sb_session_err}</p>
          <p className="text-sm text-gray-500">{t.sb_session_desc}</p>
          <button
            onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
          >
            {t.sb_reconnect}
          </button>
        </>
      ) : (
        <>
          <p className="text-gray-500">{t.sb_no_site}</p>
          {loadError && <p className="text-red-500 text-sm">{loadError}</p>}
          <button
            onClick={createDefaultSite}
            disabled={creating}
            className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
          >
            {creating ? t.sb_creating_site : t.sb_create_site}
          </button>
        </>
      )}
      <div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 hover:text-gray-900 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/></svg>
          {t.sb_back_db}
        </Link>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 pb-16">

      {/* Input file caché — partagé pour tous les uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadCbRef.current) uploadCbRef.current(file);
          e.target.value = "";
        }}
      />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-lg">←</Link>
          <h1 className="text-2xl font-bold">{t.sb_title}</h1>
        </div>
        {tenantSlug && (
          <div className="flex items-center gap-2">
            <button
              onClick={previewSite}
              disabled={saving}
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
              </svg>
              {t.sb_preview}
            </button>
            <a
              href={`/${tenantSlug}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-indigo-600 hover:underline border border-indigo-200 px-3 py-1.5 rounded-lg"
            >
              {t.sb_view_site}
            </a>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex gap-1">
          {STEPS.map((_s, i) => (
            <button key={i}
              onClick={() => { if (i < step) { setStepErrors({}); setStep(i); } }}
              className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-indigo-600" : "bg-gray-200"} ${i < step ? "cursor-pointer" : "cursor-default"}`} />
          ))}
        </div>
        <p className="text-sm text-gray-500">
          {t.ob_step} {step + 1} {t.ob_of} {STEPS.length} —{" "}
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
            <h2 className="font-semibold text-gray-800">{t.sb_logo_title}</h2>
            {[
              { key: "has_logo",       label: t.sb_logo_has,   hint: t.sb_logo_has_hint },
              { key: "needs_creation", label: t.sb_logo_none,  hint: t.sb_logo_none_hint },
              { key: "text_only",      label: t.sb_logo_text,  hint: t.sb_logo_text_hint },
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
                  <label className="lbl mb-0">{t.sb_logo_url_label}</label>
                  <button
                    type="button"
                    onClick={() => setShowLogoUrlHelp((v) => !v)}
                    className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 border transition-colors border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500"
                  >?</button>
                </div>
                {showLogoUrlHelp && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-sm space-y-2">
                    <p className="font-semibold text-indigo-800">{t.sb_logo_how_title}</p>
                    <ol className="list-decimal list-inside space-y-1 text-indigo-700 text-xs">
                      <li>Uploadez votre logo sur <strong>Google Drive</strong>, <strong>Dropbox</strong> ou <strong>ImgBB</strong> (gratuit)</li>
                      <li>Obtenez le lien direct de partage (doit se terminer par .png, .jpg ou .svg)</li>
                      <li>Collez ce lien dans le champ ci-dessous</li>
                    </ol>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => triggerUpload((file) => uploadPhoto(file, "logo", setLogoUrl))}
                  disabled={uploading === "logo"}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                >
                  {uploading === "logo" ? (
                    <><div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />Envoi…</>
                  ) : (
                    <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>{t.sb_logo_upload_btn}</>
                  )}
                </button>
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{t.sb_or_url}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
                <input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="inp"
                  placeholder="https://i.ibb.co/mon-logo.png"
                />
                {logoUrl && (isUnsupportedPhotoUrl(logoUrl)
                  ? <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{isUnsupportedPhotoUrl(logoUrl)}</p>
                  : <img src={logoUrl} alt="Aperçu logo" className="h-12 object-contain rounded border border-gray-200 p-1" onError={(e) => (e.currentTarget.style.display = "none")} />
                )}
              </div>
            )}

            {/* Modal service création logo */}
            {showLogoServiceModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setShowLogoServiceModal(false)}>
                <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">{t.sb_logo_modal_title}</h3>
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
                    {t.sb_logo_modal_ok}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Couleurs */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">{t.sb_colors_title}</h2>
            <p className="text-sm text-gray-500">{t.sb_colors_desc}</p>
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
            <h2 className="font-semibold text-gray-800">{t.sb_font_title}</h2>
            {FONT_STYLES.map((f) => (
              <label key={f.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${fontStyle === f.key ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="font" value={f.key} checked={fontStyle === f.key}
                  onChange={() => setFontStyle(f.key)} className="mt-1 accent-indigo-600" />
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">{f.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{f.hint}</p>
                  <p className="text-base text-gray-700 mt-1" style={{ fontFamily: f.preview }}>Aa — Hello</p>
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
            <h2 className="font-semibold text-gray-800">{t.sb_pages_title}</h2>
            <p className="text-sm text-gray-500">{t.sb_pages_desc}</p>
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
                      {page.locked && <span className="ml-2 text-xs text-gray-400">{t.sb_obligatoire}</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{page.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Photos */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">{t.sb_photos_title}</h2>
            {[
              { key: "has_photos",  label: t.sb_photos_has,   hint: t.sb_photos_has_hint },
              { key: "needs_stock", label: t.sb_photos_stock, hint: t.sb_photos_stock_hint },
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
                <p className="text-sm font-medium text-gray-700">{t.sb_photos_add_desc}</p>
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
                          <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">{t.sb_guide_loc}</p>
                          <SiteWireframe highlight={section.guide.highlight} />
                        </div>

                        {/* Détails */}
                        <p className="text-sm text-gray-700 leading-relaxed">{section.guide.desc}</p>

                        <div className="space-y-1.5 text-xs text-gray-500">
                          <p><span className="font-semibold text-gray-600">{t.sb_guide_format_lbl}</span> {section.guide.format}</p>
                          <p><span className="font-semibold text-gray-600">{t.sb_guide_ideas_lbl}</span> {section.guide.examples}</p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setOpenGuide(null)}
                          className="w-full text-xs text-center text-indigo-600 hover:underline pt-1"
                        >
                          {t.sb_guide_close}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => triggerUpload((file) => uploadPhoto(file, section.key, (url) => setPhotoUrls((p) => ({ ...p, [section.key]: url }))))}
                      disabled={!!uploading}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-200 text-sm font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                    >
                      {uploading === section.key ? (
                        <><div className="w-3.5 h-3.5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />{t.sb_photo_uploading}</>
                      ) : (
                        <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>{t.sb_photo_choose}</>
                      )}
                    </button>
                    <div className="flex items-center gap-2 my-2">
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">{t.sb_or_url}</span>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                    <input
                      value={photoUrls[section.key] ?? ""}
                      onChange={(e) => setPhotoUrls((prev) => ({ ...prev, [section.key]: e.target.value }))}
                      className="inp"
                      placeholder="https://exemple.com/ma-photo.jpg"
                    />
                    <p className="text-xs text-gray-400 mt-1">{section.hint}</p>
                    {(() => {
                      const url = photoUrls[section.key];
                      const warn = isUnsupportedPhotoUrl(url ?? "");
                      return (
                        <>
                          {warn && (
                            <div className="mt-2 flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                              <svg className="w-3.5 h-3.5 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                              </svg>
                              <span>{warn}</span>
                            </div>
                          )}
                          {url && !warn && (
                            <img
                              src={url}
                              alt="Aperçu"
                              className="mt-2 h-28 w-full object-cover rounded-lg border border-gray-200"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const next = e.currentTarget.nextElementSibling as HTMLElement | null;
                                if (next) next.style.display = "flex";
                              }}
                            />
                          )}
                          {url && !warn && (
                            <div
                              className="mt-2 hidden items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700"
                            >
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {t.sb_img_broken}
                            </div>
                          )}
                        </>
                      );
                    })()}
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
          <h2 className="font-semibold text-gray-800">{t.sb_identity_title}</h2>
          <div>
            <label className="lbl">{t.sb_identity_name_lbl}</label>
            <input value={title} onChange={(e) => { setTitle(e.target.value); if (stepErrors.title) setStepErrors((p) => ({ ...p, title: "" })); }}
              className={`inp ${stepErrors.title ? "border-red-400 focus:border-red-400" : ""}`}
              placeholder="Ex : EvaCare, Muntu Cura, Cabinet Dubois…" />
            {stepErrors.title && <p className="text-red-500 text-xs mt-1">{stepErrors.title}</p>}
          </div>
          <div>
            <label className="lbl">{t.sb_identity_tagline_lbl} <span className="text-gray-400 font-normal">{t.sb_identity_tagline_tag}</span></label>
            <input value={tagline} onChange={(e) => setTagline(e.target.value)} className="inp" placeholder="Ex : Nous prenons soin de vous · L'artisan de confiance" />
          </div>
          <div>
            <label className="lbl">{t.sb_identity_desc_lbl}</label>
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)}
              className="inp resize-y"
              placeholder="Présentez votre activité, votre expérience, votre approche, ce qui vous distingue…" />
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 3 — CONTACT & RÉSEAUX
      ────────────────────────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">{t.sb_contact_title}</h2>
          <p className="text-xs text-gray-400">{t.sb_contact_req_note}</p>
          {stepErrors.contactRequired && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
              {stepErrors.contactRequired}
            </div>
          )}
          <div>
            <label className="lbl">{t.sb_contact_phone_lbl}</label>
            <input value={phone}
              onChange={(e) => { setPhone(e.target.value); if (stepErrors.contactRequired) setStepErrors((p) => ({ ...p, contactRequired: "" })); }}
              className={`inp ${stepErrors.contactRequired && !emailContact.trim() ? "border-red-400" : ""}`}
              placeholder="+32 (0)466 42 23 77" />
          </div>
          <div>
            <label className="lbl">{t.sb_contact_phone2_lbl} <span className="text-gray-400 font-normal">{t.sb_optional}</span></label>
            <input value={phone2} onChange={(e) => setPhone2(e.target.value)} className="inp" placeholder="+32 (0)2 123 45 67" />
          </div>
          <div>
            <label className="lbl">{t.sb_contact_email_lbl}</label>
            <input type="email" value={emailContact}
              onChange={(e) => { setEmailContact(e.target.value); if (stepErrors.emailContact || stepErrors.contactRequired) setStepErrors((p) => ({ ...p, emailContact: "", contactRequired: "" })); }}
              className={`inp ${(stepErrors.emailContact || (stepErrors.contactRequired && !phone.trim())) ? "border-red-400 focus:border-red-400" : ""}`}
              placeholder="contact@monactivite.be" />
            {stepErrors.emailContact && <p className="text-red-500 text-xs mt-1">{stepErrors.emailContact}</p>}
          </div>
          <div>
            <label className="lbl">{t.sb_contact_addr_lbl}</label>
            <input value={addressStreet} onChange={(e) => setAddressStreet(e.target.value)} className="inp" placeholder="Rue de l'Exemple 12" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">{t.sb_contact_postal_lbl}</label>
              <input value={addressPostal} onChange={(e) => setAddressPostal(e.target.value)} className="inp" placeholder="1000" />
            </div>
            <div>
              <label className="lbl">{t.sb_contact_city_lbl}</label>
              <input value={addressCity} onChange={(e) => setAddressCity(e.target.value)} className="inp" placeholder="Bruxelles" />
            </div>
          </div>
          <div className="pt-3 border-t space-y-3">
            <p className="text-sm font-medium text-gray-700">{t.sb_contact_social_lbl} <span className="text-gray-400 font-normal">{t.sb_optional}</span></p>
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
          <h2 className="font-semibold text-gray-800">{t.sb_zones_title}</h2>
          <p className="text-sm text-gray-500">{t.sb_zones_desc} <span className="font-medium text-gray-700">{t.sb_err_zones_req}.</span></p>
          {stepErrors.zones && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-600">
              {stepErrors.zones}
            </div>
          )}
          {zones.map((z, i) => (
            <div key={i} className="relative flex gap-2">
              <div className="relative flex-1">
                <input
                  value={z}
                  onChange={(e) => {
                    const v = e.target.value;
                    setZones((prev) => prev.map((z2, idx) => idx === i ? v : z2));
                    if (v.trim() && stepErrors.zones) setStepErrors((p) => ({ ...p, zones: "" }));
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
            {t.sb_zones_add}
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 5 — PRESTATIONS
      ────────────────────────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="space-y-4">
          {stepErrors.offers && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              {stepErrors.offers}
            </div>
          )}
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700">
            {t.sb_offer_opt_note}
          </div>
          {offers.map((o, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">{t.sb_offer_lbl} {i + 1}</span>
                {offers.length > 1 && (
                  <button onClick={() => listRemove(setOffers, i)} className="text-red-400 hover:text-red-600 text-sm">{t.sb_remove}</button>
                )}
              </div>
              <input value={o.name}
                onChange={(e) => { listUpdate(setOffers, i, { name: e.target.value }); if (stepErrors[`offer_${i}_name`] || stepErrors.offers) setStepErrors((p) => ({ ...p, [`offer_${i}_name`]: "", offers: "" })); }}
                className={`inp ${stepErrors[`offer_${i}_name`] ? "border-red-400" : ""}`}
                placeholder={t.sb_offer_name_ph} />
              {stepErrors[`offer_${i}_name`] && <p className="text-red-500 text-xs">{stepErrors[`offer_${i}_name`]}</p>}
              <textarea rows={2} value={o.description}
                onChange={(e) => listUpdate(setOffers, i, { description: e.target.value })}
                className="inp resize-y" placeholder={t.sb_offer_desc_ph} />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="lbl">{t.sb_offer_duration_lbl}</label>
                  <input type="number" value={o.duration_min}
                    onChange={(e) => listUpdate(setOffers, i, { duration_min: e.target.value })}
                    className="inp" placeholder="60" />
                </div>
                <div>
                  <label className="lbl">{t.sb_offer_price_lbl}</label>
                  <input type="number" value={o.price_eur}
                    onChange={(e) => listUpdate(setOffers, i, { price_eur: e.target.value })}
                    className="inp" placeholder="50" />
                </div>
              </div>
              <div>
                <label className="lbl">{t.sb_offer_image_lbl} <span className="text-gray-400 font-normal">{t.sb_optional}</span></label>
                <div className="flex items-center gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => triggerUpload((file) => uploadPhoto(file, "offer", (url) => listUpdate(setOffers, i, { image_url: url })))}
                    disabled={!!uploading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors"
                  >
                    {uploading === `offer_${i}` ? (
                      <><div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />{t.sb_uploading}</>
                    ) : (
                      <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>{t.sb_offer_choose}</>
                    )}
                  </button>
                  <input value={o.image_url} onChange={(e) => listUpdate(setOffers, i, { image_url: e.target.value })}
                    className="inp flex-1" placeholder={t.sb_or_url} />
                </div>
                {(() => {
                  const warn = isUnsupportedPhotoUrl(o.image_url);
                  return o.image_url ? (
                    warn
                      ? <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">{warn}</p>
                      : <img src={o.image_url} alt="aperçu" className="h-20 w-full object-cover rounded-lg border border-gray-200"
                          onError={(e) => { e.currentTarget.style.display = "none"; }} />
                  ) : null;
                })()}
              </div>
            </div>
          ))}
          <button onClick={() => listAdd(setOffers, EMPTY_OFFER)} className="text-sm text-indigo-600 hover:underline">
            {t.sb_offer_add}
          </button>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 6 — ATOUTS
      ────────────────────────────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-gray-500">{t.sb_values_hint}</p>
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
                  <h3 className="font-semibold text-gray-900 text-base">{t.sb_atouts_what}</h3>
                  <button onClick={() => setShowAtoutsHelp(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <p className="text-sm text-gray-600">{t.sb_atouts_help_desc}</p>
                <div className="bg-indigo-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">{t.sb_atouts_examples_lbl}</p>
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
                  {t.sb_atouts_ok}
                </button>
              </div>
            </div>
          )}
          {values.map((v, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">{t.sb_value_lbl} {i + 1}</span>
                {values.length > 1 && (
                  <button onClick={() => listRemove(setValues, i)} className="text-red-400 hover:text-red-600 text-sm">{t.sb_remove}</button>
                )}
              </div>
              <div className="flex gap-3">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIconPickerIdx(iconPickerIdx === i ? null : i)}
                    className="inp w-14 h-10 flex items-center justify-center cursor-pointer hover:border-indigo-400 transition-colors text-indigo-600"
                    title={t.sb_icon_pick_lbl}
                  >
                    <AtoutIconSVG icon={v.icon || "star"} className="w-5 h-5" />
                  </button>
                  {iconPickerIdx === i && (
                    <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-gray-200 rounded-2xl shadow-xl p-3 w-80">
                      <p className="text-xs text-gray-400 mb-2 font-medium">{t.sb_icon_pick_lbl}</p>
                      <div className="grid grid-cols-5 gap-1">
                        {ATOUT_ICONS.map((ic) => (
                          <button
                            key={ic.key}
                            type="button"
                            onClick={() => { listUpdate(setValues, i, { icon: ic.key }); setIconPickerIdx(null); }}
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-indigo-50 transition-colors text-indigo-700 ${v.icon === ic.key ? "bg-indigo-100 ring-1 ring-indigo-400" : ""}`}
                            title={ic.label}
                          >
                            <AtoutIconSVG icon={ic.key} className="w-5 h-5" />
                            <span className="text-[9px] text-gray-500 leading-none text-center">{ic.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <input value={v.title}
                    onChange={(e) => { listUpdate(setValues, i, { title: e.target.value }); if (stepErrors[`value_${i}_title`]) setStepErrors((p) => ({ ...p, [`value_${i}_title`]: "" })); }}
                    className={`inp w-full ${stepErrors[`value_${i}_title`] ? "border-red-400" : ""}`}
                    placeholder={t.sb_value_title_ph} />
                  {stepErrors[`value_${i}_title`] && <p className="text-red-500 text-xs mt-1">{stepErrors[`value_${i}_title`]}</p>}
                </div>
              </div>
              <textarea rows={2} value={v.description}
                onChange={(e) => listUpdate(setValues, i, { description: e.target.value })}
                className="inp resize-y" placeholder={t.sb_value_desc_ph} />
            </div>
          ))}
          {values.length < 6 && (
            <button onClick={() => listAdd(setValues, EMPTY_VALUE)} className="text-sm text-indigo-600 hover:underline">
              {t.sb_value_add}
            </button>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────────
          ÉTAPE 7 — TÉMOIGNAGES
      ────────────────────────────────────────────────────────────────────── */}
      {step === 7 && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t.sb_testi_hint}</p>
          {testimonials.map((testi, i) => (
            <div key={i} className="bg-white rounded-xl shadow p-5 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-600">{t.sb_testi_lbl} {i + 1}</span>
                <button onClick={() => listRemove(setTestimonials, i)} className="text-red-400 hover:text-red-600 text-sm">{t.sb_remove}</button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <input value={testi.author_name}
                    onChange={(e) => { listUpdate(setTestimonials, i, { author_name: e.target.value }); if (stepErrors[`testimonial_${i}_name`]) setStepErrors((p) => ({ ...p, [`testimonial_${i}_name`]: "" })); }}
                    className={`inp ${stepErrors[`testimonial_${i}_name`] ? "border-red-400" : ""}`}
                    placeholder={t.sb_testi_name_ph} />
                  {stepErrors[`testimonial_${i}_name`] && <p className="text-red-500 text-xs mt-1">{stepErrors[`testimonial_${i}_name`]}</p>}
                </div>
                <input value={testi.author_role} onChange={(e) => listUpdate(setTestimonials, i, { author_role: e.target.value })}
                  className="inp" placeholder={t.sb_testi_role_ph} />
              </div>
              <div>
                <textarea rows={3} value={testi.content}
                  onChange={(e) => { listUpdate(setTestimonials, i, { content: e.target.value }); if (stepErrors[`testimonial_${i}_content`]) setStepErrors((p) => ({ ...p, [`testimonial_${i}_content`]: "" })); }}
                  className={`inp resize-y ${stepErrors[`testimonial_${i}_content`] ? "border-red-400" : ""}`}
                  placeholder={t.sb_testi_content_ph} />
                {stepErrors[`testimonial_${i}_content`] && <p className="text-red-500 text-xs mt-1">{stepErrors[`testimonial_${i}_content`]}</p>}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500 mr-1">{t.sb_testi_rating_lbl}</span>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => listUpdate(setTestimonials, i, { rating: star })}
                    className={`text-xl transition-colors ${star <= testi.rating ? "text-yellow-400" : "text-gray-200"}`}>★</button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={() => listAdd(setTestimonials, EMPTY_TESTIMONIAL)} className="text-sm text-indigo-600 hover:underline">
            {t.sb_testi_add}
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
              <h2 className="font-semibold text-gray-800">{t.sb_tracking_title}</h2>
              <p className="text-sm text-gray-500 mt-1">{t.sb_tracking_desc}</p>
            </div>

            <div>
              <label className="lbl flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded bg-orange-500" />
                Google Analytics 4 (GA4)
              </label>
              <input value={ga4Id} onChange={(e) => setGa4Id(e.target.value)} className="inp"
                placeholder="G-XXXXXXXXXX" />
              <p className="text-xs text-gray-400 mt-1">{t.sb_ga4_hint}</p>
            </div>

            <div>
              <label className="lbl flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded bg-blue-600" />
                Meta Pixel (Facebook / Instagram Ads)
              </label>
              <input value={metaPixelId} onChange={(e) => setMetaPixelId(e.target.value)} className="inp"
                placeholder="123456789012345" />
              <p className="text-xs text-gray-400 mt-1">{t.sb_meta_hint}</p>
            </div>

            <div>
              <label className="lbl flex items-center gap-2">
                <span className="inline-block w-4 h-4 rounded bg-blue-400" />
                Google Tag Manager (GTM)
              </label>
              <input value={gtmId} onChange={(e) => setGtmId(e.target.value)} className="inp"
                placeholder="GTM-XXXXXXX" />
              <p className="text-xs text-gray-400 mt-1">{t.sb_gtm_hint}</p>
            </div>
          </div>

          {/* CSS personnalisé — premium */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">{t.sb_css_title}</h2>
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">{t.sb_css_premium}</span>
            </div>
            <p className="text-sm text-gray-500">{t.sb_css_desc}</p>
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
            <h2 className="font-semibold text-indigo-900">{t.sb_ready_title}</h2>
            <p className="text-sm text-indigo-700">{t.sb_ready_desc}</p>
            <button onClick={previewSite} disabled={saving || !tenantSlug}
              className="w-full border border-indigo-400 text-indigo-700 bg-white font-semibold py-3 rounded-xl hover:bg-indigo-50 disabled:opacity-50 transition-colors">
              {saving ? t.sb_saving : t.sb_preview}
            </button>
            <button onClick={publish} disabled={saving}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
              {saving ? t.sb_saving : t.sb_publish}
            </button>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        {step > 0 && (
          <button onClick={prev} className="flex-1 border rounded-xl py-2.5 text-gray-600 hover:bg-gray-50 font-medium">
            {t.sb_prev}
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={next} disabled={saving}
            className="flex-1 bg-indigo-600 text-white font-semibold py-2.5 rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {saving ? t.sb_saving : t.sb_save_continue}
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
