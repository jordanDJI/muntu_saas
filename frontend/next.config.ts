import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
  async headers() {
    return [
      {
        source: "/embed/:path*",
        headers: [
          // Allow embedding from any external domain
          { key: "Content-Security-Policy", value: "frame-ancestors *" },
          // Override Next.js default SAMEORIGIN
          { key: "X-Frame-Options", value: "ALLOWALL" },
        ],
      },
    ];
  },
};

export default nextConfig;
