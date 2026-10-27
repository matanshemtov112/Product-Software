import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // תמונות מוצר וחשבוניות (עד 9MB יחד) עוברות בפעולות שרת; הדפדפן מקטין תמונות לפני השליחה
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
