"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

export default function MarketingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* Mobile menu */}
      <div className={`l-mobile-menu${mobileOpen ? " open" : ""}`}>
        <button className="l-mobile-menu-close" onClick={() => setMobileOpen(false)} aria-label="Fermer">×</button>
        <Link href="/#features" onClick={() => setMobileOpen(false)}>Fonctionnalités</Link>
        <Link href="/#pricing" onClick={() => setMobileOpen(false)}>Tarifs</Link>
        <Link href="/blog" onClick={() => setMobileOpen(false)}>Blog</Link>
        <Link href="/annuaire" onClick={() => setMobileOpen(false)}>Annuaire</Link>
        <div className="l-mobile-menu-cta">
          <Link href="/onboarding" className="l-btn l-btn-primary" style={{ justifyContent: "center" }} onClick={() => setMobileOpen(false)}>
            Essayer gratuitement
          </Link>
          <Link href="/login" className="l-btn l-btn-ghost" style={{ justifyContent: "center" }} onClick={() => setMobileOpen(false)}>
            Se connecter
          </Link>
        </div>
      </div>

      {/* Nav */}
      <nav className={`l-nav${scrolled ? " scrolled" : ""}`} style={!scrolled ? { background: "rgba(4,14,21,.92)", backdropFilter: "blur(20px)", borderBottomColor: "var(--l-border)" } : undefined}>
        <div className="l-nav-inner">
          <Link href="/" className="l-nav-logo">
            <img src="/logo.png" alt="Klientys" style={{ height: "30px", width: "auto" }} />
            Klientys
          </Link>
          <ul className="l-nav-links">
            <li><Link href="/#features">Fonctionnalités</Link></li>
            <li><Link href="/#pricing">Tarifs</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/site-internet-pour">Par métier</Link></li>
          </ul>
          <div className="l-nav-cta">
            <Link href="/login" className="l-btn l-btn-ghost" style={{ padding: "9px 20px", fontSize: "14px" }}>
              Se connecter
            </Link>
            <Link href="/onboarding" className="l-btn l-btn-primary" style={{ padding: "9px 20px", fontSize: "14px" }}>
              Essai gratuit
            </Link>
            <button
              className="l-nav-hamburger"
              onClick={() => setMobileOpen(true)}
              aria-label="Menu"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}