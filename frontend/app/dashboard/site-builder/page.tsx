"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, supabase } from "../../../lib/api";
import { useLanguage } from "../../../contexts/LanguageContext";
import type { T as TranslationT } from "../../../lib/i18n";
import { COUNTRIES } from "../../../lib/countries";
import { UpgradeGate } from "../components/UpgradeGate";
import { useSubscription } from "../../../contexts/SubscriptionContext";

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
import { ATOUT_ICONS, AtoutIconSVG } from "../../../lib/atout-icons";

function SiteWireframe({ highlight }: { highlight: PhotoHighlight }) {
  const ring = "ring-2 ring-primary-500";
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
      <div className={`h-11 rounded-sm flex flex-col items-center justify-center gap-0.5 transition-all ${highlight === "hero" ? `bg-primary-400 ${ring}` : "bg-gray-300"}`}>
        {highlight === "hero"
          ? <span className="text-white font-bold" style={{ fontSize: 7 }}>📷 VOTRE PHOTO — Zone héro</span>
          : null}
        <div className={`h-1 w-14 rounded-sm ${highlight === "hero" ? "bg-white/50" : "bg-gray-400"}`} />
        <div className={`h-0.5 w-9 rounded-sm ${highlight === "hero" ? "bg-white/30" : "bg-gray-400"}`} />
      </div>
      {/* About */}
      <div className={`h-9 rounded-sm flex items-center gap-1 px-1 ${highlight === "about" ? `bg-white ${ring}` : "bg-gray-50"}`}>
        <div className={`w-9 h-7 rounded-sm flex-shrink-0 flex items-center justify-center ${highlight === "about" ? "bg-primary-400" : "bg-gray-200"}`}>
          {highlight === "about" && <span className="text-white" style={{ fontSize: 6 }}>📷</span>}
        </div>
        <div className="flex-1 space-y-0.5 py-1">
          <div className={`h-0.5 rounded-sm ${highlight === "about" ? "bg-primary-200" : "bg-gray-200"}`} />
          <div className={`h-0.5 rounded-sm w-4/5 ${highlight === "about" ? "bg-primary-200" : "bg-gray-200"}`} />
          <div className={`h-0.5 rounded-sm ${highlight === "about" ? "bg-primary-200" : "bg-gray-200"}`} />
        </div>
        {highlight === "about" && (
          <span className="text-primary-600 font-bold flex-shrink-0" style={{ fontSize: 6 }}>← ICI</span>
        )}
      </div>
      {/* Services */}
      <div className={`h-11 rounded-sm flex flex-col items-center justify-center gap-1 px-1 ${highlight === "services" ? `bg-primary-100 ${ring}` : "bg-gray-100"}`}>
        {highlight === "services" && (
          <span className="text-primary-700 font-bold" style={{ fontSize: 6 }}>📷 FOND — Section prestations</span>
        )}
        <div className="flex gap-0.5">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`w-9 h-5 rounded-sm ${highlight === "services" ? "bg-white shadow-sm" : "bg-gray-200"}`} />
          ))}
        </div>
      </div>
      {/* Contact */}
      <div className={`h-9 rounded-sm flex items-center gap-1 px-1 ${highlight === "contact" ? `bg-white ${ring}` : "bg-gray-50"}`}>
        <div className={`w-9 h-7 rounded-sm flex-shrink-0 flex items-center justify-center ${highlight === "contact" ? "bg-primary-400" : "bg-gray-200"}`}>
          {highlight === "contact" && <span className="text-white" style={{ fontSize: 6 }}>📷</span>}
        </div>
        <div className={`flex-1 h-7 rounded-sm ${highlight === "contact" ? "bg-primary-50" : "bg-gray-200"}`} />
        {highlight === "contact" && (
          <span className="text-primary-600 font-bold flex-shrink-0" style={{ fontSize: 6 }}>← ICI</span>
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
  const searchParams = useSearchParams();
  const logoPaid = searchParams.get("logo_paid") === "1";
  const { t, lang } = useLanguage();
  const { planName } = useSubscription();
  const isBusiness = planName === "Business";

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
  const [customColorHex, setCustomColorHex] = useState("#4338ca");
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
  const [addressCountry, setAddressCountry] = useState("BE");
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

  // Logo brief IA
  const [logoModalView, setLogoModalView] = useState<"info" | "chat" | "summary">("info");
  const [logoChatMessages, setLogoChatMessages] = useState<{role:string;content:string}[]>([]);
  const [logoChatInput, setLogoChatInput] = useState("");
  const [logoChatLoading, setLogoChatLoading] = useState(false);
  const [logoBrief, setLogoBrief] = useState<Record<string,any> | null>(null);
  const [logoRecommendedTier, setLogoRecommendedTier] = useState("standard");
  const [logoSelectedTier, setLogoSelectedTier] = useState("standard");
  const [logoCheckoutLoading, setLogoCheckoutLoading] = useState(false);
  const [logoRequestError, setLogoRequestError] = useState("");

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
  // Step 1 — Vidéos par section (Business uniquement)
  const [videoUrls, setVideoUrls] = useState<Record<string, string>>({});
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
      setCustomColorHex(style.custom_color_hex ?? "#4338ca");
      setFontStyle(style.font_style ?? "modern");
      setPagesEnabled(style.pages_enabled ?? ["home", "about", "services", "contact"]);
      setPhotosOption(style.photos_option ?? "needs_stock");
      setPhotoUrls(style.photo_urls ?? {});
      setVideoUrls(style.video_urls ?? {});
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
      setAddressCountry(ap.country ?? "BE");
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
    ...(primaryColor === "custom" ? { custom_color_hex: customColorHex } : {}),
    font_style: fontStyle,
    pages_enabled: pagesEnabled,
    photos_option: photosOption,
    photo_urls: photoUrls,
    video_urls: videoUrls,
    tracking: { ga4_id: ga4Id, meta_pixel_id: metaPixelId, gtm_id: gtmId },
    ...(customCss ? { custom_css: customCss } : {}),
    address_parts: { street: addressStreet, postal_code: addressPostal, city: addressCity, country: addressCountry },
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
          const fullAddress = [addressStreet, addressPostal, addressCity, addressCountry].filter(Boolean).join(", ");
          await api.updateSite(siteId, {
            phone, email_contact: emailContact, address: fullAddress,
            social_links: { facebook, instagram, linkedin, ...(phone2 ? { phone2 } : {}) },
            site_style: buildSiteStyle(),
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
            className="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700"
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
            className="px-5 py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50"
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

      {/* Bannière succès paiement logo */}
      {logoPaid && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <span className="text-green-500 text-lg flex-shrink-0">✓</span>
          <div>
            <p className="text-sm font-semibold text-green-800">{t.sb_logo_paid_success}</p>
            <p className="text-xs text-green-600 mt-0.5">{t.sb_logo_paid_desc}</p>
          </div>
        </div>
      )}

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
              className="text-xs text-primary-600 hover:underline border border-primary-200 px-3 py-1.5 rounded-lg"
            >
              {t.sb_view_site}
            </a>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div id="sb-progress" className="space-y-2">
        <div className="flex gap-1">
          {STEPS.map((_s, i) => (
            <button key={i}
              onClick={() => { if (i < step) { setStepErrors({}); setStep(i); } }}
              className={`flex-1 h-1.5 rounded-full transition-colors ${i <= step ? "bg-primary-600" : "bg-gray-200"} ${i < step ? "cursor-pointer" : "cursor-default"}`} />
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
        <div id="sb-content" className="space-y-6">

          {/* Logo */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">{t.sb_logo_title}</h2>
            {[
              { key: "has_logo",       label: t.sb_logo_has,   hint: t.sb_logo_has_hint },
              { key: "needs_creation", label: t.sb_logo_none,  hint: t.sb_logo_none_hint },
              { key: "text_only",      label: t.sb_logo_text,  hint: t.sb_logo_text_hint },
            ].map((opt) => (
              <label key={opt.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${logoOption === opt.key ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="logo" value={opt.key} checked={logoOption === opt.key}
                  onChange={() => {
                    setLogoOption(opt.key as any);
                    if (opt.key === "needs_creation") setShowLogoServiceModal(true);
                  }} className="mt-1 accent-primary-600" />
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
                    className="w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 border transition-colors border-gray-300 text-gray-400 hover:border-primary-400 hover:text-primary-500"
                  >?</button>
                </div>
                {showLogoUrlHelp && (
                  <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-sm space-y-2">
                    <p className="font-semibold text-primary-800">{t.sb_logo_how_title}</p>
                    <ol className="list-decimal list-inside space-y-1 text-primary-700 text-xs">
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
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 border border-primary-200 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50 transition-colors"
                >
                  {uploading === "logo" ? (
                    <><div className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />Envoi…</>
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

            {/* ── Modale création logo avec brief IA ── */}
            {showLogoServiceModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
                onClick={() => { setShowLogoServiceModal(false); setLogoModalView("info"); setLogoChatMessages([]); setLogoBrief(null); setLogoRequestError(""); }}>
                <div
                  className={`bg-white rounded-2xl shadow-2xl w-full flex flex-col ${logoModalView === "chat" ? "max-w-lg max-h-[85vh]" : "max-w-lg"}`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-gray-100 flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🎨</span>
                      <h3 className="font-semibold text-gray-900">
                        {logoModalView === "chat" ? t.sb_logo_modal_chat_title : logoModalView === "summary" ? t.sb_logo_modal_summary_title : t.sb_logo_modal_info_title}
                      </h3>
                    </div>
                    <button onClick={() => { setShowLogoServiceModal(false); setLogoModalView("info"); setLogoChatMessages([]); setLogoBrief(null); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                  </div>

                  {/* ── VUE INFO ── */}
                  {logoModalView === "info" && (
                    <div className="p-6 space-y-5 overflow-y-auto">
                      <p className="text-sm text-gray-500">{t.sb_logo_modal_desc}</p>
                      <div className="grid grid-cols-3 gap-3">
                        {([
                          { tier:"essentiel", label:"Essentiel", price:"149 €", items:[t.sb_logo_ess_i1, t.sb_logo_ess_i2, t.sb_logo_ess_i3, t.sb_logo_ess_i4] },
                          { tier:"standard",  label:"Standard",  price:"299 €", items:[t.sb_logo_std_i1, t.sb_logo_std_i2, t.sb_logo_std_i3, t.sb_logo_std_i4], highlight:true },
                          { tier:"premium",   label:"Premium",   price:"499 €", items:[t.sb_logo_pre_i1, t.sb_logo_pre_i2, t.sb_logo_pre_i3, t.sb_logo_pre_i4] },
                        ] as const).map((plan) => (
                          <div key={plan.tier} className={`rounded-xl p-3 border-2 text-center flex flex-col gap-1 ${"highlight" in plan && plan.highlight ? "border-primary-400 bg-primary-50" : "border-gray-100"}`}>
                            <p className="font-bold text-xs text-gray-800">{plan.label}</p>
                            <p className="text-base font-bold text-gray-900">{plan.price}</p>
                            {plan.items.map((item) => <p key={item} className="text-[10px] text-gray-500">{item}</p>)}
                            {"highlight" in plan && plan.highlight && <span className="text-[9px] font-bold text-primary-600 uppercase tracking-wide mt-1">{t.sb_logo_tier_popular}</span>}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          setLogoModalView("chat");
                          setLogoChatMessages([{
                            role: "assistant",
                            content: t.sb_logo_chat_init,
                          }]);
                        }}
                        className="w-full bg-primary-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-primary-700 transition-colors"
                      >
                        {t.sb_logo_start_brief}
                      </button>
                    </div>
                  )}

                  {/* ── VUE CHAT ── */}
                  {logoModalView === "chat" && (
                    <>
                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                        {logoChatMessages.map((m, i) => (
                          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                              m.role === "user"
                                ? "bg-primary-600 text-white rounded-br-sm"
                                : "bg-gray-100 text-gray-800 rounded-bl-sm"
                            }`}>
                              {m.content}
                            </div>
                          </div>
                        ))}
                        {logoChatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1">
                              {[0,1,2].map((i) => (
                                <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay:`${i*0.15}s` }} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Input */}
                      <div className="p-4 border-t border-gray-100 flex-shrink-0">
                        <div className="flex gap-2">
                          <input
                            value={logoChatInput}
                            onChange={(e) => setLogoChatInput(e.target.value)}
                            onKeyDown={async (e) => {
                              if (e.key === "Enter" && !e.shiftKey && logoChatInput.trim() && !logoChatLoading) {
                                e.preventDefault();
                                const userMsg = { role: "user", content: logoChatInput.trim() };
                                const newMessages = [...logoChatMessages, userMsg];
                                setLogoChatMessages(newMessages);
                                setLogoChatInput("");
                                setLogoChatLoading(true);
                                try {
                                  const res = await api.logoChat(newMessages, lang);
                                  const assistantMsg = { role: "assistant", content: res.message };
                                  setLogoChatMessages(prev => [...prev, assistantMsg]);
                                  if (res.complete) {
                                    setLogoBrief(res.brief);
                                    setLogoRecommendedTier(res.recommended_tier ?? "standard");
                                    setLogoSelectedTier(res.recommended_tier ?? "standard");
                                    setTimeout(() => setLogoModalView("summary"), 800);
                                  }
                                } catch {
                                  setLogoChatMessages(prev => [...prev, { role: "assistant", content: t.sb_logo_chat_error }]);
                                } finally {
                                  setLogoChatLoading(false);
                                }
                              }
                            }}
                            placeholder={t.sb_logo_chat_placeholder}
                            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:border-primary-400"
                            disabled={logoChatLoading}
                          />
                          <button
                            onClick={async () => {
                              if (!logoChatInput.trim() || logoChatLoading) return;
                              const userMsg = { role: "user", content: logoChatInput.trim() };
                              const newMessages = [...logoChatMessages, userMsg];
                              setLogoChatMessages(newMessages);
                              setLogoChatInput("");
                              setLogoChatLoading(true);
                              try {
                                const res = await api.logoChat(newMessages, lang);
                                const assistantMsg = { role: "assistant", content: res.message };
                                setLogoChatMessages(prev => [...prev, assistantMsg]);
                                if (res.complete) {
                                  setLogoBrief(res.brief);
                                  setLogoRecommendedTier(res.recommended_tier ?? "standard");
                                  setLogoSelectedTier(res.recommended_tier ?? "standard");
                                  setTimeout(() => setLogoModalView("summary"), 800);
                                }
                              } catch {
                                setLogoChatMessages(prev => [...prev, { role: "assistant", content: t.sb_logo_chat_error }]);
                              } finally {
                                setLogoChatLoading(false);
                              }
                            }}
                            disabled={!logoChatInput.trim() || logoChatLoading}
                            className="px-4 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-40 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* ── VUE RÉSUMÉ + PAIEMENT ── */}
                  {logoModalView === "summary" && logoBrief && (
                    <div className="p-6 space-y-5 overflow-y-auto">
                      {/* Résumé brief */}
                      <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">{t.sb_logo_brief_label}</p>
                        {Object.entries(logoBrief).filter(([k]) => k !== "recommended_tier").map(([k, v]) => (
                          <div key={k} className="flex gap-2 text-sm">
                            <span className="text-gray-400 capitalize flex-shrink-0 w-28">{k.replace(/_/g, " ")}</span>
                            <span className="text-gray-700">{Array.isArray(v) ? v.join(", ") : String(v ?? "—")}</span>
                          </div>
                        ))}
                      </div>

                      {/* Sélection tier */}
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                          {t.sb_logo_formula_label}
                          {logoRecommendedTier && <span className="ml-2 text-primary-600 normal-case font-normal">({t.sb_logo_recommended.replace("{tier}", logoRecommendedTier)})</span>}
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { key:"essentiel", label:"Essentiel", price:"149 €" },
                            { key:"standard",  label:"Standard",  price:"299 €" },
                            { key:"premium",   label:"Premium",   price:"499 €" },
                          ].map((tier) => (  // tier names intentionally not translated (commercial identifiers)
                            <button
                              key={tier.key}
                              onClick={() => setLogoSelectedTier(tier.key)}
                              className={`rounded-xl p-3 border-2 text-center transition-colors ${
                                logoSelectedTier === tier.key
                                  ? "border-primary-500 bg-primary-50"
                                  : "border-gray-200 hover:border-gray-300"
                              }`}
                            >
                              <p className="text-xs font-semibold text-gray-700">{tier.label}</p>
                              <p className="text-sm font-bold text-gray-900 mt-0.5">{tier.price}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {logoRequestError && <p className="text-xs text-red-500">{logoRequestError}</p>}

                      <button
                        onClick={async () => {
                          setLogoCheckoutLoading(true);
                          setLogoRequestError("");
                          try {
                            const req = await api.createLogoRequest({
                              brief: logoBrief,
                              chat_history: logoChatMessages,
                              price_tier: logoSelectedTier,
                            });
                            const base = window.location.origin;
                            const { checkout_url } = await api.logoCheckout(
                              req.id,
                              `${base}/dashboard/site-builder?logo_paid=1`,
                              `${base}/dashboard/site-builder`,
                            );
                            window.location.href = checkout_url;
                          } catch (e: any) {
                            setLogoRequestError(e?.message ?? t.sb_logo_request_error);
                            setLogoCheckoutLoading(false);
                          }
                        }}
                        disabled={logoCheckoutLoading}
                        className="w-full bg-primary-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50"
                      >
                        {logoCheckoutLoading ? t.sb_logo_checkout_loading : t.sb_logo_checkout_submit}
                      </button>
                      <p className="text-xs text-gray-400 text-center">{t.sb_logo_checkout_secure}</p>
                    </div>
                  )}
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
                  className={`flex items-center gap-2.5 p-2.5 border rounded-xl text-left transition-all ${primaryColor === c.key ? "border-primary-500 ring-2 ring-primary-200 bg-primary-50" : "border-gray-200 hover:border-gray-300"}`}
                >
                  <span className="w-7 h-7 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: c.hex }} />
                  <span className="text-xs font-medium text-gray-700 leading-tight">{c.label}</span>
                </button>
              ))}
            </div>

            {/* Custom color picker — bloc séparé bien visible */}
            <label className={`flex items-center gap-3 p-3 border-2 rounded-xl cursor-pointer transition-all ${
              primaryColor === "custom"
                ? "border-primary-500 bg-primary-50"
                : "border-dashed border-gray-300 hover:border-primary-400 hover:bg-gray-50"
            }`}>
              {/* Roue dégradée + aperçu */}
              <span className="relative shrink-0 w-10 h-10">
                <span
                  className="block w-10 h-10 rounded-full shadow"
                  style={{
                    background: primaryColor === "custom"
                      ? customColorHex
                      : "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)",
                  }}
                />
                <input
                  type="color"
                  value={customColorHex}
                  onChange={(e) => { setCustomColorHex(e.target.value); setPrimaryColor("custom"); }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer rounded-full"
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-700">Couleur personnalisée</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {primaryColor === "custom" ? customColorHex : "Cliquez pour choisir n'importe quelle couleur"}
                </p>
              </div>
              {primaryColor !== "custom" && (
                <span className="ml-auto text-xs font-medium text-primary-500 whitespace-nowrap">Choisir →</span>
              )}
              {primaryColor === "custom" && (
                <span className="ml-auto w-5 h-5 rounded-full border-2 border-primary-400 shrink-0" style={{ backgroundColor: customColorHex }} />
              )}
            </label>
          </div>

          {/* Police */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h2 className="font-semibold text-gray-800">{t.sb_font_title}</h2>
            {FONT_STYLES.map((f) => (
              <label key={f.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${fontStyle === f.key ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="font" value={f.key} checked={fontStyle === f.key}
                  onChange={() => setFontStyle(f.key)} className="mt-1 accent-primary-600" />
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
                <label key={page.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${pagesEnabled.includes(page.key) ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:bg-gray-50"} ${page.locked ? "opacity-80" : ""}`}>
                  <input
                    type="checkbox"
                    checked={pagesEnabled.includes(page.key)}
                    onChange={() => togglePage(page.key)}
                    disabled={page.locked}
                    className="mt-0.5 w-4 h-4 accent-primary-600"
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
              <label key={opt.key} className={`flex items-start gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${photosOption === opt.key ? "border-primary-500 bg-primary-50" : "border-gray-200 hover:bg-gray-50"}`}>
                <input type="radio" name="photos" value={opt.key} checked={photosOption === opt.key}
                  onChange={() => setPhotosOption(opt.key as any)} className="mt-1 accent-primary-600" />
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
                            ? "bg-primary-600 text-white border-primary-600"
                            : "bg-white text-gray-400 border-gray-300 hover:border-primary-400 hover:text-primary-600"
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
                          className="w-full text-xs text-center text-primary-600 hover:underline pt-1"
                        >
                          {t.sb_guide_close}
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => triggerUpload((file) => uploadPhoto(file, section.key, (url) => setPhotoUrls((p) => ({ ...p, [section.key]: url }))))}
                      disabled={!!uploading}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 border border-primary-200 text-sm font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50 transition-colors"
                    >
                      {uploading === section.key ? (
                        <><div className="w-3.5 h-3.5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />{t.sb_photo_uploading}</>
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
                            <div className="mt-2 hidden items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                              {t.sb_img_broken}
                            </div>
                          )}
                        </>
                      );
                    })()}

                    {/* ── Lien vidéo — Business uniquement ── */}
                    {isBusiness ? (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-200">
                        <div className="flex items-center gap-1.5 mb-1">
                          <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                          </svg>
                          <span className="text-xs font-medium text-gray-600">Lien vidéo</span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">Business</span>
                        </div>
                        <input
                          value={videoUrls[section.key] ?? ""}
                          onChange={(e) => setVideoUrls((prev) => ({ ...prev, [section.key]: e.target.value }))}
                          className="inp"
                          placeholder="https://youtube.com/watch?v=... ou https://vimeo.com/..."
                        />
                        {videoUrls[section.key] && (
                          <p className="text-xs text-gray-400 mt-1">
                            YouTube, Vimeo, ou fichier .mp4 direct — affiché à la place de la photo sur votre site.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-dashed border-gray-100 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-gray-300" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.845v6.31a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                        </svg>
                        <span className="text-xs text-gray-400">Lien vidéo — réservé au plan</span>
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-600">Business</span>
                      </div>
                    )}
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
          <div>
            <label className="lbl">Pays</label>
            <select value={addressCountry} onChange={(e) => setAddressCountry(e.target.value)} className="inp">
              {COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
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
                          className="w-full text-left px-4 py-2 hover:bg-primary-50 hover:text-primary-700 transition-colors"
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
          <button onClick={() => listAdd(setZones, () => "")} className="text-sm text-primary-600 hover:underline">
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-50 border border-primary-200 text-xs font-medium text-primary-700 hover:bg-primary-100 disabled:opacity-50 transition-colors"
                  >
                    {uploading === `offer_${i}` ? (
                      <><div className="w-3 h-3 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />{t.sb_uploading}</>
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
          <button onClick={() => listAdd(setOffers, EMPTY_OFFER)} className="text-sm text-primary-600 hover:underline">
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
              className="shrink-0 w-6 h-6 rounded-full border border-gray-300 text-gray-400 hover:border-primary-400 hover:text-primary-500 transition-colors text-xs font-bold leading-none flex items-center justify-center"
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
                <div className="bg-primary-50 rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-primary-700 uppercase tracking-wide">{t.sb_atouts_examples_lbl}</p>
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
                <button onClick={() => setShowAtoutsHelp(false)} className="w-full bg-primary-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-primary-700 transition-colors">
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
                    className="inp w-14 h-10 flex items-center justify-center cursor-pointer hover:border-primary-400 transition-colors text-primary-600"
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
                            className={`flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-primary-50 transition-colors text-primary-700 ${v.icon === ic.key ? "bg-primary-100 ring-1 ring-primary-400" : ""}`}
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
            <button onClick={() => listAdd(setValues, EMPTY_VALUE)} className="text-sm text-primary-600 hover:underline">
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
          <button onClick={() => listAdd(setTestimonials, EMPTY_TESTIMONIAL)} className="text-sm text-primary-600 hover:underline">
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

          {/* CSS personnalisé — Business uniquement */}
          <UpgradeGate feature="custom_css">
            <div className="bg-white rounded-xl shadow p-6 space-y-3">
              <div>
                <h2 className="font-semibold text-gray-800">CSS personnalisé</h2>
                <p className="text-sm text-gray-500 mt-1">Ajoutez votre propre CSS pour personnaliser l&apos;apparence de votre site au-delà des options du wizard.</p>
              </div>
              <textarea
                rows={8}
                value={customCss}
                onChange={(e) => setCustomCss(e.target.value)}
                className="inp font-mono text-xs"
                placeholder={`.btn-primary {\n  background: linear-gradient(135deg, #667eea, #764ba2);\n}\n\nh1 {\n  letter-spacing: -0.03em;\n}`}
              />
            </div>
          </UpgradeGate>

          {/* Publication */}
          <div className="bg-green-50 border border-green-100 rounded-xl p-6 space-y-3">
            <h2 className="font-semibold text-green-900">{t.sb_ready_title}</h2>
            <p className="text-sm text-green-700">{t.sb_ready_desc}</p>
            <button onClick={previewSite} disabled={saving || !tenantSlug}
              className="w-full border border-green-400 text-green-700 bg-white font-semibold py-3 rounded-xl hover:bg-green-50 disabled:opacity-50 transition-colors">
              {saving ? t.sb_saving : t.sb_preview}
            </button>
            <button onClick={publish} disabled={saving}
              className="w-full bg-green-600 text-white font-semibold py-3 rounded-xl hover:bg-green-700 disabled:opacity-50 transition-colors">
              {saving ? t.sb_saving : t.sb_publish}
            </button>
          </div>
        </div>
      )}

      {/* ── Navigation ─────────────────────────────────────────────────────── */}
      <div id="sb-nav" className="flex gap-3">
        {step > 0 && (
          <button onClick={prev} className="flex-1 border rounded-xl py-2.5 text-gray-600 hover:bg-gray-50 font-medium">
            {t.sb_prev}
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button onClick={next} disabled={saving}
            className="flex-1 bg-primary-600 text-white font-semibold py-2.5 rounded-xl hover:bg-primary-700 disabled:opacity-50 transition-colors">
            {saving ? t.sb_saving : t.sb_save_continue}
          </button>
        )}
      </div>

      <style jsx global>{`
        .lbl { display: block; font-size: 0.875rem; font-weight: 500; color: #374151; margin-bottom: 0.25rem; }
        .inp { width: 100%; border: 1px solid #d1d5db; border-radius: 0.5rem; padding: 0.5rem 0.75rem; font-size: 0.875rem; outline: none; transition: border-color 0.15s; }
        .inp:focus { border-color: #0D4B58; box-shadow: 0 0 0 2px #C6E5EA; }
      `}</style>
    </div>
  );
}
