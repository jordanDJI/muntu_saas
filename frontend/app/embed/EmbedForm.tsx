"use client";
import ContactForm from "../[tenant]/contact-form";
import { resolveSiteColors } from "../[tenant]/site-colors";
import { getSectorVocab } from "../../lib/sectorVocabulary";
import { useEmbedLang, EMBED_T } from "./i18n";
import { useIntegration } from "./useIntegration";

// Widgets book / contact : le formulaire du site Klientys lui-même, et non une
// copie. Questions personnalisées, acompte PayPal, prestations, nombre de
// personnes et consentement RGPD se comportent donc exactement comme sur le
// site — et toute évolution du formulaire s'applique aux deux.
export function EmbedForm({ slug, widget }: { slug: string; widget: "book" | "contact" }) {
  const lang = useEmbedLang();
  const integration = useIntegration(slug, widget);

  // Rien tant que le serveur n'a pas répondu : la config (questions, acompte)
  // arrive avec le ping, et un formulaire affiché sans elle changerait sous
  // les yeux du visiteur.
  if (integration.status === "loading") return null;

  // Intégration désactivée : dans une iframe, embed.js masque déjà le cadre ;
  // ouvert en lien direct, le visiteur doit comprendre pourquoi.
  if (integration.status === "disabled") {
    return integration.standalone ? (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center text-sm text-gray-500">
        {EMBED_T[lang].unavailable}
      </div>
    ) : null;
  }

  const form = integration.form;
  const colors = resolveSiteColors(form?.primary_color, form?.custom_color_hex);

  return (
    <div className={`bg-white p-5 ${integration.standalone ? "min-h-screen max-w-xl mx-auto" : ""}`}>
      <ContactForm
        tenantSlug={slug}
        lang={lang}
        fixedMode={widget === "book" ? "appointment" : "contact"}
        integrationKey={integration.key}
        track={false}
        accentColor={colors.accent}
        offers={form?.offers ?? []}
        vocab={getSectorVocab(form?.sector ?? "other", lang)}
        bookingQuestions={form?.booking_questions ?? []}
        depositConfig={form?.deposit ?? undefined}
      />
    </div>
  );
}
