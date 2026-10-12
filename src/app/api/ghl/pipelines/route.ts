import { NextResponse } from "next/server";
import { getGhlSettings, ghlConfigured, listPipelines, saveGhlSettings } from "@/lib/ghl";

/** GET → pipelines + stages and the current choice. POST { pipelineId, stageId } → save the choice. */
export async function GET() {
  if (!ghlConfigured()) return NextResponse.json({ ok: false, error: "GHL_API_KEY and GHL_LOCATION_ID are not set." }, { status: 400 });
  try {
    const [pipelines, settings] = await Promise.all([listPipelines(), getGhlSettings()]);
    return NextResponse.json({ ok: true, pipelines, settings });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}

export async function POST(req: Request) {
  const { pipelineId, stageId } = (await req.json()) as { pipelineId?: string; stageId?: string };
  if (!pipelineId || !stageId) return NextResponse.json({ ok: false, error: "pipelineId and stageId required" }, { status: 400 });
  const pipelines = await listPipelines();
  const pipe = pipelines.find((p) => p.id === pipelineId);
  const stage = pipe?.stages.find((s) => s.id === stageId);
  if (!pipe || !stage) return NextResponse.json({ ok: false, error: "Unknown pipeline or stage" }, { status: 400 });
  await saveGhlSettings({ pipelineId, pipelineName: pipe.name, stageId, stageName: stage.name });
  return NextResponse.json({ ok: true, settings: { pipelineId, pipelineName: pipe.name, stageId, stageName: stage.name } });
}
