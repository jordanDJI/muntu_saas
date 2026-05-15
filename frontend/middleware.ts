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

export async function middleware(request: NextRequest) {
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
  const hasSession = [...request.cookies.getAll()].some(
    (c) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
  );

  if (!hasSession && pathname.startsWith("/dashboard")) {
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
