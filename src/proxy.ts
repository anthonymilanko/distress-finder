import { NextResponse, type NextRequest } from "next/server";

/**
 * Password gate. When DF_APP_PASSWORD is set, every page and API route needs
 * either the session cookie (set by /api/login) or, for the extension, the
 * X-DF-Token header (checked by the route itself). With no password set
 * (local dev) everything is open.
 */
const PUBLIC = ["/login", "/api/login", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/maplibre-gl-worker.mjs"];

async function sessionToken(password: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("df-session:" + password));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function proxy(req: NextRequest) {
  const password = process.env.DF_APP_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"))) return NextResponse.next();
  // The Chrome extension authenticates with the shared token instead of a cookie.
  if (pathname.startsWith("/api/court/") && req.headers.get("x-df-token")) return NextResponse.next();
  if (req.cookies.get("df_session")?.value === (await sessionToken(password))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ ok: false, error: "Sign in required" }, { status: 401 });
  const login = new URL("/login", req.url);
  login.searchParams.set("next", pathname);
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
