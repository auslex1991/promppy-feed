import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, tokenValid } from "@/lib/adminAuth";
import { addXAccount, removeXAccount, getXAccounts } from "@/lib/db";

function authed(req: NextRequest): boolean {
  return tokenValid(req.cookies.get(ADMIN_COOKIE)?.value);
}

/** Extract a clean X handle from a raw input (handle, @handle, or a URL). */
function parseHandle(raw: string): string | null {
  const m = /(?:x\.com\/|twitter\.com\/|@)?([A-Za-z0-9_]{1,15})\/?$/.exec(raw.trim());
  const h = m?.[1]?.toLowerCase();
  return h && /^[a-z0-9_]{1,15}$/.test(h) ? h : null;
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ accounts: await getXAccounts() });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { handle?: unknown; kind?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const handle = parseHandle(typeof body.handle === "string" ? body.handle : "");
  const kind = body.kind === "org" ? "org" : body.kind === "people" ? "people" : null;
  if (!handle) return NextResponse.json({ error: "유효한 X 핸들이 아닙니다" }, { status: 400 });
  if (!kind) return NextResponse.json({ error: "kind must be org or people" }, { status: 400 });
  await addXAccount(handle, kind);
  return NextResponse.json({ ok: true, handle, kind });
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { handle?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const handle = typeof body.handle === "string" ? body.handle.toLowerCase() : "";
  if (!handle) return NextResponse.json({ error: "no handle" }, { status: 400 });
  await removeXAccount(handle);
  return NextResponse.json({ ok: true });
}
