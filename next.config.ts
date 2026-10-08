import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/admin/photo-galleries/**": [
      "./node_modules/sharp/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
      "./public/images/LD-center.png",
      "./public/images/LEDON-logo-white-transparent.png",
    ],
  },
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