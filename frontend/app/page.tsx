"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "../lib/api";
import { LangSelector, useLanguage } from "../contexts/LanguageContext";
import CookieBanner from "../components/CookieBanner";

const FAQ_KEYS = [
  ["lp_faq1_q", "lp_faq1_a"],
  ["lp_faq2_q", "lp_faq2_a"],
  ["lp_faq3_q", "lp_faq3_a"],
  ["lp_faq4_q", "lp_faq4_a"],
  ["lp_faq5_q", "lp_faq5_a"],
  ["lp_faq6_q", "lp_faq6_a"],
] as const;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LandingPage() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [navScrolled, setNavScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [tenantCount, setTenantCount] = useState<number | null>(null);
  const { t } = useLanguage();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setLoggedIn(!!session));
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/v1/public/stats`)
      .then((r) => r.json())
      .then((d) => setTenantCount(d.tenant_count ?? null))
      .catch(() => {});
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

  useEffect(() => {
    if (mobileMenuOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenuOpen]);

  const closeMobile = () => setMobileMenuOpen(false);

  const trackLead = () => {
    if (typeof window === "undefined") return;
    if ((window as any).fbq)  (window as any).fbq("track", "Lead");
    if ((window as any).gtag) (window as any).gtag("event", "generate_lead");
  };

  return (
    <div className="l-page">

      {/* ── MOBILE MENU ── */}
      <div className={`l-mobile-menu${mobileMenuOpen ? " open" : ""}`}>
        <button className="l-mobile-menu-close" onClick={closeMobile} aria-label="Fermer">×</button>
        <a href="#features" onClick={closeMobile}>{t.lp_nav_feat}</a>
        <a href="#how" onClick={closeMobile}>{t.lp_nav_how}</a>
        <a href="#pricing" onClick={closeMobile}>{t.lp_nav_pricing}</a>
        <a href="#faq" onClick={closeMobile}>FAQ</a>
        <div className="l-mobile-menu-cta">
          {loggedIn ? (
            <Link href="/dashboard" className="l-btn l-btn-primary" style={{ justifyContent: "center" }} onClick={closeMobile}>{t.nav_dashboard}</Link>
          ) : (
            <>
              <Link href="/onboarding" className="l-btn l-btn-primary" style={{ justifyContent: "center" }} onClick={() => { closeMobile(); trackLead(); }}>{t.lp_nav_start}</Link>
              <Link href="/login" className="l-btn l-btn-ghost" style={{ justifyContent: "center" }} onClick={closeMobile}>{t.lp_nav_login}</Link>
            </>
          )}
        </div>
      </div>

      {/* ── NAV ── */}
      <nav className={`l-nav${navScrolled ? " scrolled" : ""}`}>
        <div className="l-nav-inner">
          <Link href="/" className="l-nav-logo">
            <Image src="/logo.png" alt="Klientys" width={120} height={30} priority />
            Klientys
          </Link>
          <ul className="l-nav-links">
            <li><a href="#features">{t.lp_nav_feat}</a></li>
            <li><a href="#how">{t.lp_nav_how}</a></li>
            <li><a href="#pricing">{t.lp_nav_pricing}</a></li>
            <li><a href="#faq">FAQ</a></li>
          </ul>
          <div className="l-nav-cta">
            <LangSelector />
            {loggedIn ? (
              <Link href="/dashboard" className="l-btn l-btn-primary" style={{ padding: "9px 20px", fontSize: "14px" }}>{t.nav_dashboard}</Link>
            ) : (
              <>
                <Link href="/login" className="l-btn l-btn-ghost" style={{ padding: "9px 20px", fontSize: "14px" }}>{t.lp_nav_login}</Link>
                <Link href="/onboarding" className="l-btn l-btn-primary" style={{ padding: "9px 20px", fontSize: "14px" }} onClick={trackLead}>{t.lp_nav_start}</Link>
              </>
            )}
            <button className="l-nav-hamburger" onClick={() => setMobileMenuOpen(true)} aria-label="Menu">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              {t.nav_mobile_open}
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="l-hero">
        <div className="l-hero-bg" />
        <div className="l-hero-grid" />
        <div className="l-hero-content">
          <div className="l-hero-badge">✦ <span>Agents IA</span> — Telegram, WhatsApp &amp; email intégrés</div>
          <h1>{t.lp_h1}<br /><span className="l-gradient-text">{t.lp_h1b}</span></h1>
          <p className="l-hero-sub">{t.lp_sub}</p>
          <div className="l-hero-ctas">
            <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg" onClick={trackLead}>
              {t.lp_cta}
            </Link>
            <Link href="/login" className="l-btn l-btn-ghost l-btn-lg">{t.lp_cta2}</Link>
          </div>
          <div className="l-hero-trust">
            <span>✓ Sans carte bancaire</span>
            <span className="l-hero-trust-dot">·</span>
            <span>✓ En ligne en 15 minutes</span>
            <span className="l-hero-trust-dot">·</span>
            <span>✓ Annulation à tout moment</span>
          </div>
          <div className="l-hero-stats">
            <div className="l-hero-stat"><strong>{tenantCount !== null ? `${tenantCount}+` : "500+"}</strong><span>{t.lp_stat1}</span></div>
            <div className="l-hero-stat"><strong>15 min</strong><span>{t.lp_stat2}</span></div>
            <div className="l-hero-stat"><strong>3×</strong><span>{t.lp_stat3}</span></div>
            <div className="l-hero-stat"><strong>97%</strong><span>{t.lp_stat4}</span></div>
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
          <div className="l-logos-label">{t.lp_for_pros}</div>
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
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ {t.lp_feat_tag}</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">{t.lp_feat_h2a}<br /><span className="l-gradient-text">{t.lp_feat_h2b}</span></h2>
          <p className="l-section-sub" data-r="" data-d="2">{t.lp_feat_sub}</p>
          <div className="l-features-grid">

            <div className="l-feat-card gold" data-r="" data-d="1">
              <div className="l-feat-icon">⚡</div>
              <h3>{t.lp_feat1_t}</h3>
              <p>{t.lp_feat1_d}</p>
              <ul className="l-feat-list">
                <li>9 étapes guidées pas à pas</li>
                <li>Éditeur visuel no-code</li>
                <li>SEO automatique inclus</li>
                <li>Domaine personnalisé (.be, .fr, .com…)</li>
                <li>Annuaire professionnel public</li>
              </ul>
            </div>

            <div className="l-feat-card blue" data-r="" data-d="2">
              <div className="l-feat-icon">📅</div>
              <h3>{t.lp_feat2_t}</h3>
              <p>{t.lp_feat2_d}</p>
              <ul className="l-feat-list">
                <li>Créneaux disponibles en temps réel</li>
                <li>Confirmation + rappel email automatique</li>
                <li>Gestion des indisponibilités &amp; congés</li>
                <li>Widget embarquable sur votre site actuel</li>
                <li>Zéro no-show grâce aux rappels</li>
              </ul>
            </div>

            <div className="l-feat-card teal" data-r="" data-d="3">
              <div className="l-feat-icon">🤖</div>
              <h3>{t.lp_feat3_t}</h3>
              <p>{t.lp_feat3_d}</p>
              <ul className="l-feat-list">
                <li>Pipeline visuel de leads</li>
                <li>Agents IA Telegram, WhatsApp &amp; email</li>
                <li>Analytics comportementaux du site</li>
                <li>Potentiel de demande locale (Google Trends)</li>
                <li>Multi-utilisateurs &amp; gestion d&apos;équipe</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="l-how" id="how">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ {t.lp_how_tag}</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">{t.lp_how_h2a}<br /><span className="l-gradient-text">{t.lp_how_h2b}</span></h2>
          <div className="l-steps">
            <div className="l-step" data-r="" data-d="1">
              <div className="l-step-num">1</div>
              <h3>{t.lp_step1_t}</h3>
              <p>{t.lp_step1_d}</p>
            </div>
            <div className="l-step" data-r="" data-d="2">
              <div className="l-step-num">2</div>
              <h3>{t.lp_step2_t}</h3>
              <p>{t.lp_step2_d}</p>
            </div>
            <div className="l-step" data-r="" data-d="3">
              <div className="l-step-num">3</div>
              <h3>{t.lp_step3_t}</h3>
              <p>{t.lp_step3_d}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="l-stats">
        <div className="l-container">
          <div className="l-stats-grid" data-r="">
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">{tenantCount !== null ? `${tenantCount}+` : "500+"}</div>
              <div className="l-stat-label" style={{ whiteSpace: "pre-line" }}>{t.lp_sstat1}</div>
            </div>
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">15 min</div>
              <div className="l-stat-label" style={{ whiteSpace: "pre-line" }}>{t.lp_sstat2}</div>
            </div>
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">3×</div>
              <div className="l-stat-label" style={{ whiteSpace: "pre-line" }}>{t.lp_sstat3}</div>
            </div>
            <div className="l-stat-item">
              <div className="l-stat-num l-gradient-text">97%</div>
              <div className="l-stat-label" style={{ whiteSpace: "pre-line" }}>{t.lp_sstat4}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS (moved before pricing) ── */}
      <section className="l-testimonials">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ {t.lp_testi_tag}</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">{t.lp_testi_h2a}<span className="l-gradient-text">{t.lp_testi_h2b}</span></h2>
          <div className="l-testi-grid" style={{ marginTop: "48px" }}>

            <div className="l-testi-card" data-r="" data-d="1">
              <div className="l-testi-stars">★★★★★</div>
              <p className="l-testi-text">&quot;Mes patients réservent maintenant directement en ligne. Plus d&apos;appels le soir — mon agenda est toujours plein et je me concentre sur mes soins.&quot;</p>
              <div className="l-testi-author">
                <div className="l-testi-avatar" style={{ background: "rgba(13,75,88,.4)", color: "var(--l-teal-xl)" }}>JY</div>
                <div>
                  <div className="l-testi-name">Josiane Yollande</div>
                  <div className="l-testi-role">Infirmière libérale, Bruxelles</div>
                </div>
              </div>
            </div>

            <div className="l-testi-card" data-r="" data-d="2">
              <div className="l-testi-stars">★★★★★</div>
              <p className="l-testi-text">&quot;Je suis sur chantier toute la journée. L&apos;agent IA répond à mes clients pendant que je travaille. Mon taux de no-show a chuté de 40% grâce aux rappels automatiques.&quot;</p>
              <div className="l-testi-author">
                <div className="l-testi-avatar" style={{ background: "rgba(170,189,216,.15)", color: "var(--l-blue)" }}>TB</div>
                <div>
                  <div className="l-testi-name">Thierry Bales</div>
                  <div className="l-testi-role">Artisan BTP, Darmstadt – Allemagne</div>
                </div>
              </div>
            </div>

            <div className="l-testi-card" data-r="" data-d="3">
              <div className="l-testi-stars">★★★★★</div>
              <p className="l-testi-text">&quot;Je n&apos;y connaissais rien en informatique. Le wizard est tellement bien guidé que même moi j&apos;ai réussi ! Mon agenda est plein depuis le premier mois.&quot;</p>
              <div className="l-testi-author">
                <div className="l-testi-avatar" style={{ background: "rgba(221,170,64,.15)", color: "var(--l-gold)" }}>SG</div>
                <div>
                  <div className="l-testi-name">Samy Glo</div>
                  <div className="l-testi-role">Esthéticienne, Paris</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── TRUST BAR ── */}
      <div className="l-trust-bar">
        <div className="l-trust-item"><span className="l-trust-icon">🔒</span>{t.lp_trust_stripe}</div>
        <div className="l-trust-item"><span className="l-trust-icon">🇪🇺</span>{t.lp_trust_gdpr}</div>
        <div className="l-trust-item"><span className="l-trust-icon">✕</span>{t.lp_trust_cancel}</div>
        <div className="l-trust-item"><span className="l-trust-icon">💬</span>{t.lp_trust_support}</div>
      </div>

      {/* ── PRICING ── */}
      <section className="l-pricing" id="pricing">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ {t.lp_price_tag}</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">{t.lp_price_h2a}<br /><span className="l-gradient-text">{t.lp_price_h2b}</span></h2>
          <p className="l-section-sub" data-r="" data-d="2">{t.lp_price_sub}</p>
          <div className="l-pricing-grid">

            <div className="l-price-card" data-r="" data-d="1">
              <div className="l-price-plan">{t.lp_plan1_n}</div>
              <div className="l-price-amount">
                <span style={{ fontSize: "38px", fontWeight: 700, letterSpacing: "-.02em" }}>29,90€</span>
                <span style={{ fontSize: "14px", color: "var(--l-text-3)", marginLeft: "4px" }}>/mois</span>
              </div>
              <p className="l-price-desc">{t.lp_plan1_d}</p>
              <div className="l-price-divider" />
              <ul className="l-price-features">
                <li>1 site vitrine (jusqu&apos;à 3 pages)</li>
                <li>Réservations en ligne</li>
                <li>100 contacts CRM</li>
                <li>Emails automatiques</li>
                <li>Annuaire professionnel public</li>
                <li>Support email</li>
              </ul>
              <Link href="/onboarding" className="l-btn l-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>{t.lp_waitlist}</Link>
            </div>

            <div className="l-price-card featured" data-r="" data-d="2">
              <div className="l-price-badge">{t.lp_popular}</div>
              <div className="l-price-plan">{t.lp_plan2_n}</div>
              <div className="l-price-amount">
                <span style={{ fontSize: "38px", fontWeight: 700, color: "var(--l-gold)", letterSpacing: "-.02em" }}>59,90€</span>
                <span style={{ fontSize: "14px", color: "var(--l-text-3)", marginLeft: "4px" }}>/mois</span>
              </div>
              <p className="l-price-desc">{t.lp_plan2_d}</p>
              <div className="l-price-divider" />
              <ul className="l-price-features">
                <li>Site vitrine multi-pages complet</li>
                <li>Réservations illimitées</li>
                <li>CRM complet + pipeline illimité</li>
                <li>Agent IA vitrine &amp; support client</li>
                <li>Analytics comportementaux</li>
                <li>Domaine personnalisé inclus</li>
                <li>Widget embarquable</li>
                <li>Support prioritaire 24/7</li>
              </ul>
              <Link href="/onboarding" className="l-btn l-btn-primary" style={{ width: "100%", justifyContent: "center" }}>{t.lp_waitlist_arr}</Link>
            </div>

            <div className="l-price-card" data-r="" data-d="3">
              <div className="l-price-plan">{t.lp_plan3_n}</div>
              <div className="l-price-amount">
                <span style={{ fontSize: "38px", fontWeight: 700, letterSpacing: "-.02em" }}>99,90€</span>
                <span style={{ fontSize: "14px", color: "var(--l-text-3)", marginLeft: "4px" }}>/mois</span>
              </div>
              <p className="l-price-desc">{t.lp_plan3_d}</p>
              <div className="l-price-divider" />
              <ul className="l-price-features">
                <li>Tout du plan Pro</li>
                <li>Multi-espaces de travail</li>
                <li>Gestion d&apos;équipe &amp; calendriers séparés</li>
                <li>Agent IA assistant personnel</li>
                <li>Potentiel de demande locale (Trends)</li>
                <li>Onboarding personnalisé</li>
                <li>Account manager dédié</li>
              </ul>
              <Link href="/onboarding" className="l-btn l-btn-ghost" style={{ width: "100%", justifyContent: "center" }}>{t.lp_waitlist}</Link>
            </div>

          </div>
          <p style={{ textAlign: "center", fontSize: "13px", color: "var(--l-text-3)", marginTop: "24px" }}>
            💳 Paiement sécurisé Stripe · Annulation à tout moment · Prix HT
          </p>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="l-faq" id="faq">
        <div className="l-container">
          <div className="l-section-tag" data-r=""><div className="l-tag">✦ {t.lp_faq_tag}</div></div>
          <h2 className="l-section-h2" data-r="" data-d="1">{t.lp_faq_h2a}<br /><span className="l-gradient-text">{t.lp_faq_h2b}</span></h2>
          <div className="l-faq-list">
            {FAQ_KEYS.map(([qKey, aKey], i) => (
              <div key={i} data-r="" data-d={String(Math.min(i + 1, 4))}>
                <div className={`l-faq-item${openFaq === i ? " open" : ""}`}>
                  <div className="l-faq-q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span>{t[qKey]}</span>
                    <span className="l-faq-chevron">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </span>
                  </div>
                  <div className="l-faq-a">
                    <div className="l-faq-a-inner">{t[aKey]}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="l-cta-section">
        <div className="l-container">
          <div data-r="">
            <h2>{t.lp_final_h2a}<br /><span className="l-gradient-text">{t.lp_final_h2b}</span></h2>
            <p style={{ whiteSpace: "pre-line" }}>{t.lp_final_sub}</p>
            <div className="l-cta-group">
              <Link href="/onboarding" className="l-btn l-btn-primary l-btn-lg" onClick={trackLead}>{t.lp_final_cta}</Link>
              <Link href="/login" className="l-btn l-btn-ghost l-btn-lg">{t.lp_cta2}</Link>
            </div>
            <p className="l-cta-note">{t.lp_final_note}</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="l-footer">
        <div className="l-footer-inner">
          <div className="l-footer-top">
            <div>
              <Link href="/" className="l-footer-logo">
                <Image src="/logo.png" alt="Klientys" width={112} height={28} />
                Klientys
              </Link>
              <p className="l-footer-desc">{t.lp_footer_desc}</p>
            </div>
            <div className="l-footer-col">
              <h4>{t.lp_footer_prod}</h4>
              <a href="#features">{t.lp_nav_feat}</a>
              <a href="#pricing">{t.lp_nav_pricing}</a>
              <a href="#how">{t.lp_nav_how}</a>
              <a href="#faq">FAQ</a>
            </div>
            <div className="l-footer-col">
              <h4>{t.lp_footer_access}</h4>
              <Link href="/login">{t.lp_nav_login}</Link>
              <Link href="/onboarding">{t.lp_footer_create}</Link>
              <Link href="/blog">Blog</Link>
            </div>
            <div className="l-footer-col">
              <h4>{t.lp_footer_contact_h}</h4>
              <a href="mailto:support@klientys.co">support@klientys.co</a>
            </div>
            <div className="l-footer-col">
              <h4>{t.lp_footer_legal}</h4>
              <Link href="/legal/cgu">{t.lp_footer_cgu}</Link>
              <Link href="/legal/privacy">{t.lp_footer_privacy}</Link>
              <Link href="/legal/mentions">{t.lp_footer_mentions}</Link>
            </div>
          </div>
          <div className="l-footer-bottom">
            <span>© {new Date().getFullYear()} Klientys. {t.land_footer_rights}</span>
            <LangSelector />
          </div>
        </div>
      </footer>

      {/* ── FAQPage schema.org ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: [
              {
                "@type": "Question",
                name: "Est-ce vraiment sans carte bancaire pour l'essai ?",
                acceptedAnswer: { "@type": "Answer", text: "Oui, 14 jours d'essai complet sans aucune information de paiement. Vous entrez votre carte uniquement si vous décidez de continuer." },
              },
              {
                "@type": "Question",
                name: "En combien de temps mon site est-il en ligne ?",
                acceptedAnswer: { "@type": "Answer", text: "En moyenne 15 minutes. Notre wizard vous guide étape par étape : logo, couleurs, services, disponibilités. À la fin, vous cliquez 'Publier' et c'est en ligne." },
              },
              {
                "@type": "Question",
                name: "Dois-je avoir des connaissances techniques ?",
                acceptedAnswer: { "@type": "Answer", text: "Aucune. Klientys est conçu pour des non-techniciens : infirmières, artisans, kinés. Si vous savez utiliser WhatsApp, vous savez utiliser Klientys." },
              },
              {
                "@type": "Question",
                name: "Puis-je utiliser mon propre nom de domaine ?",
                acceptedAnswer: { "@type": "Answer", text: "Oui. Sur le plan Pro vous pouvez connecter votre domaine existant (ex. www.mon-cabinet.fr) ou en acheter un nouveau directement depuis Klientys." },
              },
              {
                "@type": "Question",
                name: "Que se passe-t-il si j'annule mon abonnement ?",
                acceptedAnswer: { "@type": "Answer", text: "Vous conservez l'accès jusqu'à la fin de la période payée. Aucun frais caché, aucune pénalité. Vos données sont exportables à tout moment." },
              },
              {
                "@type": "Question",
                name: "Les agents IA fonctionnent-ils vraiment 24h/24 ?",
                acceptedAnswer: { "@type": "Answer", text: "Oui. Une fois configurés, l'agent vitrine répond aux visiteurs de votre site et l'agent support répond sur Telegram et WhatsApp, même quand vous dormez." },
              },
            ],
          }),
        }}
      />

      {/* ── STICKY MOBILE CTA ── */}
      <div className="l-sticky-cta">
        <Link href="/onboarding" className="l-btn l-btn-primary" style={{ flex: 1, justifyContent: "center" }}>{t.lp_nav_start}</Link>
        <Link href="/login" className="l-btn l-btn-ghost" style={{ padding: "12px 20px" }}>{t.lp_nav_login}</Link>
      </div>

      <CookieBanner privacyUrl="/legal/privacy" />

    </div>
  );
}
