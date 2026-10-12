"use client";
import { useEffect, useState } from "react";

interface Pipeline { id: string; name: string; stages: Array<{ id: string; name: string }> }

/** Popup shown when "Send to GoHighLevel" is clicked: pick pipeline + stage for this lead. */
export default function SendToGhlDialog({ address, onCancel, onSend }: {
  address: string;
  onCancel: () => void;
  onSend: (choice: { pipelineId?: string; stageId?: string; remember?: boolean }) => void;
}) {
  const [pipelines, setPipelines] = useState<Pipeline[] | null>(null);
  const [pipelineId, setPipelineId] = useState("");
  const [stageId, setStageId] = useState("");
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [configured, setConfigured] = useState(true);

  useEffect(() => {
    fetch("/api/ghl/pipelines").then((r) => r.json()).then((d) => {
      if (!d.ok) { if (/not set/i.test(d.error ?? "")) setConfigured(false); else setErr(d.error); setPipelines([]); return; }
      setPipelines(d.pipelines);
      setPipelineId(d.settings?.pipelineId ?? d.pipelines[0]?.id ?? "");
      setStageId(d.settings?.stageId ?? "");
    }).catch((e) => { setErr(String(e)); setPipelines([]); });
  }, []);

  const stages = pipelines?.find((p) => p.id === pipelineId)?.stages ?? [];
  // Keep the stage valid for the chosen pipeline (derived during render, no effect needed).
  const effectiveStageId = stages.some((s) => s.id === stageId) ? stageId : (stages[0]?.id ?? "");

  return (
    <div className="fixed inset-0 z-40 bg-black/40 grid place-items-center px-4" onClick={onCancel}>
      <div className="card w-full max-w-md flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
        <div>
          <div className="font-semibold">Send to GoHighLevel</div>
          <div className="text-sm text-muted">{address}</div>
        </div>
        {!configured ? (
          <div className="text-sm">GHL isn&apos;t connected yet. The contact will be logged locally only.</div>
        ) : !pipelines ? (
          <div className="text-sm text-muted">Loading pipelines…</div>
        ) : err ? (
          <div className="text-sm text-brand">{err}</div>
        ) : (
          <>
            <label className="text-sm flex flex-col gap-1">Pipeline
              <select className="input" value={pipelineId} onChange={(e) => setPipelineId(e.target.value)}>
                {pipelines.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <label className="text-sm flex flex-col gap-1">Stage
              <select className="input" value={effectiveStageId} onChange={(e) => setStageId(e.target.value)}>
                {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </label>
            <label className="text-sm flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Make this my default</label>
          </>
        )}
        <div className="text-xs rounded-lg bg-warm/10 border border-warm px-3 py-2">Before any call or text, scrub this contact against the National DNC list and your internal DNC (TCPA).</div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn btn-brand" disabled={configured && (!pipelines || Boolean(err))} onClick={() => onSend(configured ? { pipelineId, stageId: effectiveStageId, remember } : {})}>Send</button>
        </div>
      </div>
    </div>
  );
}
