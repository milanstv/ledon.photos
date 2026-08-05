import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-82020269fabb4c89ac7416178b29bf31.r2.dev",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;