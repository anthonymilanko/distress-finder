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
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-line pb-safe">
      <ul className="grid grid-cols-4">
        {items.map((it) => {
          const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link href={it.href} className={`flex flex-col items-center py-2 text-xs ${active ? "text-brand font-semibold" : "text-muted"}`}>
                <span className="text-lg leading-none">{it.icon}</span>
                <span className="mt-1">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
