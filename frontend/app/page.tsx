import Link from "next/link";

const FEATURES = [
  {
    icon: "🌐",
    title: "Site pro en 15 minutes",
    description:
      "Créez votre site professionnel sans aucune compétence technique. Choisissez votre secteur, remplissez vos infos — c'est en ligne.",
  },
  {
    icon: "📬",
    title: "Boîte de réception unifiée",
    description:
      "Email, WhatsApp, formulaire de contact — toutes vos demandes arrivent au même endroit. Vous ne ratez plus rien.",
  },
  {
    icon: "📅",
    title: "Prise de RDV automatisée",
    description:
      "Vos clients réservent directement en ligne. Rappels automatiques, zéro aller-retour, zéro no-show.",
  },
  {
    icon: "🤖",
    title: "Chatbot IA sur votre site",
    description:
      "Un assistant répond à vos questions fréquentes 24h/24. Horaires, services, tarifs — sans que vous leviez le petit doigt.",
  },
  {
    icon: "⚡",
    title: "Assistant opérationnel IA",
    description:
      "Résumés de vos conversations, notifications de RDV, gestion de votre agenda — votre assistant travaille pendant que vous travaillez.",
  },
  {
    icon: "📊",
    title: "Tableau de bord ROI",
    description:
      "Voyez exactement combien de clients votre site vous a apportés. Des chiffres clairs, pas des promesses.",
  },
];

const STEPS = [
  {
    number: "01",
    title: "Créez votre site",
    description:
      "Choisissez votre secteur d'activité, renseignez vos services et votre zone d'intervention. Votre site est publié instantanément.",
  },
  {
    number: "02",
    title: "Recevez vos clients",
    description:
      "Le chatbot répond, le formulaire capture les demandes, le calendrier encaisse les réservations — tout automatiquement.",
  },
  {
    number: "03",
    title: "Gérez tout depuis un seul endroit",
    description:
      "Votre tableau de bord centralise leads, rendez-vous et résumés IA. Consacrez votre temps à votre métier, pas à l'administratif.",
  },
];

const PROFILES = [
  { emoji: "🩺", label: "Infirmier·ère indépendant·e" },
  { emoji: "🔧", label: "Artisan & prestataire local" },
  { emoji: "💆", label: "Kinésithérapeute / Coach" },
  { emoji: "⚖️", label: "Consultant·e & profession libérale" },
  { emoji: "✂️", label: "Esthéticien·ne & beauté" },
  { emoji: "🏠", label: "Service à domicile" },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-bold text-lg text-indigo-600">Présence&nbsp;Pro</span>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-indigo-600 font-medium px-3 py-2 rounded-lg transition-colors"
            >
              Se connecter
            </Link>
            <Link
              href="/onboarding"
              className="text-sm bg-indigo-600 text-white font-medium px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Essayer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-6 bg-gradient-to-b from-indigo-50 to-white">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide">
            Pour les indépendants non techniciens
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
            Votre présence digitale complète,{" "}
            <span className="text-indigo-600">sans compétence technique</span>
          </h1>
          <p className="text-lg text-gray-500 max-w-2xl mx-auto">
            Site web professionnel, prise de RDV automatisée, chatbot IA et tableau de bord — tout ce qu'il faut pour développer votre activité, en moins de 15 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <Link
              href="/onboarding"
              className="bg-indigo-600 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-700 transition-colors text-sm"
            >
              Créer mon site gratuitement
            </Link>
            <Link
              href="/login"
              className="border border-gray-200 text-gray-700 font-semibold px-8 py-3 rounded-xl hover:bg-gray-50 transition-colors text-sm"
            >
              J'ai déjà un compte
            </Link>
          </div>
          <p className="text-xs text-gray-400">Sans carte bancaire · Prêt en 15 minutes</p>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">
              Tout ce dont vous avez besoin, rien de superflu
            </h2>
            <p className="text-gray-500 mt-3 max-w-xl mx-auto">
              Une plateforme conçue pour les indépendants qui veulent des résultats concrets, pas des fonctionnalités dont ils ne se serviront jamais.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-gray-50 rounded-2xl p-6 space-y-3 hover:shadow-md transition-shadow"
              >
                <span className="text-3xl">{f.icon}</span>
                <h3 className="font-semibold text-gray-900">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-indigo-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Comment ça marche ?</h2>
            <p className="text-gray-500 mt-3">Trois étapes, pas une de plus.</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {STEPS.map((s) => (
              <div key={s.number} className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600 text-white font-bold text-lg">
                  {s.number}
                </div>
                <h3 className="font-semibold text-gray-900 text-lg">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Profiles */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Fait pour votre métier</h2>
          <p className="text-gray-500 mb-10">
            Infirmier, artisan, coach ou consultant — la plateforme s'adapte à votre secteur et à vos besoins spécifiques.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {PROFILES.map((p) => (
              <div
                key={p.label}
                className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-full px-4 py-2 text-sm font-medium text-gray-700"
              >
                <span>{p.emoji}</span>
                <span>{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ROI callout */}
      <section className="py-20 px-6 bg-gray-900 text-white">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <h2 className="text-3xl font-bold">
            Un indépendant sur deux perd des clients faute de présence en ligne.
          </h2>
          <p className="text-gray-400 text-lg">
            Votre site est votre commercial le plus disponible — il travaille la nuit, le week-end, pendant vos consultations. Et vous voyez exactement ce qu'il vous rapporte.
          </p>
          <Link
            href="/onboarding"
            className="inline-block bg-indigo-500 text-white font-semibold px-8 py-3 rounded-xl hover:bg-indigo-400 transition-colors text-sm"
          >
            Démarrer maintenant — c'est gratuit
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6 bg-white border-t border-gray-100">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-bold text-indigo-600">Présence Pro</span>
          <div className="flex gap-6 text-sm text-gray-500">
            <Link href="/login" className="hover:text-indigo-600 transition-colors">
              Connexion
            </Link>
            <Link href="/onboarding" className="hover:text-indigo-600 transition-colors">
              Inscription
            </Link>
          </div>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()} Présence Pro. Tous droits réservés.</p>
        </div>
      </footer>
    </div>
  );
}
