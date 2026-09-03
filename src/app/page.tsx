import Feed from "@/components/Feed";
import { getFeedPayload } from "@/lib/feedPayload";
import { getTopicCounts } from "@/lib/db";
import { TOPIC_KEYWORDS, topicLabel } from "@/lib/topics";

// ISR: the feed is server-rendered into the HTML (SEO + fast first paint); the
// client hydrates and live-polls /api/feed (60s CDN cache) on top, so the SSR
// snapshot only needs to be fresh-ish for first paint and crawlers. 10min keeps
// ISR writes (a metered free-tier resource) low while the client stays live.
export const revalidate = 600;

export default async function Home() {
  // A DB outage must not fail the BUILD. Prerender crashes on any throw here,
  // which once made the site un-deployable exactly when a deploy was the fix
  // (Neon egress quota exhausted → every query threw → build died). Degrade to
  // an empty payload instead; the client picks the feed up from /api/feed.
  let initialData;
  let topics: Array<{ slug: string; label: string }> = [];
  try {
    const [payload, counts] = await Promise.all([getFeedPayload(100), getTopicCounts(5)]);
    initialData = payload;
    // Top topics by volume become the homepage browse row — exposes the
    // accumulated topic archive that was only reachable via item-page chips.
    topics = counts.slice(0, 12).map((c) => ({ slug: c.topic, label: topicLabel(c.topic) }));
    // Keyword-populated hubs (local-llm, emergent models) won't rank in the
    // tag-count query yet, but they are real pages with search demand and
    // need an internal link for crawlers — the sitemap already includes them.
    for (const slug of Object.keys(TOPIC_KEYWORDS)) {
      if (!topics.some((t) => t.slug === slug)) topics.push({ slug, label: topicLabel(slug) });
    }
  } catch (e) {
    console.error("home: feed payload failed, rendering empty:", e instanceof Error ? e.message : e);
    initialData = { items: [], lastCrawlAt: null, serverNow: new Date().toISOString(), briefing: null };
  }
  return (
    <main>
      <Feed initialData={initialData} topics={topics} />
    </main>
  );
}
