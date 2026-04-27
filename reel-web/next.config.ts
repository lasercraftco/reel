import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // Cosmetic lint/type errors shouldn't block prod deploys; CI lint job
  // catches them separately. Mirrors genome-web behaviour.
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  images: {
    remotePatterns: [
      { hostname: "image.tmdb.org" },
      { hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/engine/:path*",
        destination: `${process.env.REEL_ENGINE_URL || "http://localhost:8002"}/api/:path*`,
      },
    ];
  },
};

export default config;
