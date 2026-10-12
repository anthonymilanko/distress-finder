"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const next = useSearchParams().get("next") || "/";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const d = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).then((r) => r.json());
    setBusy(false);
    if (d.ok) router.replace(next);
    else setErr(d.error ?? "Sign-in failed");
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-sm flex flex-col gap-3">
      <div>
        <div className="text-lg font-semibold">Distress Finder</div>
        <div className="text-sm text-muted">TJ Investment Group · private</div>
      </div>
      <input className="input" type="password" placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus autoComplete="current-password" />
      {err && <div className="text-sm text-brand">{err}</div>}
      <button type="submit" className="btn btn-brand" disabled={busy || !pw}>{busy ? "…" : "Sign in"}</button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh grid place-items-center px-4 bg-bg">
      <Suspense><LoginForm /></Suspense>
    </div>
  );
}
