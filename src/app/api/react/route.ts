import { NextRequest, NextResponse } from "next/server";
import { addReaction, getReactionsFor } from "@/lib/db";
import { REACTION_KINDS } from "@/lib/reactions";

// Live reaction counts for one item. Item PAGES are ISR-cached for 6h, which
// froze their server-rendered counts (often at 0, cached before any reaction);
// the client fetches this on mount to show fresh numbers. Short CDN cache so
// concurrent viewers share one DB read instead of each hitting Neon.
export async function GET(req: NextRequest) {
  const itemId = Number(req.nextUrl.searchParams.get("itemId"));
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "bad itemId" }, { status: 400 });
  }
  const map = await getReactionsFor([itemId]);
  return NextResponse.json(
    { reactions: map.get(itemId) ?? {} },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } }
  );
}

export async function POST(req: NextRequest) {
  let body: { itemId?: unknown; kind?: unknown; delta?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const itemId = Number(body.itemId);
  const kind = String(body.kind);
  const delta = body.delta === -1 ? -1 : 1;
  if (!Number.isInteger(itemId) || itemId <= 0 || !(REACTION_KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  await addReaction(itemId, kind, delta);
  return NextResponse.json({ ok: true });
}
