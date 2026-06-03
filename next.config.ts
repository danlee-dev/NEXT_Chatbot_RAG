import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "sqlite-vec"],
  outputFileTracingIncludes: {
    "/api/**/*": [
      "./data/rag.db",
      "./node_modules/sqlite-vec/**/*",
      "./node_modules/sqlite-vec-linux-x64/**/*",
      "./node_modules/sqlite-vec-linux-arm64/**/*",
      "./node_modules/better-sqlite3/**/*",
    ],
  },
};

export default nextConfig;
