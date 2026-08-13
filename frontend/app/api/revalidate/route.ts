import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// Revalidation à la demande du fetch cache Next.js (voir `next: { revalidate: 3600 }`
// dans app/blog/[slug]/page.tsx et app/blog/page.tsx). Appelée par le backend dès
// qu'un article de blog est créé/publié/modifié/supprimé, pour ne pas attendre
// jusqu'à 1h avant qu'un article fraîchement publié soit visible.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-revalidate-secret");
  if (!secret || secret !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  }

  let body: { path?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  if (!body.path || typeof body.path !== "string" || !body.path.startsWith("/")) {
    return NextResponse.json({ error: "missing or invalid 'path'" }, { status: 400 });
  }

  revalidatePath(body.path);
  return NextResponse.json({ revalidated: true, path: body.path });
}
