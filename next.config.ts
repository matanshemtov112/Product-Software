import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // תמונות מוצר עוברות בפעולות שרת; הדפדפן מקטין אותן לפני השליחה
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
