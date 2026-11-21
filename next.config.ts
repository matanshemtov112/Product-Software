import type { NextConfig } from "next";

/** כותרות אבטחה לכל העמודים: בלי הטמעה באתרים אחרים, בלי ניחוש סוגי קבצים, ומצלמה רק מהאתר עצמו */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    // תמונות מוצר וחשבוניות (עד 9MB יחד) עוברות בפעולות שרת; הדפדפן מקטין תמונות לפני השליחה
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
