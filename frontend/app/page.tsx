"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/api";
import { LangSelector } from "../contexts/LanguageContext";

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session));
  }, []);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("on"); observer.unobserve(e.target); } }),
      { threshold: 0.12 }
    );
    document.querySelectorAll("[data-r]").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const barsEl = document.getElementById("hero-bars");
    if (!barsEl) return;
    barsEl.querySelectorAll(".lbar").forEach((b) => ((b as HTMLElement).style.height = "0"));
    const bro = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        const heights = [45, 62, 38, 80, 55, 92, 70];
        barsEl.querySelectorAll(".lbar").forEach((b, i) =>
          setTimeout(() => ((b as HTMLElement).style.height = heights[i] + "%"), i * 80)
        );
        bro.disconnect();
      }
    }, { threshold: 0.3 });
    bro.observe(barsEl);
    return () => bro.disconnect();
  }, []);

  return (
    <div className="l-page">

      {/* ── NAV ── */}
      <nav className={`l-nav${navScrolled ? " scrolled" : ""}`}>
        <div className="l-nav-inner">
          <Link href="/" className="l-nav-logo">
            <img src="/logo.png" alt="Klientys" style={{ height: "30px", width: "auto" }} />
            Klientys
          </Link>
          <ul className="l-nav-links">
            <li><a href="#features">Fonctionnalités</a></li>
            <li><a href="#how">Comment ça marche</a></li>
            <li><a href="#pricing">Tarifs</a></li>
          </ul>
          <div className="l-nav-cta">
            <LangSelector />
            {loggedIn ? (
              <Link href="/dashboard" className="l-btn l-btn-primary" style={{ padding: "9px 20px", fontSize: "14px" }}>Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="l-btn l-btn-ghost" style={{ padding: "9px 20px", fontSize: "14px" }}>Connexion</Link>
                <Link href="/onboarding" className="l-btn l-btn-primary" style={{ padding: "9px 20px", fontSize: "14px" }}>Commencer →</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="l-hero">
        <div className="l-hero-bg" />
        <div className="l-hero-grid" />
        <div className="l-hero-content">
          <div className="l-hero-badge">✦ <span>Agents IA</span> — Telegram, WhatsApp & email intégrés</div>
          <h1>Votre vitrine pro.<br /><span className="l-gradient-text">En 15 minutes.</span></h1>
          <p className="l-hero-sub">Site web, réservations en ligne, CRM et agents IA. Tout-en-un pour infirmières, kinés, artisans et consultants.</p>
          <div className="l-hero-ctas">
            <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">Créer mon site gratuitement →</Link>
            <Link href="/login" className="l-btn l-btn-ghost l-btn-lg">Me connecter</Link>
          </div>
          <div className="l-hero-stats">
            <div className="l-hero-stat"><strong>500+</strong><span>Professionnels</span></div>
            <div className="l-hero-stat"><strong>15 min</strong><span>Temps moyen</span></div>
            <div className="l-hero-stat"><strong>3×</strong><span>Plus de RDV</span></div>
            <div className="l-hero-stat"><strong>97%</strong><span>Satisfaction</span></div>
          </div>
        </div>

        <div className="l-hero-visual">
          <div style={{ position: "relative" }}>
            <div className="l-float-card l-float-1">
              <div className="l-float-label">Nouveaux RDV</div>
              <div className="l-float-val">↑ +12</div>
              <div style={{ fontSize: "11px", color: "var(--l-text-3)", marginTop: "2px" }}>cette semaine</div>
            </div>
            <div className="l-float-card l-float-2">
              <div className="l-float-label">Nouveau lead</div>
              <div style={{ fontSize: "13px", color: "var(--l-text)", marginTop: "2px" }}>🩺 Marie Dupont</div>
              <div style={{ fontSize: "11px", color: "var(--l-text-3)" }}>il y a 3 minutes</div>
            </div>
            <div className="l-dash-frame">
              <div className="l-dash-bar">
                <div className="l-dash-dot" style={{ background: "#FF5F57" }} />
                <div className="l-dash-dot" style={{ background: "#FEBC2E" }} />
                <div className="l-dash-dot" style={{ background: "#28C840" }} />
                <div style={{ flex: 1, height: "18px", background: "rgba(255,255,255,.06)", borderRadius: "4px", marginLeft: "8px" }} />
              </div>
              <div className="l-dash-body">
                <div className="l-dash-sidebar">
                  <div className="l-dash-nav-item active">📊 Dashboard</div>
                  <div className="l-dash-nav-item">🌐 Mon site</div>
                  <div className="l-dash-nav-item">👥 Clients</div>
                  <div className="l-dash-nav-item">📅 Rendez-vous</div>
                  <div className="l-dash-nav-item">🤖 Agents IA</div>
                </div>
                <div className="l-dash-main">
                  <div className="l-dash-cards">
                    <div className="l-dash-card">
                      <div className="l-dash-card-label">Visiteurs / 30j</div>
                      <div className="l-dash-card-value">1 248</div>
                      <div className="l-dash-card-delta">↑ 18% ce mois</div>
                    </div>
                    <div className="l-dash-card">
                      <div className="l-dash-card-label">Leads reçus</div>
                      <div className="l-dash-card-value">34</div>
                      <div className="l-dash-card-delta">↑ 8 nouveaux</div>
                    </div>
                    <div className="l-dash-card">
                      <div className="l-dash-card-label">RDV confirmés</div>
                      <div className="l-dash-card-value">21</div>
                      <div className="l-dash-card-delta">↑ 12 ce mois</div>
                    </div>
                  </div>
                  <div className="l-dash-chart">
                    <div className="l-dash-chart-title">Réservations — 7 derniers jours</div>
                    <div className="l-bars" id="hero-bars">
                      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="lbar" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROFESSIONS ── */}
      <div className="l-logos-section">
        <div className="l-container">
          <div className="l-logos-label">Fait pour les professionnels de terrain</div>
          <div className="l-logos-row">
            {["🩺 Infirmier·ère", "🦴 Kinésithérapeute", "🔧 Artisan", "✂️ Esthéticien·ne", "⚖️ Consultant·e", "💆 Coach"].map((p) => (
              <span key={p} className="l-logo-item">{p}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <section className="l-features" id="features">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ Fonctionnalités</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">Tout ce dont vous avez besoin.<br /><span className="l-gradient-text">Dans un seul outil.</span></h2>
          <p className="l-section-sub" data-r="" data-d="2">Fini les dizaines d&apos;abonnements. Klientys centralise votre site, vos réservations et votre relation client.</p>
          <div className="l-features-grid">

            <div className="l-feat-card gold" data-r="" data-d="1">
              <div className="l-feat-icon">⚡</div>
              <h3>Site en 15 minutes</h3>
              <p>Wizard guidé en 9 étapes : logo, couleurs, services, photos, témoignages. Votre vitrine pro en ligne immédiatement.</p>
              <ul className="l-feat-list">
                <li>9 étapes guidées pas à pas</li>
                <li>Éditeur visuel no-code</li>
                <li>Publication en 1 clic</li>
                <li>SEO automatique inclus</li>
              </ul>
            </div>

            <div className="l-feat-card blue" data-r="" data-d="2">
              <div className="l-feat-icon">📅</div>
              <h3>Réservations en ligne</h3>
              <p>Calendrier intelligent avec plages horaires, pauses déjeuner et périodes bloquées. Confirmations automatiques par email.</p>
              <ul className="l-feat-list">
                <li>Créneaux disponibles en temps réel</li>
                <li>Confirmation + rappel email</li>
                <li>Gestion des indisponibilités</li>
                <li>Widget embarquable</li>
              </ul>
            </div>

            <div className="l-feat-card teal" data-r="" data-d="3">
              <div className="l-feat-icon">🤝</div>
              <h3>CRM & Agents IA</h3>
              <p>Pipeline de leads, suivi des contacts et agents IA sur Telegram & WhatsApp pour répondre à vos clients 24/7.</p>
              <ul className="l-feat-list">
                <li>Pipeline visuel de leads</li>
                <li>Agents IA Telegram & WhatsApp</li>
                <li>Analytics comportementaux</li>
                <li>Emails automatiques</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="l-how" id="how">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ Processus</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">De zéro à en ligne<br /><span className="l-gradient-text">en 3 étapes.</span></h2>
          <div className="l-steps">
            <div className="l-step" data-r="" data-d="1">
              <div className="l-step-num">1</div>
              <h3>Créez votre compte</h3>
              <p>2 minutes, sans carte bancaire. Choisissez votre type de profession et c&apos;est parti.</p>
            </div>
            <div className="l-step" data-r="" data-d="2">
              <div className="l-step-num">2</div>
              <h3>Configurez en 15 min</h3>
              <p>Notre wizard en 9 étapes vous guide : logo, services, disponibilités, zones d&apos;intervention.</p>
            </div>
            <div className="l-step" data-r="" data-d="3">
              <div className="l-step-num">3</div>
              <h3>Recevez vos clients</h3>
              <p>Votre site est en ligne, vos créneaux visibles, vos agents IA répondent 24/7.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="l-stats">
        <div className="l-container">
          <div className="l-stats-grid" data-r="">
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">500+</div>
              <div className="l-stat-label">Professionnels<br />sur Klientys</div>
            </div>
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">15 min</div>
              <div className="l-stat-label">Temps moyen<br />de création</div>
            </div>
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">3×</div>
              <div className="l-stat-label">Plus de rendez-vous<br />en moyenne</div>
            </div>
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">97%</div>
              <div className="l-stat-label">Clients satisfaits<br />sur 12 mois</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRICING ── */}
      <section className="l-pricing" id="pricing">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ Tarifs</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">Simple. Transparent.<br /><span className="l-gradient-text">Sans surprise.</span></h2>
          <p className="l-section-sub" data-r="" data-d="2">Nos tarifs sont en cours de finalisation. Rejoignez la liste d&apos;attente maintenant — inscription gratuite.</p>
          <div className="l-pricing-grid">

            <div className="l-price-card" data-r="" data-d="1">
              <div className="l-price-plan">Starter</div>
              <div className="l-price-amount" style={{ fontSize: "32px", color: "var(--l-text-3)", letterSpacing: "-.01em" }}>À venir</div>
              <p className="l-price-desc">Parfait pour démarrer votre présence en ligne.</p>
              <div className="l-price-divider" />
              <ul className="l-price-features">
                <li>1 site vitrine</li>
                <li>Réservations en ligne</li>
                <li>50 contacts CRM</li>
                <li>Emails automatiques</li>
                <li>Support email</li>
              </ul>
              <Link href="/onboarding" className="l-btn l-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>Rejoindre la liste d'attente</Link>
            </div>

            <div className="l-price-card featured" data-r="" data-d="2">
              <div className="l-price-badge">Le plus populaire</div>
              <div className="l-price-plan">Pro</div>
              <div className="l-price-amount" style={{ fontSize: "32px", color: "var(--l-gold)", letterSpacing: "-.01em" }}>À venir</div>
              <p className="l-price-desc">Pour les pros qui veulent tout automatiser.</p>
              <div className="l-price-divider" />
              <ul className="l-price-features">
                <li>Site vitrine complet</li>
                <li>Réservations illimitées</li>
                <li>CRM complet + pipeline</li>
                <li>Agents IA Telegram & WhatsApp</li>
                <li>Analytics comportementaux</li>
                <li>Widget embarquable</li>
                <li>Support prioritaire 24/7</li>
              </ul>
              <Link href="/onboarding" className="l-btn l-btn-primary" style={{ width: "100%", justifyContent: "center" }}>Rejoindre la liste d'attente →</Link>
            </div>

            <div className="l-price-card" data-r="" data-d="3">
              <div className="l-price-plan">Cabinet / Équipe</div>
              <div className="l-price-amount" style={{ fontSize: "32px", color: "var(--l-text-3)", letterSpacing: "-.01em" }}>À venir</div>
              <p className="l-price-desc">Pour les cabinets multi-praticiens et structures avec plusieurs membres.</p>
              <div className="l-price-divider" />
              <ul className="l-price-features">
                <li>Multi-utilisateurs</li>
                <li>Gestion d&apos;équipe</li>
                <li>Calendriers séparés</li>
                <li>API complète</li>
                <li>Onboarding personnalisé</li>
                <li>Account manager dédié</li>
              </ul>
              <Link href="/onboarding" className="l-btn l-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>Nous contacter</Link>
            </div>

          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section className="l-testimonials">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ Témoignages</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">Ils nous font <span className="l-gradient-text">confiance.</span></h2>
          <div className="l-testi-grid" style={{ marginTop: "48px" }}>

            <div className="l-testi-card" data-r="" data-d="1">
              <div className="l-testi-stars">★★★★★</div>
              <p className="l-testi-text">&quot;Mon site était en ligne en 18 minutes chrono. Mes patients prennent désormais RDV directement, je ne reçois plus d&apos;appels à 22h. Un vrai soulagement.&quot;</p>
              <div className="l-testi-author">
                <div className="l-testi-avatar" style={{ background: "rgba(13,75,88,.4)", color: "var(--l-teal-xl)" }}>SR</div>
                <div>
                  <div className="l-testi-name">Sophie Renard</div>
                  <div className="l-testi-role">Infirmière libérale, Bruxelles</div>
                </div>
              </div>
            </div>

            <div className="l-testi-card" data-r="" data-d="2">
              <div className="l-testi-stars">★★★★★</div>
              <p className="l-testi-text">&quot;L&apos;agent IA Telegram répond aux questions pendant que je suis en séance. Mon taux de no-show a chuté de 40% grâce aux rappels automatiques.&quot;</p>
              <div className="l-testi-author">
                <div className="l-testi-avatar" style={{ background: "rgba(170,189,216,.15)", color: "var(--l-blue)" }}>MD</div>
                <div>
                  <div className="l-testi-name">Marc Dupont</div>
                  <div className="l-testi-role">Kinésithérapeute, Lyon</div>
                </div>
              </div>
            </div>

            <div className="l-testi-card" data-r="" data-d="3">
              <div className="l-testi-stars">★★★★★</div>
              <p className="l-testi-text">&quot;J&apos;avais peur de ne pas m&apos;en sortir techniquement. Le wizard est tellement bien guidé que même moi j&apos;ai réussi ! Mon agenda est plein depuis le premier mois.&quot;</p>
              <div className="l-testi-author">
                <div className="l-testi-avatar" style={{ background: "rgba(221,170,64,.15)", color: "var(--l-gold)" }}>AB</div>
                <div>
                  <div className="l-testi-name">Aminata Bastin</div>
                  <div className="l-testi-role">Esthéticienne, Paris</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="l-cta-section">
        <div className="l-container">
          <div data-r="">
            <h2>Prêt à décoller ?<br /><span className="l-gradient-text">Commencez maintenant.</span></h2>
            <p>Rejoignez 500+ professionnels qui ont choisi Klientys.<br />14 jours gratuits, sans carte bancaire.</p>
            <div className="l-cta-group">
              <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg">Créer mon compte gratuitement →</Link>
              <Link href="/login" className="l-btn l-btn-ghost l-btn-lg">Me connecter</Link>
            </div>
            <p className="l-cta-note">✓ Installation en 2 minutes &nbsp;·&nbsp; ✓ Annulation à tout moment &nbsp;·&nbsp; ✓ Support inclus</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-top">
            <div>
              <Link href="/" className="l-footer-logo">
                <img src="/logo.png" alt="Klientys" style={{ height: "28px", width: "auto" }} />
                Klientys
              </Link>
              <p className="l-footer-desc">La plateforme tout-en-un pour créer votre site, gérer vos réservations et fidéliser vos clients.</p>
            </div>
            <div className="l-footer-col">
              <h4>Produit</h4>
              <a href="#features">Fonctionnalités</a>
              <a href="#pricing">Tarifs</a>
              <a href="#how">Comment ça marche</a>
            </div>
            <div className="l-footer-col">
              <h4>Accès</h4>
              <Link href="/login">Connexion</Link>
              <Link href="/onboarding">Créer un compte</Link>
            </div>
            <div className="l-footer-col">
              <h4>Contact</h4>
              <a href="mailto:hello@klientys.com">hello@klientys.com</a>
            </div>
          </div>
          <div className="l-footer-bottom">
            <span>© {new Date().getFullYear()} Klientys. Tous droits réservés.</span>
            <LangSelector />
          </div>
        </div>
      </footer>

    </div>
  );
}
