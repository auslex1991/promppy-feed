// Inspect specific tweets by id: what are they, and would our filters pass them?
import { readFileSync } from "node:fs";
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)="?([^"]*)"?$/.exec(line.trim());
  if (m) process.env[m[1]] ??= m[2];
}

const ids = [
  "2076107957277008100",
  "2076690611399176506",
  "2076556282195329249",
  "2076561095733755955",
  "2076298361674911884",
  "2074134246784921977",
  "2074905017983607081",
];

const res = await fetch(
  `https://api.twitterapi.io/twitter/tweets?tweet_ids=${ids.join(",")}`,
  { headers: { "X-API-Key": process.env.TWITTERAPI_KEY! } }
);
const data = (await res.json()) as {
  tweets?: Array<{
    id: string;
    text?: string;
    likeCount?: number;
    retweetCount?: number;
    createdAt?: string;
    isReply?: boolean;
    author?: { userName?: string; followers?: number };
  }>;
};
for (const t of data.tweets ?? []) {
  console.log(
    `@${t.author?.userName} ♥${t.likeCount} RT${t.retweetCount} followers=${t.author?.followers} ${t.createdAt}`
  );
  console.log(`  ${(t.text ?? "").replace(/\s+/g, " ").slice(0, 260)}`);
  console.log("---");
}
