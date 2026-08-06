import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  // Allow opening the Next.js app via the machine LAN IP in development.
  allowedDevOrigins: ["192.168.100.148", "192.168.100.144"],
};

export default withNextIntl(nextConfig);
