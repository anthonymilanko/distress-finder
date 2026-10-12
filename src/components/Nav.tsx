"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Map", icon: "🗺️" },
  { href: "/search", label: "Search", icon: "🔎" },
  { href: "/import", label: "Import", icon: "📥" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function Nav() {
  const path = usePathname();
  if (path === "/login") return null;
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Phone: bottom tab bar */}
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line pb-safe md:hidden">
        <ul className="grid grid-cols-4">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className={`flex flex-col items-center py-2 text-xs ${isActive(it.href) ? "text-brand font-semibold" : "text-muted"}`}>
                <span className="text-lg leading-none">{it.icon}</span>
                <span className="mt-1">{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Desktop: left sidebar */}
      <aside className="hidden md:flex md:flex-col w-56 shrink-0 bg-dark text-white h-dvh sticky top-0">
        <div className="px-4 py-4 flex items-center gap-3 border-b border-white/10">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-white text-dark font-bold">TJ</span>
          <div className="leading-tight">
            <div className="font-semibold">Distress Finder</div>
            <div className="text-[11px] text-white/70">TJ Investment Group</div>
          </div>
        </div>
        <ul className="p-2 flex flex-col gap-1">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${isActive(it.href) ? "bg-white/10 font-semibold" : "text-white/80 hover:bg-white/5"}`}>
                <span className="text-base leading-none">{it.icon}</span>
                <span>{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto p-4 text-[11px] text-white/50">Version {process.env.NEXT_PUBLIC_APP_VERSION}</div>
      </aside>
    </>
  );
}
