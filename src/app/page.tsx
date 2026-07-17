import Feed from "@/components/Feed";
import { getFeedPayload } from "@/lib/feedPayload";

// ISR: the feed is server-rendered into the HTML (SEO + fast first paint) and
// regenerated at most once a minute; the client keeps live-polling on top.
export const revalidate = 60;

export default async function Home() {
  // A DB outage must not fail the BUILD. Prerender crashes on any throw here,
  // which once made the site un-deployable exactly when a deploy was the fix
  // (Neon egress quota exhausted → every query threw → build died). Degrade to
  // an empty payload instead; the client picks the feed up from /api/feed.
  let initialData;
  try {
    initialData = await getFeedPayload(100);
  } catch (e) {
    console.error("home: feed payload failed, rendering empty:", e instanceof Error ? e.message : e);
    initialData = { items: [], lastCrawlAt: null, serverNow: new Date().toISOString(), briefing: null };
  }
  return (
    <main>
      <Feed initialData={initialData} />
    </main>
  );
}
