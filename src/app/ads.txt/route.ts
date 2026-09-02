/**
 * ads.txt — declares which networks may sell this site's inventory.
 *
 * Without it Google treats the inventory as coming from an unauthorized
 * seller and withholds a large share of the revenue, so this must be live
 * before (or as) the first ad serves. Generated from the publisher id rather
 * than committed as a static file so there is exactly one place to set it.
 */
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  // Nothing to declare until AdSense is approved; a 404 is correct then.
  if (!client) return new Response("Not found", { status: 404 });

  // Publisher ids are handed out as "ca-pub-…" but ads.txt wants "pub-…".
  const publisherId = client.replace(/^ca-/, "");
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
