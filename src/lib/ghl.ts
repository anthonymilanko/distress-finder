import type { Property } from "@/lib/types";
import { DISTRESS_LABEL } from "@/lib/format";

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

export async function sendToGhl(p: Property): Promise<{ ok: boolean; stubbed: boolean; id?: string; error?: string }> {
  const key = process.env.GHL_API_KEY?.trim();
  const location = process.env.GHL_LOCATION_ID?.trim();
  if (!key || !location) {
    console.log("[GHL stub] would create contact:", p.ownerName, p.address);
    return { ok: true, stubbed: true };
  }
  const headers = { Authorization: `Bearer ${key}`, Version: "2021-07-28", "Content-Type": "application/json", Accept: "application/json" };
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
  return { ok: true, stubbed: false, id };
}
