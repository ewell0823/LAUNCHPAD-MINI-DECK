import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "midi=(self)",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
