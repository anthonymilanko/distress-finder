import type { DistressType, Lien } from "@/lib/types";

/**
 * Turns the visible text of a court-records results page (sent by the
 * TJ Record Reader extension) into Lien rows.
 *
 * With ANTHROPIC_API_KEY: Claude Haiku 5.5 extracts the fields.
 * Without a key: a regex fallback catches Wisconsin case numbers
 * (e.g. 2025CV001234, 2024TW000045) so the flow still works.
 *
 * Everything is saved as confidence "possible_match": a name search proves a
 * case exists for someone with that name, not that it's this owner.
 */

const CASE_TYPE_TO_KIND: Record<string, DistressType> = {
  CV: "judgment", // civil; class 30404 = foreclosure (see below)
  SC: "judgment",
  TJ: "judgment",
  FJ: "judgment",
  TW: "lien",
  CL: "lien",
  ML: "lien",
  CO: "lien",
  HL: "lien",
  OL: "lien",
  PR: "probate",
  IN: "probate",
  GN: "probate",
  FA: "divorce",
};

export interface ParsedCase {
  caseNumber: string;
  caseType?: string;
  status?: string;
  filedDate?: string;
  amount?: number;
  plaintiff?: string;
  county?: string;
  classification?: string;
}

export async function parseCourtPage(text: string, hint: { state: string; county?: string }): Promise<{ cases: ParsedCase[]; model: string }> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return { cases: regexFallback(text), model: "regex-fallback" };

  const model = process.env.DF_PARSE_MODEL ?? "claude-haiku-5-5";
  const prompt = `You extract court case rows from the visible text of a ${hint.state} court records search results page.
Return ONLY a JSON array. Each item: {"caseNumber": string, "caseType": string|null (two-letter type like CV, SC, TW, CL, ML, CO, HL, OL, TJ, FJ, PR), "status": string|null, "filedDate": "YYYY-MM-DD"|null, "amount": number|null, "plaintiff": string|null, "county": string|null, "classification": string|null (e.g. "30404 Foreclosure of Mortgage")}.
Only include cases actually listed. If none, return [].

PAGE TEXT:
${text.slice(0, 60_000)}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  if (!res.ok) throw new Error(`Claude API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { content: Array<{ type: string; text?: string }> };
  const out = data.content.find((c) => c.type === "text")?.text ?? "[]";
  const jsonText = out.slice(out.indexOf("["), out.lastIndexOf("]") + 1) || "[]";
  let cases: ParsedCase[] = [];
  try {
    cases = JSON.parse(jsonText) as ParsedCase[];
  } catch {
    cases = regexFallback(text);
  }
  return { cases, model };
}

function regexFallback(text: string): ParsedCase[] {
  const seen = new Set<string>();
  const out: ParsedCase[] = [];
  const re = /\b((?:19|20)\d{2})([A-Z]{2})(\d{6})\b/g;
  const matches = Array.from(text.matchAll(re));
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const caseNumber = `${m[1]}${m[2]}${m[3]}`;
    if (seen.has(caseNumber)) continue;
    seen.add(caseNumber);
    // Context = text between this case number and the next one (capped), so
    // one case's classification never bleeds onto its neighbor.
    const start = m.index ?? 0;
    const next = matches[i + 1]?.index ?? text.length;
    const ctx = text.slice(start, Math.min(next, start + 400));
    const status = /\b(Open|Closed|Dismissed|Judgment)\b/i.exec(ctx)?.[1];
    const date = /\b(\d{2})[-/](\d{2})[-/](\d{4})\b/.exec(ctx);
    out.push({
      caseNumber,
      caseType: m[2],
      status,
      filedDate: date ? `${date[3]}-${date[1]}-${date[2]}` : undefined,
      classification: /30404/.test(ctx) ? "30404 Foreclosure of Mortgage" : undefined,
    });
  }
  return out;
}

export function casesToLiens(cases: ParsedCase[], propertyId: string, meta: { source: string; state: string; county?: string; rawText?: string }): Lien[] {
  const today = new Date().toISOString().slice(0, 10);
  return cases.map((c) => {
    const type = (c.caseType ?? c.caseNumber.replace(/^\d{4}/, "").slice(0, 2)).toUpperCase();
    const isForeclosure = /30404|foreclos/i.test(c.classification ?? "");
    const kind: DistressType = isForeclosure ? "foreclosure" : CASE_TYPE_TO_KIND[type] ?? "other";
    return {
      id: crypto.randomUUID(),
      propertyId,
      kind,
      caseNumber: c.caseNumber,
      caseType: isForeclosure ? `${type} 30404` : type,
      status: c.status ?? undefined,
      filedDate: c.filedDate ?? undefined,
      amount: c.amount ?? undefined,
      plaintiff: c.plaintiff ?? undefined,
      county: c.county ?? meta.county,
      state: meta.state,
      source: meta.source,
      sourceDate: today,
      confidence: "possible_match",
      rawText: meta.rawText?.slice(0, 2000),
    };
  });
}
