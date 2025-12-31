// src/utils/UnitFields.ts
import type { DocumentData } from "firebase/firestore";

/**
 * Units position is sometimes stored in different places depending on firmware / ingestion.
 * Normalize it in one place so UI never shows "—" incorrectly.
 */
export function resolveUnitPosition(data: DocumentData): string | undefined {
  const metrics = (data.metrics as DocumentData | undefined) ?? {};

  const raw =
    (metrics.position as string | undefined) ??
    (data.position as string | undefined) ??
    (metrics?.location?.position as string | undefined) ??
    (data.location?.position as string | undefined);

  if (!raw) return undefined;

  const trimmed = raw.toString().trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
