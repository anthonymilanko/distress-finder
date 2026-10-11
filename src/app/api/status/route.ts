import { NextResponse } from "next/server";
import { getRepo, storageMode } from "@/lib/db";
import { batchDataLive } from "@/lib/batchdata";
import { DAILY_CAP_USD, today } from "@/lib/scoring";

/** Settings page data: which integrations are live and today's AI spend. */
export async function GET() {
  const spend = await getRepo().getSpend(today());
  return NextResponse.json({
    ok: true,
    storage: storageMode(),
    batchData: batchDataLive(),
    ghl: Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID),
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    streetView: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY),
    extensionToken: Boolean(process.env.DF_EXTENSION_TOKEN),
    spend: { ...spend, capUsd: DAILY_CAP_USD },
  });
}
