import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleLayout from "../../../components/ArticleLayout";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

// fr = /blog/{slug} (défaut, pas de préfixe) ; en/de/nl = /blog/{lang}/{slug}.
// Route catch-all car app/[tenant]/page.tsx existe déjà à la racine (Next.js interdit
// deux noms de segment dynamique différents au même niveau) — voir docs/seo/editorial-cocons-plan.md.
const TRANSLATABLE_LANGS = ["en", "de", "nl"] as const;
type Lang = "fr" | "en" | "de" | "nl";

function parseSlugParts(parts: string[]): { lang: Lang; slug: string } | null {
  if (parts.length === 1) {
    const [first] = parts;
    if ((TRANSLATABLE_LANGS as readonly string[]).includes(first)) {
      // /blog/en, /blog/de, /blog/nl — page de listing par langue, pas gérée par cette route
      return null;
    }
    return { lang: "fr", slug: first };
  }
  if (parts.length === 2) {
    const [maybeLang, slug] = parts;
    if ((TRANSLATABLE_LANGS as readonly string[]).includes(maybeLang)) {
      return { lang: maybeLang as Lang, slug };
    }
  }
  return null;
}

function pathFor(lang: string, slug: string) {
  return lang === "fr" ? `/blog/${slug}` : `/blog/${lang}/${slug}`;
}

async function getPost(slug: string, lang: Lang) {
  try {
    const res = await fetch(`${API}/api/v1/public/blog/${slug}?lang=${lang}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getTranslations(slug: string, lang: Lang): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${API}/api/v1/public/blog/${slug}/translations?lang=${lang}`, { next: { revalidate: 3600 } });
    if (!res.ok) return {};
    return res.json();
  } catch {
    return {};
  }
}

export async function generateMetadata({ params }: { params: { slug: string[] } }): Promise<Metadata> {
  const parsed = parseSlugParts(params.slug ?? []);
  if (!parsed) return { title: "Article introuvable | Klientys" };
  const { lang, slug } = parsed;

  const post = await getPost(slug, lang);
  if (!post) return { title: "Article introuvable | Klientys" };

  const translations = await getTranslations(slug, lang);
  const languages: Record<string, string> = {};
  for (const [l, s] of Object.entries(translations)) {
    languages[l] = `${APP_URL}${pathFor(l, s)}`;
  }

  const ogImage = `${APP_URL}/api/og?title=${encodeURIComponent(post.title)}&color=indigo`;
  return {
    title: `${post.title} | Klientys`,
    description: post.description,
    alternates: {
      canonical: `${APP_URL}${pathFor(lang, post.slug)}`,
      languages: Object.keys(languages).length > 0 ? languages : undefined,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${APP_URL}${pathFor(lang, post.slug)}`,
      type: "article",
      siteName: "Klientys",
      locale: lang,
      images: [{ url: ogImage, width: 1200, height: 630 }],
      publishedTime: post.published_at,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [ogImage] },
  };
}

export default async function DynamicArticle({ params }: { params: { slug: string[] } }) {
  const parsed = parseSlugParts(params.slug ?? []);
  if (!parsed) notFound();
  const { lang, slug } = parsed;

  const post = await getPost(slug, lang);
  if (!post) notFound();

  const canonicalPath = pathFor(lang, post.slug);

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Article",
      headline: post.title, description: post.description,
      inLanguage: lang,
      datePublished: post.published_at, dateModified: post.updated_at ?? post.published_at,
      author: { "@type": "Organization", name: "Klientys", url: APP_URL },
      publisher: { "@type": "Organization", name: "Klientys", url: APP_URL, logo: { "@type": "ImageObject", url: `${APP_URL}/logo.png` } },
      mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}${canonicalPath}` },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${APP_URL}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: `${APP_URL}${canonicalPath}` },
      ],
    },
  ];

  return (
    <>
      {jsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} />
      ))}
      <ArticleLayout
        breadcrumbLabel={post.title}
        category={post.category ?? "Article"}
        readingMinutes={post.reading_minutes ?? 5}
        publishedAt={post.published_at ?? ""}
        title={post.title}
        description={post.description ?? ""}
        relatedLinks={[{ href: "/blog", label: "← Retour au blog" }]}
      >
        {post.body_html ? (
          <div dangerouslySetInnerHTML={{ __html: post.body_html }} />
        ) : (
          <p style={{ color: "var(--l-text-3)" }}>Contenu en cours de rédaction…</p>
        )}
      </ArticleLayout>
    </>
  );
}
