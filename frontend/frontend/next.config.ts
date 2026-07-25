import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the Next.js app via the machine LAN IP in development.
  allowedDevOrigins: ["192.168.2.84"],
};

export default nextConfig;
