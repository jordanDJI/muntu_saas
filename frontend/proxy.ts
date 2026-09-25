import { NextResponse, type NextRequest } from "next/server";

const MAIN_DOMAINS = [
  process.env.NEXT_PUBLIC_MAIN_DOMAIN || "klientys.co",
  "klientys.co",
  "www.klientys.co",
  "muntu-saas.vercel.app",
];

function isMainDomain(hostname: string): boolean {
  if (MAIN_DOMAINS.includes(hostname)) return true;
  if (hostname === "localhost" || hostname.startsWith("localhost:")) return true;
  if (hostname.endsWith(".vercel.app")) return true;
  if (hostname.endsWith(".localhost")) return true;
  const main = process.env.NEXT_PUBLIC_MAIN_DOMAIN || "klientys.co";
  if (hostname === main || hostname.endsWith(`.${main}`)) return true;
  return false;
}

export default async function proxy(request: NextRequest) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0];

  // Domaine custom — résoudre vers le slug tenant
  if (!isMainDomain(hostname)) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    try {
      const res = await fetch(
        `${apiUrl}/api/v1/domains/resolve?domain=${encodeURIComponent(hostname)}`
      );
      if (res.ok) {
        const { slug } = (await res.json()) as { slug: string };
        const url = request.nextUrl.clone();
        const originalPath = url.pathname;
        url.pathname = `/${slug}${originalPath === "/" ? "" : originalPath}`;
        return NextResponse.rewrite(url);
      }
    } catch {
      // Backend inaccessible — laisse passer
    }
    return NextResponse.next();
  }

  // Domaine principal — protection des routes auth
  const { pathname } = request.nextUrl;

  // Miroir markdown des articles de blog (/blog/{slug}.md, /blog/{lang}/{slug}.md)
  // pour les agents IA — réécriture transparente vers la route interne, l'URL
  // publique reste en .md (voir app/api/blog-markdown/route.ts)
  const mdMatch = pathname.match(/^\/blog\/(?:(en|de|nl)\/)?([a-z0-9-]+)\.md$/);
  if (mdMatch) {
    const [, lang, slug] = mdMatch;
    // request.url reste l'URL publique d'origine côté route handler après une réécriture
    // (le query string ajouté ici n'est pas visible via new URL(request.url) côté destination)
    // — on passe donc lang/slug par des headers, seul canal fiable entre middleware et handler.
    const target = new URL("/api/blog-markdown", request.url);
    const headers = new Headers(request.headers);
    headers.set("x-blog-lang", lang ?? "fr");
    headers.set("x-blog-slug", slug);
    return NextResponse.rewrite(target, { request: { headers } });
  }

  const hasSession = [...request.cookies.getAll()].some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );

  if (!hasSession && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
