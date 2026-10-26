import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // a PDF import sends every decklist of the event in one go (about 1.6KB each, 400 at the biggest)
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
