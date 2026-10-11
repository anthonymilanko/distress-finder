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
