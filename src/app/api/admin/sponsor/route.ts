import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, tokenValid } from "@/lib/adminAuth";
import { setSponsor, clearSponsor, getActiveSponsor } from "@/lib/db";

function authed(req: NextRequest): boolean {
  return tokenValid(req.cookies.get(ADMIN_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ sponsor: await getActiveSponsor() });
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let body: { brand?: unknown; title?: unknown; body?: unknown; url?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const brand = typeof body.brand === "string" ? body.brand.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const url = typeof body.url === "string" ? body.url.trim() : "";
  if (!brand || !title || !url) {
    return NextResponse.json({ error: "brand, title, url은 필수입니다" }, { status: 400 });
  }
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: "url은 http(s)로 시작해야 합니다" }, { status: 400 });
  }
  await setSponsor({ brand, title, body: text, url });
  return NextResponse.json({ ok: true, sponsor: await getActiveSponsor() });
}

export async function DELETE(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await clearSponsor();
  return NextResponse.json({ ok: true });
}
