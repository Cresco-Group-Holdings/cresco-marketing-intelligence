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
    webpackMemoryOptimizations: true,
  },
};

export default nextConfig;
