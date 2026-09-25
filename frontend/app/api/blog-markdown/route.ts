import { NextRequest } from "next/server";
import TurndownService from "turndown";

export const revalidate = 3600;

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

// body_html est produit par l'admin/l'agent de contenu avec un jeu de balises
// volontairement restreint (h2/h3/p/strong/em/ul/li/a href — voir admin.py), donc
// les règles par défaut de Turndown suffisent, pas besoin du plugin GFM (tables).
const turndown = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  emDelimiter: "_",
});

function pathFor(lang: string, slug: string) {
  return lang === "fr" ? `/blog/${slug}` : `/blog/${lang}/${slug}`;
}

interface BlogPost {
  slug: string;
  title: string;
  description?: string;
  body_html?: string;
  published_at?: string;
  updated_at?: string;
}

// Miroir markdown d'un article, servi en /blog/{slug}.md (et /blog/{lang}/{slug}.md)
// via la réécriture dans proxy.ts — pour les agents IA qui préfèrent lire du texte
// brut plutôt que de parser la page HTML complète (convention llms.txt).
export async function GET(request: NextRequest) {
  // lang/slug arrivent via des headers posés par le rewrite dans proxy.ts (request.url
  // reflète l'URL publique d'origine ici, pas la cible du rewrite — voir proxy.ts).
  // Fallback sur les query params pour un appel direct de la route (tests, debug).
  const { searchParams } = new URL(request.url);
  const lang = request.headers.get("x-blog-lang") || searchParams.get("lang") || "fr";
  const slug = request.headers.get("x-blog-slug") || searchParams.get("slug") || "";

  if (!slug) {
    return new Response("Slug manquant", { status: 400 });
  }

  let post: BlogPost | null = null;
  try {
    const res = await fetch(
      `${API_URL}/api/v1/public/blog/${encodeURIComponent(slug)}?lang=${encodeURIComponent(lang)}`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) post = await res.json();
  } catch {
    // backend injoignable — traité comme "introuvable" ci-dessous
  }

  if (!post) {
    return new Response("Article introuvable.\n", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const bodyMarkdown = post.body_html ? turndown.turndown(post.body_html) : "";
  const canonicalUrl = `${APP_URL}${pathFor(lang, post.slug)}`;
  const publishedDate = post.published_at ? new Date(post.published_at).toISOString().slice(0, 10) : "";

  const metaLine = publishedDate
    ? `Klientys — publié le ${publishedDate} — version HTML : ${canonicalUrl}`
    : `Klientys — version HTML : ${canonicalUrl}`;

  const doc = `# ${post.title}

> ${post.description ?? ""}

${metaLine}

${bodyMarkdown}
`;

  return new Response(doc, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
