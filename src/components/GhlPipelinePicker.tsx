"use client";
import { useEffect, useState } from "react";

interface Pipeline { id: string; name: string; stages: Array<{ id: string; name: string }> }
interface Settings { pipelineId?: string; pipelineName?: string; stageId?: string; stageName?: string }

export default function GhlPipelinePicker() {
  const [pipelines, setPipelines] = useState<Pipeline[] | null>(null);
  const [settings, setSettings] = useState<Settings>({});
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/ghl/pipelines").then((r) => r.json()).then((d) => {
      if (!d.ok) { setErr(d.error); return; }
      setPipelines(d.pipelines); setSettings(d.settings ?? {});
      setPipelineId(d.settings?.pipelineId ?? ""); setStageId(d.settings?.stageId ?? "");
    }).catch((e) => setErr(String(e)));
  }, []);

  const stages = pipelines?.find((p) => p.id === pipelineId)?.stages ?? [];

  async function save() {
    setMsg(null);
    const d = await fetch("/api/ghl/pipelines", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pipelineId, stageId }) }).then((r) => r.json());
    if (d.ok) { setSettings(d.settings); setMsg(`Saved. New leads go to ${d.settings.pipelineName} → ${d.settings.stageName}.`); }
    else setErr(d.error);
  }

  return (
    <section className="card text-sm">
      <div className="label mb-1">GoHighLevel pipeline</div>
      {err ? (
        <div className="text-brand">{err}{/opportunit|scope|401|403/i.test(err) ? " — the Private Integration token needs the View Opportunities and Edit Opportunities scopes." : ""}</div>
      ) : !pipelines ? (
        <div className="text-muted">Loading pipelines…</div>
      ) : (
        <>
          <div className="text-muted mb-2">{settings.pipelineId ? `Currently: ${settings.pipelineName} → ${settings.stageName}` : "No pipeline chosen yet. Contacts are still created; opportunities will be too once you pick one."}</div>
          <div className="flex flex-wrap gap-2 items-center">
            <select className="input !w-auto" value={pipelineId} onChange={(e) => { setPipelineId(e.target.value); setStageId(""); }}>
              <option value="">Pipeline…</option>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select className="input !w-auto" value={stageId} onChange={(e) => setStageId(e.target.value)} disabled={!pipelineId}>
              <option value="">Stage…</option>
              {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
            <button type="button" className="btn btn-brand" disabled={!pipelineId || !stageId} onClick={save}>Save</button>
          </div>
          {msg && <div className="mt-2 text-cool">{msg}</div>}
        </>
      )}
    </section>
  );
}
