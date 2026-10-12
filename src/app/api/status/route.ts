import { NextResponse } from "next/server";
import { getRepo, storageMode } from "@/lib/db";
import { DATA_DIR } from "@/lib/db/local";
import { batchDataLive } from "@/lib/batchdata";
import { DAILY_CAP_USD, today } from "@/lib/scoring";

/** Settings page data: which integrations are live and today's AI spend. */
export async function GET() {
  let spend = { day: today(), scans: 0, costUsd: 0 };
  let dbError: string | undefined;
  try {
    spend = await getRepo().getSpend(today());
  } catch (e) {
    dbError = (e as Error).message;
  }
  return NextResponse.json({
    ok: !dbError,
    dbError,
    storage: storageMode(),
    dataDir: DATA_DIR,
    batchData: batchDataLive(),
    ghl: Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID),
    claude: Boolean(process.env.ANTHROPIC_API_KEY),
    streetView: Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY),
    extensionToken: Boolean(process.env.DF_EXTENSION_TOKEN),
    passwordSet: Boolean(process.env.DF_APP_PASSWORD),
    spend: { ...spend, capUsd: DAILY_CAP_USD },
  });
}
