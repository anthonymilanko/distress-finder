import { getRepo } from "@/lib/db";
import type { Lien } from "@/lib/types";

/** Save BatchData-derived lien rows, replacing earlier BatchData rows for the same property (so a refresh never duplicates). */
export async function saveLookupLiens(propertyId: string, liens: Lien[]): Promise<number> {
  if (!liens.length) return 0;
  const repo = getRepo();
  const existing = await repo.listLiens(propertyId);
  const have = new Set(existing.map((l) => l.caseNumber));
  const fresh = liens.filter((l) => !have.has(l.caseNumber)).map((l) => ({ ...l, propertyId }));
  if (fresh.length) await repo.addLiens(fresh);
  return fresh.length;
}
