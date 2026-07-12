import { NextRequest, NextResponse } from "next/server";
import { getFeedBefore } from "@/lib/db";
import { getFeedPayload } from "@/lib/feedPayload";
import { SOURCE_NAMES } from "@/lib/sources";

const PAGE_SIZE = 50;

export async function GET(req: NextRequest) {
  // ?before=<ISO> → load-more: older items in reverse-chronological order.
  const before = req.nextUrl.searchParams.get("before");
  if (before) {
    const older = await getFeedBefore(before, PAGE_SIZE);
    const items = older.map((i) => ({ ...i, sourceName: SOURCE_NAMES[i.sourceId] ?? i.sourceId }));
    return NextResponse.json({ items, hasMore: older.length === PAGE_SIZE });
  }
  return NextResponse.json(await getFeedPayload(100));
}
