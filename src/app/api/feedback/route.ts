import { NextRequest, NextResponse } from "next/server";
import { addFeedback, getItem } from "@/lib/db";

export async function POST(req: NextRequest) {
  let itemId: unknown;
  try {
    ({ itemId } = await req.json());
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const id = Number(itemId);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "bad itemId" }, { status: 400 });
  }
  // Only accept reports against real published items (cheap abuse guard).
  if (!(await getItem(id))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  await addFeedback(id);
  return NextResponse.json({ ok: true });
}
