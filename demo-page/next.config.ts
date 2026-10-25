import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The privacy policy lives on the assistant's server, next to the business website.
  async redirects() {
    return [{ source: "/privacy", destination: "https://148-113-241-86.sslip.io/privacy", permanent: false }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
