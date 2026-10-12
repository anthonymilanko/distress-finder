import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "OverlookAI",
    short_name: "OverlookAI",
    description: "Find the houses everyone else overlooked.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f2",
    theme_color: "#13161c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
