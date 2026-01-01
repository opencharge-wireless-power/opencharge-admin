// src/lib/interactions/normalizeInteractionType.ts
export type CanonicalInteractionType =
  | "charge_started"
  | "issue_cleared"
  | "other";

export function normalizeInteractionType(raw: unknown): CanonicalInteractionType {
  const s = String(raw ?? "").trim().toLowerCase();

  // Filter out device modes / noise
  if (
    s.includes("not charging") ||
    s.includes("charging") && !s.includes("charge") ||
    s.includes("idle") ||
    s.includes("available") ||
    s.includes("offline") ||
    s.includes("online")
  ) {
    return "other";
  }

  if (s.includes("charge")) return "charge_started";
  if (s.includes("issue") && s.includes("clear")) return "issue_cleared";

  return "other";
}