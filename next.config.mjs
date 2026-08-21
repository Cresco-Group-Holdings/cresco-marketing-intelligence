/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

export default nextConfig;
