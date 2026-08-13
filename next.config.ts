import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  serverExternalPackages: ["sharp"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Production build type-checks application source only (see tsconfig.build.json).
    // Full-repo typecheck remains in CI via `npm run typecheck`.
    tsconfigPath: "./tsconfig.build.json",
  },
  experimental: {
    // Lower peak RSS during webpack compilation on memory-constrained builders.
    webpackMemoryOptimizations: true,
    // Avoid parallel server compile/trace workers that spike memory on Hobby.
    parallelServerCompiles: false,
    parallelServerBuildTraces: false,
    cpus: 1,
  },
};

export default nextConfig;
