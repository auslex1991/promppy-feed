import Feed from "@/components/Feed";
import { getFeedPayload } from "@/lib/feedPayload";

// ISR: the feed is server-rendered into the HTML (SEO + fast first paint) and
// regenerated at most once a minute; the client keeps live-polling on top.
export const revalidate = 60;

export default async function Home() {
  const initialData = await getFeedPayload(100);
  return (
    <main>
      <Feed initialData={initialData} />
    </main>
  );
}
