import type { NextConfig } from "next";

/**
 * מאיפה הדף רשאי לטעון תוכן: קוד רק מהאתר עצמו; תמונות גם ממפת OpenStreetMap ומהמאגרים הפתוחים של הצעות
 * התמונה. גם אם תימצא פעם פרצת XSS, הדפדפן לא יטען קוד משרת זר ולא ישלח טפסים לאתר אחר.
 */
function contentSecurityPolicy() {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // Next.js מוסיף קוד קטן בתוך הדף; בפיתוח הוא צריך גם eval
    `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://tile.openstreetmap.org https://upload.wikimedia.org https://thumb.wikimedia.org https://images.openfoodfacts.org https://static.openfoodfacts.org",
    "font-src 'self' data:",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

/** כותרות אבטחה לכל העמודים: בלי הטמעה באתרים אחרים, בלי ניחוש סוגי קבצים, ומצלמה רק מהאתר עצמו */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: contentSecurityPolicy() },
  // בייצור: הדפדפן מתחבר לאתר רק ב-https, גם אם מקלידים http
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
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
