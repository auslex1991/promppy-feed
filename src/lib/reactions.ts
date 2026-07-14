/** Reaction vocabulary — shared by the API route and the UI. */
export const REACTION_KINDS = ["useful", "fire", "hmm"] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];

export const REACTION_LABEL: Record<ReactionKind, { emoji: string; label: string }> = {
  useful: { emoji: "👍", label: "유용해요" },
  fire: { emoji: "🔥", label: "중요하네요" },
  hmm: { emoji: "🤔", label: "글쎄요" },
};
