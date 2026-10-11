import type { Property } from "@/lib/types";

/**
 * GoHighLevel push. Without GHL_API_KEY this is a stub that logs and returns
 * ok:true/stubbed:true so the UI flow works. With a key it creates a contact
 * via the LeadConnector v2 API (confirm your Location ID + scopes in GHL).
 *
 * COMPLIANCE: the UI reminds the user to scrub against DNC/TCPA before any
 * call or text; this function never sends a message itself.
 */
export async function sendToGhl(p: Property): Promise<{ ok: boolean; stubbed: boolean; id?: string; error?: string }> {
  const key = process.env.GHL_API_KEY;
  const location = process.env.GHL_LOCATION_ID;
  if (!key || !location) {
    console.log("[GHL stub] would create contact:", p.ownerName, p.address);
    return { ok: true, stubbed: true };
  }
  const tags = ["distress-finder", ...p.distressTypes.map((t) => `df:${t}`)];
  const body = {
    locationId: location,
    firstName: p.ownerFirst ?? p.ownerName ?? "Owner",
    lastName: p.ownerLast ?? "",
    address1: p.address,
    city: p.city,
    state: p.state,
    postalCode: p.zip,
    tags,
    customFields: [
      { key: "df_parcel", field_value: p.parcel ?? "" },
      { key: "df_est_equity", field_value: String(p.estEquity ?? "") },
      { key: "df_distress_score", field_value: String(p.distressScore ?? "") },
    ],
  };
  const res = await fetch("https://services.leadconnectorhq.com/contacts/", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Version: "2021-07-28", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, stubbed: false, error: `GHL HTTP ${res.status}: ${(await res.text()).slice(0, 200)}` };
  const data = (await res.json()) as { contact?: { id?: string } };
  return { ok: true, stubbed: false, id: data.contact?.id };
}
