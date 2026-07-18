import type { MetadataRoute } from "next";
import { getFeedBefore, getTopicCounts } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

// 12h: the sitemap is for crawlers and tolerates staleness; keeps ISR writes low.
export const revalidate = 43200;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Recent published items (plain reverse-chronological, generous window).
  // Never throw: a DB outage here would fail the whole build (see app/page.tsx).
  let items: Awaited<ReturnType<typeof getFeedBefore>> = [];
  let topics: Awaited<ReturnType<typeof getTopicCounts>> = [];
  try {
    [items, topics] = await Promise.all([
      getFeedBefore(new Date().toISOString(), 500),
      getTopicCounts(3), // only topics with real content
    ]);
  } catch (e) {
    console.error("sitemap: item fetch failed, static URLs only:", e instanceof Error ? e.message : e);
  }
  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...topics.map((t) => ({
      url: `${SITE_URL}/topic/${t.topic}`,
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })),
    ...items.map((i) => ({
      url: `${SITE_URL}/item/${i.id}`,
      lastModified: new Date(i.publishedAt),
      priority: 0.6,
    })),
  ];
}
