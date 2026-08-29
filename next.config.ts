import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type safety is enforced in GitHub CI via `npm run typecheck`.
    // Skipping Next.js build-time type validation avoids a second full-program
    // TypeScript pass (~8GB RSS with Prisma) that OOMs Vercel Hobby builders.
    ignoreBuildErrors: true,
  },
  experimental: {
    // Lower peak RSS during webpack compilation on memory-constrained builders.
    webpackMemoryOptimizations: true,
    // Avoid parallel server compile/trace workers that spike memory on Hobby.
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    cpus: 1,
  },
  async redirects() {
    return [
      { source: "/content", destination: "/content/studio", permanent: false },
      { source: "/connectors", destination: "/integrations", permanent: false },
      { source: "/social", destination: "/organic-social", permanent: false },
      { source: "/social/connections", destination: "/organic-social/accounts", permanent: false },
      { source: "/social/reels", destination: "/organic-social/content", permanent: false },
      { source: "/social/performance", destination: "/organic-social/content", permanent: false },
      { source: "/analyst", destination: "/copilot", permanent: false },
      { source: "/analyst/:path*", destination: "/copilot", permanent: false },
      { source: "/ai-agents", destination: "/growth", permanent: false },
    ];
  },
};

export default nextConfig;
