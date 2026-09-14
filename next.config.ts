import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/client"],
  experimental: { serverActions: { bodySizeLimit: "20mb" } },
};

export default nextConfig;
