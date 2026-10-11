import type { Property } from "@/lib/types";

/**
 * One-click record-check links. Each returns a URL the browser opens in a new
 * tab; a human runs the search. The `df` query param carries the lookup for
 * the TJ Record Reader extension (which prefills the name fields and adds a
 * "Save to property" button). Sites usually ignore unknown params, but if one
 * rejects it, drop `withDf` for that site.
 *
 * UNVERIFIED (first task for the build): whether WCCA honors name params in
 * the URL. The link also sends lastName/firstName in case it does; the
 * extension covers it if it doesn't.
 *
 * FL / TX entries are per-county starting pages; add counties as you work them.
 */

export interface CourtLink {
  label: string;
  url: string;
  note?: string;
}

export interface LookupPayload {
  propertyId: string;
  last: string;
  first: string;
  appUrl: string;
  state: string;
  county?: string;
}

export function encodeDf(p: LookupPayload): string {
  const json = JSON.stringify(p);
  const b64 = typeof Buffer !== "undefined" ? Buffer.from(json, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(json)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function withParams(base: string, params: Record<string, string | undefined>): string {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  return u.toString();
}

const FL_COUNTY_CLERKS: Record<string, { label: string; url: string; note?: string }> = {
  hillsborough: { label: "Hillsborough Clerk (HOVER)", url: "https://hover.hillsclerk.com/", note: "Court records search; foreclosure auctions at hillsborough.realforeclose.com" },
  pinellas: { label: "Pinellas Clerk records", url: "https://ccmspa.pinellascounty.org/PublicAccess/default.aspx" },
  sarasota: { label: "Sarasota Clerk records", url: "https://www.sarasotaclerk.com/", note: "Foreclosure auctions at sarasota.realforeclose.com" },
  manatee: { label: "Manatee Clerk records", url: "https://records.manateeclerk.com/CourtRecords/Search" },
  "miami-dade": { label: "Miami-Dade foreclosure / lis pendens", url: "https://www.miamidade.gov/clerk/mortgage-foreclosures.page" },
  brevard: { label: "Brevard foreclosure auctions", url: "https://www.brevardclerk.us/foreclosures-auction" },
};

const TX_COUNTY_CLERKS: Record<string, { label: string; url: string; note?: string }> = {
  harris: { label: "Harris County Clerk foreclosure notices", url: "https://www.cclerk.hctx.net/applications/websearch/FRCL_R.aspx", note: "Trustee sale notices, posted 21+ days before sale" },
  dallas: { label: "Dallas County foreclosure notices", url: "https://www.dallascounty.org/government/county-clerk/recording/foreclosures.php" },
  orange: { label: "Orange County (TX) Clerk", url: "https://www.co.orange.tx.us/page/orange.County.Clerk" },
  jefferson: { label: "Jefferson County (TX) Clerk", url: "https://co.jefferson.tx.us/cclerk/" },
};

export function courtLinks(p: Property, appUrl: string): CourtLink[] {
  const last = p.ownerLast ?? "";
  const first = p.ownerFirst ?? "";
  const state = (p.state || "").toUpperCase();
  const county = (p.county ?? "").toLowerCase().replace(/\s+county$/, "");
  const df = encodeDf({ propertyId: p.id, last, first, appUrl, state, county: p.county });
  const links: CourtLink[] = [];

  if (state === "WI") {
    links.push({
      label: "Check WCCA (Wisconsin courts)",
      url: withParams("https://wcca.wicourts.gov/case", { lastName: last, firstName: first, df }),
      note: p.ownerIsBusiness ? "Business owner: use the Business name field on WCCA." : "Case types to watch: CV 30404 foreclosure, TW, CL, ML, CO, HL, OL, SC, TJ, FJ. Open status = live.",
    });
  } else if (state === "FL") {
    const c = FL_COUNTY_CLERKS[county];
    if (c) links.push({ label: c.label, url: withParams(c.url, { df }), note: c.note });
    links.push({ label: "FL Clerks statewide portal (myfloridacounty)", url: "https://www.myfloridacounty.com/", note: "Pick the county, then Official Records → lis pendens / judgments." });
  } else if (state === "TX") {
    const c = TX_COUNTY_CLERKS[county];
    if (c) links.push({ label: c.label, url: withParams(c.url, { df }), note: c.note });
    links.push({ label: "TX county clerk directory", url: "https://www.sos.state.tx.us/elections/voter/county.shtml", note: "Find the county clerk, then Real Property / Foreclosure Notices." });
  }
  return links;
}

/** Listing-site link-outs: the app never pulls their photos, it opens their page. */
export function listingLinks(p: Property): CourtLink[] {
  const q = encodeURIComponent(`${p.address}, ${p.city}, ${p.state} ${p.zip}`);
  const slug = `${p.address} ${p.city} ${p.state} ${p.zip}`.trim().replace(/[^A-Za-z0-9 ]/g, "").replace(/\s+/g, "-");
  return [
    { label: "Open on Zillow", url: `https://www.zillow.com/homes/${encodeURIComponent(slug)}_rb/` },
    { label: "Open on Redfin", url: `https://www.redfin.com/search?query=${q}` },
    { label: "Open on Realtor.com", url: `https://www.realtor.com/realestateandhomes-search?q=${q}` },
  ];
}
