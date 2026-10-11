import type { ImageFlag, Property, ScoreInput, ScoreResult } from "@/lib/types";
import { IMAGE_FLAG_POINTS } from "@/lib/types";
import { getRepo } from "@/lib/db";

/**
 * Scoring module (Section 4 of the blueprint).
 *
 * - `Scorer` is the plug-in point. Phase 1 ships `NoopScorer` (records-only).
 *   Phase 2 adds a Claude Haiku 5.5 vision scorer; above a threshold a
 *   Sonnet 5.5 second read. Both must implement `Scorer`.
 * - `scoreProperty()` enforces: cache keyed on parcel + image date, and a
 *   DAILY SPEND CAP (env DF_DAILY_AI_CAP_USD, default $5) with a
 *   scanned-today counter. If the cap is hit, scoring returns the cached or
 *   records-only result and sets `capReached` — it never silently spends.
 * - Google imagery is never accepted here (URL check), per Maps terms.
 */

export interface ImageRead {
  flags: ImageFlag[];
  model: string;
  costUsd: number;
}

export interface Scorer {
  readonly name: string;
  readImage(input: ScoreInput): Promise<ImageRead>;
}

export class NoopScorer implements Scorer {
  readonly name = "noop";
  async readImage(): Promise<ImageRead> {
    return { flags: [], model: "none", costUsd: 0 };
  }
}

// ---- Records points (max 50) ----
export function recordsPoints(p: Property): number {
  let pts = 0;
  if (p.distressTypes.includes("foreclosure")) pts += 20;
  else if (p.distressTypes.includes("pre_foreclosure")) pts += 15;
  if (p.distressTypes.includes("tax_delinquent")) pts += 12;
  if (p.distressTypes.includes("lien") || p.distressTypes.includes("judgment")) pts += 8;
  if (p.distressTypes.includes("vacant")) pts += 8;
  if (p.distressTypes.includes("probate")) pts += 8;
  if (p.distressTypes.includes("code_violation")) pts += 6;
  if (p.absentee) pts += 6;
  if ((p.yearsOwned ?? 0) >= 15) pts += 5;
  if ((p.estEquityPct ?? 0) >= 50) pts += 6;
  return Math.min(50, pts);
}

export function imagePointsFromFlags(flags: ImageFlag[]): number {
  return Math.min(85, flags.reduce((s, f) => s + (IMAGE_FLAG_POINTS[f] ?? 0), 0));
}

export function combine(imagePts: number, recPts: number): number {
  // Image 0-85 scaled to 0-50, records 0-50.
  return Math.round((imagePts / 85) * 50 + recPts);
}

export const DAILY_CAP_USD = Number(process.env.DF_DAILY_AI_CAP_USD ?? "5");
export const today = () => new Date().toISOString().slice(0, 10);

const GOOGLE_HOSTS = /(^|\.)(google|googleapis|gstatic|googleusercontent)\.com$/i;
export function isGoogleImagery(url?: string): boolean {
  if (!url) return false;
  try {
    return GOOGLE_HOSTS.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

export interface ScoreOutcome {
  result: ScoreResult;
  capReached: boolean;
  spend: { day: string; scans: number; costUsd: number; capUsd: number };
}

let activeScorer: Scorer = new NoopScorer();
export function setScorer(s: Scorer) {
  activeScorer = s;
}

export async function scoreProperty(p: Property, input: ScoreInput = { propertyId: p.id }): Promise<ScoreOutcome> {
  const repo = getRepo();
  const day = today();
  const recPts = recordsPoints(p);

  if (isGoogleImagery(input.imageUrl) || isGoogleImagery(input.priorImageUrl)) {
    throw new Error("Google imagery cannot be sent to the scorer (Maps terms). Use Nearmap, Mapillary or your own photos.");
  }

  const cacheKey = `${p.parcel ?? p.dedupeKey}|${input.imageDate ?? "noimg"}|${activeScorer.name}`;
  const cached = await repo.getScore(cacheKey);
  const spendNow = await repo.getSpend(day);
  if (cached) {
    return { result: { ...cached, cached: true }, capReached: spendNow.costUsd >= DAILY_CAP_USD, spend: { ...spendNow, capUsd: DAILY_CAP_USD } };
  }

  const capReached = spendNow.costUsd >= DAILY_CAP_USD;
  let read: ImageRead = { flags: [], model: "none", costUsd: 0 };
  if (input.imageUrl && !capReached) {
    read = await activeScorer.readImage(input);
  }
  const imgPts = imagePointsFromFlags(read.flags);
  const result: ScoreResult = {
    propertyId: p.id,
    imageFlags: read.flags,
    imagePoints: imgPts,
    recordsPoints: recPts,
    distressScore: combine(imgPts, recPts),
    needsReview: read.flags.includes("unclear_image"),
    model: read.model,
    costUsd: read.costUsd,
    cached: false,
    scoredAt: new Date().toISOString(),
  };
  const spend = read.costUsd > 0 || input.imageUrl ? await repo.addSpend(day, input.imageUrl && !capReached ? 1 : 0, read.costUsd) : spendNow;
  await repo.putScore(cacheKey, result);
  return { result, capReached: capReached || spend.costUsd >= DAILY_CAP_USD, spend: { ...spend, capUsd: DAILY_CAP_USD } };
}
