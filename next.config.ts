import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // API-only backend for the Telegram bot + cron jobs.
  // Route handlers run on the Node.js runtime (google-auth-library needs it).
  serverExternalPackages: ["google-auth-library"],
};

export default nextConfig;
