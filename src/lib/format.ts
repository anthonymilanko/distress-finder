import type { DistressType, LeadStatus } from "@/lib/types";

export const money = (n?: number | null) =>
  n == null || Number.isNaN(n) ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export const num = (n?: number | null) => (n == null || Number.isNaN(n) ? "—" : n.toLocaleString("en-US"));

export const pct = (n?: number | null) => (n == null || Number.isNaN(n) ? "—" : `${Math.round(n)}%`);

export const DISTRESS_LABEL: Record<DistressType, string> = {
  pre_foreclosure: "Pre-foreclosure",
  foreclosure: "Foreclosure",
  tax_delinquent: "Tax delinquent",
  lien: "Lien",
  judgment: "Judgment",
  probate: "Probate / inherited",
  vacant: "Vacant",
  code_violation: "Code violation",
  tired_landlord: "Tired landlord",
  divorce: "Divorce / family case",
  expired_listing: "Expired listing",
  other: "Other",
};

export const LEAD_LABEL: Record<LeadStatus, string> = { new: "New", lead: "Lead", skip: "Skip", watch: "Watch" };

export const DISTRESS_TYPES = Object.keys(DISTRESS_LABEL) as DistressType[];

export function scoreTone(score?: number): "hot" | "warm" | "cool" | "none" {
  if (score == null) return "none";
  if (score >= 60) return "hot";
  if (score >= 35) return "warm";
  return "cool";
}

/** Wisconsin circuit court case-type codes → plain English. Code is the 2 letters in the case number. */
export const WI_CASE_TYPE: Record<string, { label: string; signal: "direct" | "indirect" | "motivation" | "none" }> = {
  CV: { label: "Civil (large claims)", signal: "indirect" },
  SC: { label: "Small claims", signal: "indirect" },
  TJ: { label: "Transcript of judgment (lien)", signal: "indirect" },
  FJ: { label: "Foreign judgment (out-of-state)", signal: "indirect" },
  TW: { label: "Tax warrant (state DOR lien)", signal: "direct" },
  CL: { label: "Construction lien", signal: "direct" },
  ML: { label: "Mechanic's lien", signal: "direct" },
  CO: { label: "Condominium lien", signal: "direct" },
  HL: { label: "Hospital lien", signal: "direct" },
  OL: { label: "Other lien (HOA / § 779.70)", signal: "direct" },
  FA: { label: "Family (divorce / support)", signal: "motivation" },
  PA: { label: "Paternity", signal: "none" },
  PR: { label: "Probate / estate", signal: "motivation" },
  IN: { label: "Informal probate", signal: "motivation" },
  GN: { label: "Guardianship", signal: "motivation" },
  ME: { label: "Mental commitment", signal: "none" },
  CF: { label: "Criminal felony", signal: "none" },
  CM: { label: "Criminal misdemeanor", signal: "none" },
  CT: { label: "Criminal traffic", signal: "none" },
  TR: { label: "Traffic forfeiture", signal: "none" },
  FO: { label: "Forfeiture (non-traffic)", signal: "none" },
  JV: { label: "Juvenile", signal: "none" },
  JC: { label: "Juvenile CHIPS", signal: "none" },
  JD: { label: "Juvenile delinquency", signal: "none" },
  TP: { label: "Termination of parental rights", signal: "none" },
  AD: { label: "Adoption", signal: "none" },
  CX: { label: "Civil (complex)", signal: "indirect" },
  CI: { label: "Civil injunction / restraining", signal: "none" },
  SV: { label: "Sexual violent person", signal: "none" },
};

/** Readable label for a saved lien/case row. */
export function caseTypeLabel(caseType?: string, kind?: string): string {
  if (!caseType) return kind ? DISTRESS_LABEL[kind as DistressType] ?? kind : "—";
  const code = caseType.slice(0, 2).toUpperCase();
  if (/30404|foreclos/i.test(caseType)) return "Mortgage foreclosure";
  const t = WI_CASE_TYPE[code];
  return t ? t.label : caseType;
}
