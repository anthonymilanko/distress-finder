import type { Property } from "@/lib/types";
import { DISTRESS_LABEL } from "@/lib/format";
import { getRepo } from "@/lib/db";

/**
 * GoHighLevel push. Without GHL_API_KEY + GHL_LOCATION_ID this is a stub that
 * logs and returns ok:true/stubbed:true so the UI flow works.
 *
 * With keys: upserts a contact (no duplicates on repeat sends) via the
 * LeadConnector v2 API using a Private Integration token, tags it, and adds a
 * note with the property facts. The token needs the contacts.write and
 * contacts.readonly scopes.
 *
 * COMPLIANCE: the UI reminds the user to scrub against DNC/TCPA before any
 * call or text; this function never sends a message itself.
 */
const API = "https://services.leadconnectorhq.com";

export interface GhlSettings {
  pipelineId?: string;
  pipelineName?: string;
  stageId?: string;
  stageName?: string;
}
const SETTINGS_KEY = "settings:ghl";

export const ghlConfigured = () => Boolean(process.env.GHL_API_KEY?.trim() && process.env.GHL_LOCATION_ID?.trim());

function ghlHeaders() {
  return { Authorization: `Bearer ${process.env.GHL_API_KEY?.trim()}`, Version: "2021-07-28", "Content-Type": "application/json", Accept: "application/json" };
}

export async function getGhlSettings(): Promise<GhlSettings> {
  const saved = await getRepo().getLookup<GhlSettings>(SETTINGS_KEY);
  return saved ?? { pipelineId: process.env.GHL_PIPELINE_ID, stageId: process.env.GHL_STAGE_ID };
}
export async function saveGhlSettings(s: GhlSettings) {
  await getRepo().putLookup(SETTINGS_KEY, s);
}

/** Pipelines + stages in the sub-account (needs the opportunities.readonly scope). */
export async function listPipelines(): Promise<Array<{ id: string; name: string; stages: Array<{ id: string; name: string }> }>> {
  const location = process.env.GHL_LOCATION_ID?.trim();
  const res = await fetch(`${API}/opportunities/pipelines?locationId=${encodeURIComponent(location ?? "")}`, { headers: ghlHeaders() });
  if (!res.ok) throw new Error(`GHL HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { pipelines?: Array<{ id: string; name: string; stages?: Array<{ id: string; name: string }> }> };
  return (data.pipelines ?? []).map((p) => ({ id: p.id, name: p.name, stages: (p.stages ?? []).map((st) => ({ id: st.id, name: st.name })) }));
}

export async function sendToGhl(p: Property): Promise<{ ok: boolean; stubbed: boolean; id?: string; opportunityId?: string; error?: string; warning?: string }> {
  const key = process.env.GHL_API_KEY?.trim();
  const location = process.env.GHL_LOCATION_ID?.trim();
  if (!key || !location) {
    console.log("[GHL stub] would create contact:", p.ownerName, p.address);
    return { ok: true, stubbed: true };
  }
  const headers = ghlHeaders();
  const tags = ["distress-finder", ...p.distressTypes.map((t) => `df:${t}`), ...(p.tags ?? []).map((t) => t.toLowerCase())];
  const body: Record<string, unknown> = {
    locationId: location,
    firstName: p.ownerFirst ?? p.ownerName ?? "Owner",
    lastName: p.ownerLast ?? "",
    address1: p.address,
    city: p.city,
    state: p.state,
    postalCode: p.zip,
    tags,
    source: "Distress Finder",
  };
  if (p.phones?.[0]) body.phone = `+1${p.phones[0]}`;
  if (p.emails?.[0]) body.email = p.emails[0];

  const res = await fetch(`${API}/contacts/upsert`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) return { ok: false, stubbed: false, error: `GHL HTTP ${res.status}: ${(await res.text()).slice(0, 300)}` };
  const data = (await res.json()) as { contact?: { id?: string } };
  const id = data.contact?.id;

  // Attach the property facts as a note (custom fields vary per account; a note always works).
  if (id) {
    const lines = [
      `Property: ${p.address}, ${p.city}, ${p.state} ${p.zip}`,
      p.parcel ? `Parcel: ${p.parcel}` : null,
      `Distress: ${p.distressTypes.map((t) => DISTRESS_LABEL[t]).join(", ") || "—"}`,
      p.estValue != null ? `Est. value: $${p.estValue.toLocaleString()}` : null,
      p.estEquityPct != null ? `Est. equity: ${Math.round(p.estEquityPct)}%` : null,
      p.yearsOwned != null ? `Owned: ${p.yearsOwned} yrs` : null,
      p.absentee ? "Absentee owner" : null,
      p.phones?.length ? `Other phones: ${p.phones.slice(1).join(", ")}` : null,
      p.emails?.length && p.emails.length > 1 ? `Other emails: ${p.emails.slice(1).join(", ")}` : null,
      `Source: ${p.source} (${p.sourceDate})`,
    ].filter(Boolean);
    await fetch(`${API}/contacts/${id}/notes`, { method: "POST", headers, body: JSON.stringify({ body: lines.join("\n") }) }).catch(() => {});
  }

  // Opportunity in the chosen pipeline/stage (upsert = one per contact per pipeline).
  let opportunityId: string | undefined;
  let warning: string | undefined;
  const settings = await getGhlSettings();
  if (id && settings.pipelineId && settings.stageId) {
    const oppRes = await fetch(`${API}/opportunities/upsert`, {
      method: "POST", headers,
      body: JSON.stringify({
        pipelineId: settings.pipelineId,
        locationId: location,
        contactId: id,
        name: `${p.address}, ${p.city}`,
        status: "open",
        pipelineStageId: settings.stageId,
        ...(p.estValue != null ? { monetaryValue: Math.round(p.estValue) } : {}),
        source: "Distress Finder",
      }),
    });
    if (oppRes.ok) {
      const od = (await oppRes.json()) as { opportunity?: { id?: string } };
      opportunityId = od.opportunity?.id;
    } else {
      warning = `Contact saved, but the pipeline opportunity failed: HTTP ${oppRes.status} ${(await oppRes.text()).slice(0, 200)}`;
    }
  } else if (id) {
    warning = "Contact saved. No pipeline chosen yet — pick one in Settings to also create an opportunity.";
  }
  return { ok: true, stubbed: false, id, opportunityId, warning };
}
