import type { NextConfig } from "next";

// The shared radar admin moved to Scrapyard (2026-09-29). Old links land on its home page.
const SCRAPYARD = "https://scrapyard-ten.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/admin", destination: SCRAPYARD, permanent: true },
      { source: "/admin/:path*", destination: SCRAPYARD, permanent: true },
    ];
  },
};

export default nextConfig;
