import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "*.devtunnels.ms",
    "*.inc1.devtunnels.ms",
    "192.168.0.147",
    "192.168.*",
  ],
  async rewrites() {
    return [
      {
        source: "/gateway/:path*",
        destination: "http://127.0.0.1:8787/:path*",
      },
    ];
  },
};

export default nextConfig;

