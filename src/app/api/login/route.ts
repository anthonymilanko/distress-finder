import { NextResponse } from "next/server";

async function sessionToken(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("df-session:" + password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  const expected = process.env.DF_APP_PASSWORD;
  if (!expected) return NextResponse.json({ ok: true, note: "No password set" });
  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (password !== expected) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return NextResponse.json({ ok: false, error: "Wrong password" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("df_session", await sessionToken(expected), { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 90 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("df_session", "", { path: "/", maxAge: 0 });
  return res;
}
