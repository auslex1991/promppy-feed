import type { MetadataRoute } from "next";
import { getFeedBefore } from "@/lib/db";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Recent published items (plain reverse-chronological, generous window).
  const items = await getFeedBefore(new Date().toISOString(), 500);
  return [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    ...items.map((i) => ({
      url: `${SITE_URL}/item/${i.id}`,
      lastModified: new Date(i.publishedAt),
      priority: 0.6,
    })),
  ];
}
