"use client";
import { useState, useEffect } from "react";

interface NavBarProps {
  logoOption: string;
  logoUrl: string;
  title: string;
  colors: { hero: string; accent: string };
  showServices: boolean;
  hasServices: boolean;
  showAbout: boolean;
  hasDescription: boolean;
  hasGallery?: boolean;
  isPreview: boolean;
}

export default function NavBar({
  logoOption, logoUrl, title, colors,
  showServices, hasServices, showAbout, hasDescription, hasGallery, isPreview,
}: NavBarProps) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);

  const links = [
    showServices && hasServices && { href: "#prestations", label: "Prestations" },
    showAbout && hasDescription && { href: "#a-propos", label: "À propos" },
    hasGallery && { href: "#galerie", label: "Galerie" },
    { href: "#contact", label: "Contact" },
  ].filter(Boolean) as { href: string; label: string }[];

  return (
    <>
      <nav
        className="fixed w-full z-40 transition-all duration-300"
        style={{
          top: isPreview ? "40px" : "0",
          background: scrolled ? `${colors.hero}f0` : "transparent",
          backdropFilter: scrolled ? "blur(18px)" : "none",
          boxShadow: scrolled ? "0 2px 24px rgba(0,0,0,.22)" : "none",
          padding: scrolled ? ".6rem 0" : "1rem 0",
        }}
      >
        <div className="max-w-5xl mx-auto px-6 h-14 flex">

          {/* Brand — gauche */}
          <a href="#" className="flex-1 flex items-center gap-2.5 min-w-0">
            {logoOption === "has_logo" && logoUrl && (
              <img src={logoUrl} alt={title} className="h-8 w-auto object-contain max-w-[90px] shrink-0" />
            )}
            <span className="font-bold text-[15px] leading-tight truncate text-white drop-shadow-sm">
              {title}
            </span>
          </a>

          {/* Links — centre (desktop) */}
          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-4 py-2 rounded-full text-sm font-medium transition-all text-white/70 hover:text-white hover:bg-white/10"
              >
                {l.label}
              </a>
            ))}
          </div>

          {/* Droite : CTA + hamburger */}
          <div className="flex-1 flex items-center justify-end gap-2.5">
            <a
              href="#rdv"
              className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-full transition-all hover:scale-105 shadow-lg"
              style={{ backgroundColor: colors.accent, color: "#fff" }}
            >
              Prendre rendez-vous
            </a>
            <a
              href="#rdv"
              className="sm:hidden text-sm font-semibold px-4 py-2 rounded-full"
              style={{ backgroundColor: colors.accent, color: "#fff" }}
            >
              RDV
            </a>

            {/* Hamburger */}
            <button
              className="md:hidden flex flex-col justify-center items-center w-9 h-9 gap-[5px] rounded-full transition-colors"
              style={{ background: "rgba(255,255,255,0.12)" }}
              onClick={() => setOpen(v => !v)}
              aria-label="Menu"
            >
              <span className="block w-4 h-[1.5px] rounded-full bg-white transition-all duration-200"
                style={{ transform: open ? "translateY(6.5px) rotate(45deg)" : "none" }} />
              <span className="block w-4 h-[1.5px] rounded-full bg-white transition-all duration-200"
                style={{ opacity: open ? 0 : 1 }} />
              <span className="block w-4 h-[1.5px] rounded-full bg-white transition-all duration-200"
                style={{ transform: open ? "translateY(-6.5px) rotate(-45deg)" : "none" }} />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile menu — plein écran */}
      {open && (
        <div
          className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-6 md:hidden"
          style={{ background: `${colors.hero}f8`, backdropFilter: "blur(20px)" }}
        >
          <button
            onClick={close}
            className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center text-white text-xl"
            style={{ background: "rgba(255,255,255,0.12)" }}
          >
            ×
          </button>
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={close}
              className="text-2xl font-semibold text-white/80 hover:text-white transition-colors"
              style={{ fontFamily: "'Cormorant Garamond', serif" }}
            >
              {l.label}
            </a>
          ))}
          <a
            href="#rdv"
            onClick={close}
            className="mt-4 text-base font-semibold px-8 py-3 rounded-full"
            style={{ backgroundColor: colors.accent, color: "#fff" }}
          >
            Prendre rendez-vous
          </a>
        </div>
      )}
    </>
  );
}
