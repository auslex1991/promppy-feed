import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, expectedToken, passwordValid } from "@/lib/adminAuth";

export async function POST(req: NextRequest) {
  let body: { password?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const pw = typeof body.password === "string" ? body.password : "";
  const token = expectedToken();
  if (!token) return NextResponse.json({ error: "관리자 비밀번호가 설정되지 않았습니다" }, { status: 503 });
  if (!passwordValid(pw)) return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 401 });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
