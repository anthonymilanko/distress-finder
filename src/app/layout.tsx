import type { Metadata, Viewport } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "Distress Finder",
  description: "TJ Investment Group — find distressed homes, check records, push leads to GHL.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Distress Finder" },
};

export const viewport: Viewport = {
  themeColor: "#05150e",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col md:flex-row">
        <header className="bg-dark text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-30 md:hidden">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-dark font-bold text-sm">TJ</span>
          <div className="leading-tight">
            <div className="font-semibold">Distress Finder</div>
            <div className="text-[11px] text-white/70">TJ Investment Group</div>
          </div>
        </header>
        <Nav />
        <main className="flex-1 pb-20 md:pb-0 md:h-dvh md:overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
