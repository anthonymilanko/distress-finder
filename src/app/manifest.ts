import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Distress Finder — TJ Investment Group",
    short_name: "Distress Finder",
    description: "Find distressed homes, check records, push leads to GHL.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4f0",
    theme_color: "#05150e",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
