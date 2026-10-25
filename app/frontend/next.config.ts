import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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

