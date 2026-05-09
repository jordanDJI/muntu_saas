/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx,js,jsx}",
    "./components/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ── Primary — Teal #0D4B58 (boucle gauche logo) ──────────────────
        primary: {
          50:  "#EBF5F7",
          100: "#C6E5EA",
          200: "#8EC8D3",
          300: "#56B5C5",
          400: "#2E94A8",
          500: "#1A7A8F",
          600: "#0D4B58",
          700: "#093843",
          800: "#062830",
          900: "#07222F",
        },

        // ── Secondary — Periwinkle #AABDD8 (boucle droite logo) ──────────
        // Ne jamais utiliser en texte sur fond blanc (contraste 1.9:1)
        secondary: {
          50:  "#EEF3FA",
          100: "#DDE8F4",
          400: "#AABDD8",
          600: "#4E7EA8",
          700: "#3A6089",
        },

        // ── Accent — Gold #DDAA40 (bordure intérieure logo) ───────────────
        // Toujours en fond avec texte #07222F. Jamais en texte sur blanc.
        accent: {
          50:  "#FDF6E3",
          100: "#F9ECC6",
          400: "#DDAA40",
          600: "#A67B20",
          700: "#7A5218",
        },

        // ── Sage — Vert sauge #6B8A7A (rectangle central logo) ───────────
        sage: {
          50:  "#EBF3EE",
          100: "#D4E4DC",
          400: "#6B8A7A",
          600: "#4A6757",
          700: "#354C3E",
        },

        // ── Neutrals sémantiques ──────────────────────────────────────────
        neutral: {
          "bg-page":    "#F4F8FA",
          "bg-card":    "#FFFFFF",
          "bg-sidebar": "#07222F",
          "border-subtle":  "#E2EAF0",
          "border-default": "#B8C5D1",
          "border-strong":  "#7A9BB0",
          "text-heading":   "#07222F",
          "text-body":      "#1E3A47",
          "text-muted":     "#5C7A8A",
          "text-disabled":  "#A5B8C2",
        },

        // ── Couleurs fonctionnelles (dérivées de la palette) ─────────────
        // Success : vert distinct du sage
        "brand-success": {
          100: "#C6EDD9",
          600: "#1D7A4A",
        },
        // Warning : dérivé gold, plus chaud
        "brand-warning": {
          100: "#FCE9BF",
          600: "#C47F1A",
        },
        // Danger
        "brand-danger": {
          100: "#FDD9D9",
          600: "#BF3333",
        },
      },
    },
  },
  plugins: [],
};
