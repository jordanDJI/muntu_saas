// `next lint` a été retiré de Next.js 16 : ESLint s'exécute directement (flat config).
import nextVitals from "eslint-config-next/core-web-vitals";

const config = [
  ...nextVitals,
  {
    ignores: [".next/**", "node_modules/**", "public/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Apostrophes et guillemets des textes français dans le JSX : sans risque,
      // et des centaines d'occurrences.
      "react/no-unescaped-entities": "off",
      // Règles du compilateur React arrivées avec eslint-config-next 16. Le code
      // existant ne les respecte pas encore (≈ 70 cas, dette KLT-1925) : signalées
      // sans bloquer la CI. À repasser en "error" au fil des refactorings.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
];

export default config;
