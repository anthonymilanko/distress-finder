import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

let version = "dev";
try { version = readFileSync("VERSION", "utf8").trim(); } catch { /* no VERSION file */ }

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_APP_VERSION: version },
  // Phase 1 prototype: request-time rendering everywhere, no partial prerendering.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        // The TJ Record Reader extension posts to this route from a browser tab.
        source: "/api/court/save",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "POST, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, X-DF-Token" },
        ],
      },
    ];
  },
};

export default nextConfig;
