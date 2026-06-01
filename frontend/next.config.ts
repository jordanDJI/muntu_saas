import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/blog/cout-site-internet-independant-:year(\\d+)",
        destination: "/blog/cout-site-internet-independant",
        permanent: true,
      },
    ];
  },
  compress: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
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
