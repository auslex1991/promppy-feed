import type { MetadataRoute } from "next";
import { getFeedBefore, getTopicCounts } from "@/lib/db";
import { SITE_URL } from "@/lib/site";
import { TOPIC_KEYWORDS } from "@/lib/topics";

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
  // Tag-populated topics + the curated keyword-populated model slugs (which
  // won't appear in the tag-count query but are real pages with demand).
  const topicSlugs = new Set<string>([...topics.map((t) => t.topic), ...Object.keys(TOPIC_KEYWORDS)]);

  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...[...topicSlugs].map((slug) => ({
      url: `${SITE_URL}/topic/${slug}`,
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
