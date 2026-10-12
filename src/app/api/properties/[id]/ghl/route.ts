import { NextResponse } from "next/server";
import { getRepo } from "@/lib/db";
import { listPipelines, saveGhlSettings, sendToGhl } from "@/lib/ghl";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repo = getRepo();
  const p = await repo.getProperty(id);
  if (!p) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
  if (p.isSample) return NextResponse.json({ ok: false, error: "Sample rows can't be sent to GHL." }, { status: 400 });
  const body = (await req.json().catch(() => ({}))) as { pipelineId?: string; stageId?: string; remember?: boolean };
  if (body.remember && body.pipelineId && body.stageId) {
    try {
      const pipe = (await listPipelines()).find((x) => x.id === body.pipelineId);
      const stage = pipe?.stages.find((x) => x.id === body.stageId);
      if (pipe && stage) await saveGhlSettings({ pipelineId: pipe.id, pipelineName: pipe.name, stageId: stage.id, stageName: stage.name });
    } catch { /* default not saved; send still proceeds */ }
  }
  const result = await sendToGhl(p, { pipelineId: body.pipelineId, stageId: body.stageId });
  if (result.ok && p.leadStatus === "new") await repo.updateProperty(id, { leadStatus: "lead" });
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
