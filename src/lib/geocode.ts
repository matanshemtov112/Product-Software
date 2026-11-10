import { isNearIsrael, type Point } from "./geo";

/**
 * איתור עיר בישראל על המפה (OpenStreetMap Nominatim, שירות חינמי).
 * מחזיר null כשלא נמצא או כשהשירות לא זמין, כך שהמערכת ממשיכה לעבוד לפי האזור הכללי.
 */
export async function geocodeCity(city: string): Promise<Point | null> {
  const q = city.trim();
  if (q.length < 2) return null;
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({ q, format: "json", countrycodes: "il", limit: "1", "accept-language": "he" }).toString();
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "supplier-comparison-app/0.1" },
      signal: AbortSignal.timeout(5000),
      next: { revalidate: 60 * 60 * 24 * 30 },
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    if (!hit) return null;
    const point = { lat: Number(hit.lat), lng: Number(hit.lon) };
    return Number.isFinite(point.lat) && Number.isFinite(point.lng) && isNearIsrael(point) ? point : null;
  } catch {
    return null;
  }
}
