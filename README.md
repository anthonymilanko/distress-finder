# Distress Finder — Phase 1 prototype

Internal web app for TJ Investment Group (wholesaling, WI / FL / TX). Finds distressed homes, shows the property card, runs one-click court checks, and pushes leads to GoHighLevel. Mobile-first; installs on iPhone as a home-screen app.

The blueprint doc is the spec: *Distress Finder App — Build Blueprint* (Claude Docs).

## Run it

```bash
npm install
cp .env.example .env.local   # optional — everything works with no keys
npm run dev                  # http://localhost:3000
```

With no keys set, the app runs on a local JSON file (`data/db.json`, seeded with 12 clearly fake Milwaukee rows) and mock property lookups. The Settings page shows what's live.

## What's in Phase 1

| Feature | Where | Notes |
| --- | --- | --- |
| Map + filters + list | `/` | OpenStreetMap tiles (no key). Pin color = distress score. |
| Address search | `/search` | BatchData autocomplete + Property Lookup, cached per address. Mock data without `BATCHDATA_API_KEY`. |
| Property card | `/property/[id]` | Beds/baths/sqft/lot/year, owner, equity, Street View embed (display only), listing link-outs, court records table, lead status, GHL send, notes. |
| CSV import | `/import` | BatchLeads exports. Normalizes, dedupes on parcel + address, merges into existing rows, shows a change log. |
| One-click court checks | property card | WI → WCCA with `lastName/firstName` + `df` params. FL/TX → county clerk pages (add counties in `src/lib/court-links.ts`). |
| TJ Record Reader extension | `extension/` | Prefills the name on WCCA, adds "Save to property". See `extension/README.md`. |
| Court-page parsing | `/api/court/save` | Claude Haiku 5.5 with `ANTHROPIC_API_KEY`; regex fallback without. Everything saved as **possible match**. |
| Scoring module | `src/lib/scoring` | Records points live now; image scorer is a plug-in (`Scorer`) for Phase 2. Daily spend cap (`DF_DAILY_AI_CAP_USD`, default $5) + cache keyed on parcel + image date. |
| Settings | `/settings` | Integration status, AI spend today vs cap, iPhone install steps. |

## Storage

- **Local (default):** `data/db.json`. Good for one user on one machine.
- **Supabase:** run `supabase/migrations/0001_init.sql`, then set `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. The app switches automatically.

## Keys (all optional) — see `.env.example`

`BATCHDATA_API_KEY` · `GHL_API_KEY` + `GHL_LOCATION_ID` · `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` · `ANTHROPIC_API_KEY` · `DF_EXTENSION_TOKEN` · `NEXT_PUBLIC_APP_URL`

## Rules baked in

- Google imagery is display-only. The scorer rejects any Google-hosted image URL (`isGoogleImagery`).
- Listing sites (Zillow / Redfin / Realtor.com) are never scraped; the card links out to them.
- Every lien / foreclosure / tax row carries `source` + `sourceDate` + `confidence`. Name-only court matches are always `possible_match`.
- The extension never submits, clicks Search, or pages. One human-run search at a time.
- Sample / mock rows are flagged `isSample` and can't be sent to GHL.
- GHL send shows a DNC/TCPA reminder; foreclosure cards show the foreclosure-consultant warning.

## First things to verify (unverified at build time)

1. **WCCA name params.** Open a "Check WCCA" button from a card and see whether the name fields arrive filled. If not, the extension handles it. (`src/lib/court-links.ts`)
2. **BatchData field names.** `src/lib/batchdata.ts` → `mapLookup()` follows BatchData's v1 docs as best known; confirm against developer.batchdata.com and your plan.
3. **WCCA input selectors** in `extension/content.js` → `findFields()`.
4. **FL/TX clerk URLs** in `src/lib/court-links.ts`; add the counties you work.
5. For production, swap OSM tiles for MapTiler/Mapbox (`src/components/MapView.tsx`) — OSM's public tiles are for light use.

## Tests

```bash
node --experimental-strip-types --test src/lib/normalize.test.ts
npm run lint && npm run build
```

## Next phases

Phase 2: Haiku/Sonnet image scorer on your own photos + Mapillary. Phase 3: BatchData area search, Nearmap, metro mask. Phase 4: county connectors + change alerts. See the blueprint.
