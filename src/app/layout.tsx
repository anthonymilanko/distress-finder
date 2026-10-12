import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import Nav from "@/components/Nav";

// Self-hosted (no Google Fonts fetch at build time). Variable weight 200–800.
const manrope = localFont({
  src: [
    { path: "./fonts/manrope-latin.woff2", weight: "200 800", style: "normal" },
    { path: "./fonts/manrope-latin-ext.woff2", weight: "200 800", style: "normal" },
  ],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OverlookAI",
  description: "Find the houses everyone else overlooked.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "OverlookAI" },
};

export const viewport: Viewport = {
  themeColor: "#13161c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${manrope.variable}`}>
      <body className="min-h-full flex flex-col md:flex-row">
        <Nav />
        <main className="flex-1 pb-20 md:pb-0 md:h-dvh md:overflow-y-auto">{children}</main>
      </body>
    </html>
  );
}
