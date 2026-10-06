import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The shell moved from / to /shell; old share links (/?cmd=…) keep working. Query strings pass through.
      { source: "/", has: [{ type: "query", key: "cmd" }], destination: "/shell", permanent: false },
      { source: "/human", destination: "/#human", permanent: true },
    ];
  },
};

export default nextConfig;
