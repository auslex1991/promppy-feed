import { NextRequest, NextResponse } from "next/server";
import { addReaction } from "@/lib/db";
import { REACTION_KINDS } from "@/lib/reactions";

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
