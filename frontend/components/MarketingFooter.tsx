import Link from "next/link";

export default function MarketingFooter() {
  return (
    <footer className="l-footer" style={{ background: "var(--l-bg)" }}>
      <div className="l-footer-inner">
        <div className="l-footer-top">
          {/* Brand */}
          <div>
            <Link href="/" className="l-footer-logo">
              <img src="/logo.png" alt="Klientys" style={{ height: "28px", width: "auto" }} />
              Klientys
            </Link>
            <p className="l-footer-desc">
              La plateforme tout-en-un pour indépendants et TPE — site, RDV, CRM et agents IA en un seul outil.
            </p>
          </div>

          {/* Produit */}
          <div className="l-footer-col">
            <h4>Produit</h4>
            <Link href="/#features">Fonctionnalités</Link>
            <Link href="/#pricing">Tarifs</Link>
            <Link href="/#how">Comment ça marche</Link>
            <Link href="/#faq">FAQ</Link>
          </div>

          {/* Métiers */}
          <div className="l-footer-col">
            <h4>Métiers</h4>
            <Link href="/site-internet-pour/kinesitherapeute">Kinésithérapeute</Link>
            <Link href="/site-internet-pour/infirmier-liberal">Infirmier libéral</Link>
            <Link href="/site-internet-pour/plombier">Plombier</Link>
            <Link href="/site-internet-pour/coach-sportif">Coach sportif</Link>
            <Link href="/site-internet-pour">Tous les métiers →</Link>
          </div>

          {/* Accès */}
          <div className="l-footer-col">
            <h4>Accès</h4>
            <Link href="/login">Se connecter</Link>
            <Link href="/onboarding">Créer mon site</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/annuaire">Annuaire</Link>
          </div>

          {/* Légal */}
          <div className="l-footer-col">
            <h4>Légal</h4>
            <Link href="/legal/cgu">CGU</Link>
            <Link href="/legal/privacy">Confidentialité</Link>
            <Link href="/legal/mentions">Mentions légales</Link>
            <a href="mailto:support@klientys.co">support@klientys.co</a>
          </div>
        </div>

        <div className="l-footer-bottom">
          <span>© {new Date().getFullYear()} Klientys. Tous droits réservés.</span>
          <span style={{ color: "var(--l-text-3)", fontSize: "12px" }}>
            Site + RDV + CRM pour indépendants
          </span>
        </div>
      </div>
    </footer>
  );
}