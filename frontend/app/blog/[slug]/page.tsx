import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleLayout from "../../../components/ArticleLayout";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://klientys.co";

async function getPost(slug: string) {
  try {
    const res = await fetch(`${API}/api/v1/public/blog/${slug}`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug);
  if (!post) return { title: "Article introuvable | Klientys" };
  const ogImage = `${APP_URL}/api/og?title=${encodeURIComponent(post.title)}&color=indigo`;
  return {
    title: `${post.title} | Klientys`,
    description: post.description,
    alternates: { canonical: `${APP_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `${APP_URL}/blog/${post.slug}`,
      type: "article",
      siteName: "Klientys",
      images: [{ url: ogImage, width: 1200, height: 630 }],
      publishedTime: post.published_at,
    },
    twitter: { card: "summary_large_image", title: post.title, description: post.description, images: [ogImage] },
  };
}

export default async function DynamicArticle({ params }: { params: { slug: string } }) {
  const post = await getPost(params.slug);
  if (!post) notFound();

  const jsonLd = [
    {
      "@context": "https://schema.org", "@type": "Article",
      headline: post.title, description: post.description,
      datePublished: post.published_at, dateModified: post.updated_at ?? post.published_at,
      author: { "@type": "Organization", name: "Klientys", url: APP_URL },
      publisher: { "@type": "Organization", name: "Klientys", url: APP_URL, logo: { "@type": "ImageObject", url: `${APP_URL}/logo.png` } },
      mainEntityOfPage: { "@type": "WebPage", "@id": `${APP_URL}/blog/${post.slug}` },
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: APP_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${APP_URL}/blog` },
        { "@type": "ListItem", position: 3, name: post.title, item: `${APP_URL}/blog/${post.slug}` },
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
