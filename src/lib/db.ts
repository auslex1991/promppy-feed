import * as postgres from "./db-postgres";
import * as sqlite from "./db-sqlite";

// Backend selection: Postgres in production (DATABASE_URL set — Vercel +
// Neon/Supabase), SQLite for zero-config local dev. Both expose the same
// async interface; everything outside this module is backend-agnostic.
const impl = process.env.DATABASE_URL ? postgres : sqlite;

export const insertNewItems = impl.insertNewItems;
export const getUnclassified = impl.getUnclassified;
export const getRecentPublished = impl.getRecentPublished;
export const applyClassification = impl.applyClassification;
export const getFeed = impl.getFeed;
export const getFeedBefore = impl.getFeedBefore;
export const getItem = impl.getItem;
export const getDupCoverage = impl.getDupCoverage;
export const getLatestPublished = impl.getLatestPublished;
export const addFeedback = impl.addFeedback;
export const getBriefing = impl.getBriefing;
export const saveBriefing = impl.saveBriefing;
export const getTopForBriefing = impl.getTopForBriefing;
export const startRun = impl.startRun;
export const finishRun = impl.finishRun;
export const lastSuccessfulRun = impl.lastSuccessfulRun;

export { canonicalUrl } from "./db-shared";
