import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
