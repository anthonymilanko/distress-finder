"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const items = [
  { href: "/", label: "Map", d: "M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" },
  { href: "/search", label: "Search", d: "M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-3.5-3.5" },
  { href: "/import", label: "Import", d: "M12 3v12M7 10l5 5 5-5M4 17v3h16v-3" },
  { href: "/settings", label: "Settings", d: "M12 8a4 4 0 100 8 4 4 0 000-8zM4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" },
];

function Icon({ d, className }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={d} /></svg>;
}

export default function Nav() {
  const path = usePathname();
  if (path === "/login") return null;
  const isActive = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {/* Phone: top brand strip + bottom tabs */}
      <header className="md:hidden sticky top-0 z-30 bg-dark text-white px-4 py-3 flex items-center gap-2.5">
        <Logo size={24} />
        <span className="font-extrabold tracking-tight">Overlook<span className="text-brand">AI</span></span>
      </header>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line pb-safe md:hidden">
        <ul className="grid grid-cols-4">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className={`flex flex-col items-center py-2 text-[11px] font-medium ${isActive(it.href) ? "text-brand" : "text-muted"}`}>
                <Icon d={it.d} />
                <span className="mt-0.5">{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Desktop: slim rail */}
      <aside className="hidden md:flex md:flex-col w-[76px] shrink-0 bg-dark text-white h-dvh sticky top-0 items-center">
        <Link href="/" className="mt-4 mb-2 flex flex-col items-center gap-1" title="OverlookAI">
          <Logo size={30} />
          <span className="text-[10px] font-bold tracking-tight">Overlook<span className="text-brand">AI</span></span>
        </Link>
        <ul className="mt-3 flex flex-col gap-1 w-full px-2">
          {items.map((it) => (
            <li key={it.href}>
              <Link href={it.href} className={`flex flex-col items-center gap-1 rounded-md py-2.5 text-[11px] font-medium transition-colors ${isActive(it.href) ? "bg-white/12 text-white" : "text-white/65 hover:text-white hover:bg-white/6"}`}>
                <Icon d={it.d} />
                <span>{it.label}</span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-auto pb-3 text-[9px] text-white/35 text-center px-1 leading-tight">{process.env.NEXT_PUBLIC_APP_VERSION}</div>
      </aside>
    </>
  );
}
