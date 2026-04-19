import { NextResponse, type NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cherche le cookie de session Supabase (sb-<ref>-auth-token)
  const hasSession = [...request.cookies.getAll()].some(
    (c) => c.name.startsWith("sb-") && c.name.endsWith("-auth-token")
  );

  if (!hasSession && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (hasSession && (pathname === "/login" || pathname === "/onboarding")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/onboarding"],
};
