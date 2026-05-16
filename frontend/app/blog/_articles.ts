export interface Article {
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  readingMinutes: number;
  category: string;
  metier?: string;
}

export const ARTICLES: Article[] = [
  {
    slug: "doctolib-vs-klientys-kine-infirmier",
    title: "Doctolib vs Klientys : ce que les kinés et infirmiers ne savent pas",
    description: "Doctolib coûte 160 €/mois et vous rend invisible en dehors de votre ville principale. Voici pourquoi de plus en plus de libéraux font le switch.",
    publishedAt: "2025-05-16",
    readingMinutes: 6,
    category: "Comparatifs",
    metier: "Santé",
  },
  {
    slug: "cout-site-internet-independant-2025",
    title: "Combien coûte vraiment un site internet pour indépendant en 2025 ?",
    description: "Wix, Squarespace, site sur mesure, tout-en-un : comparaison honnête des coûts réels. Avec le calcul que personne ne fait.",
    publishedAt: "2025-05-16",
    readingMinutes: 7,
    category: "Prix & ROI",
  },
  {
    slug: "remplir-agenda-en-ligne-sans-plateforme",
    title: "Comment remplir son agenda en ligne sans Habitatpresto ni Superprof",
    description: "Ces plateformes prennent 15 à 20 % sur chaque mission. Voici comment attirer des clients directement via Google — et garder 100 % de vos revenus.",
    publishedAt: "2025-05-16",
    readingMinutes: 8,
    category: "Acquisition clients",
    metier: "Artisans & services",
  },
];