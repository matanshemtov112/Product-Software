/**
 * הצעות תמונה לספק שאין לו תמונה למוצר, ממאגרים פתוחים ברשת בלבד:
 * Wikimedia Commons (רק רישיונות חופשיים, גם דרך ערכי ויקיפדיה העברית) ו-Open Food Facts (לפי ברקוד).
 *
 * לעולם לא מציעים תמונות שספקים אחרים העלו למערכת: ההצעות באות רק מהמאגרים האלה.
 * ליצרן לא מציעים תמונות בכלל, כי הוא בעל המוצר ויש לו את התמונות שלו.
 */

export type ImageSuggestion = {
  /** כתובת התמונה בגודל תצוגה */
  url: string;
  /** הדף של התמונה במאגר, לקרדיט ולבדיקת הרישיון */
  pageUrl: string;
  /** קרדיט לפי דרישת הרישיון, למשל "צילום: Jane Doe, CC BY-SA 4.0, ויקישיתוף" */
  credit: string;
  source: "commons" | "openfoodfacts";
};

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** השרתים היחידים שמהם השרת מוריד תמונה שהספק בחר (הגנה מפני הורדה מכתובת שרירותית) */
export const ALLOWED_IMAGE_HOSTS = [
  "upload.wikimedia.org",
  "thumb.wikimedia.org",
  "images.openfoodfacts.org",
  "static.openfoodfacts.org",
];

export const MAX_SUGGESTIONS = 8;
const TIMEOUT_MS = 6000;
const USER_AGENT = "ProcurementCompare/1.0 (product image suggestions)";

/** רישיונות שמותר להשתמש בהם מסחרית עם קרדיט (לא NC ולא ND) */
const FREE_LICENSE = /^(cc0( [\d.]+)?|public domain|pd(-[\w-]+)?|cc[ -]by( |-)?(sa)?( [\d.]+)?)$/i;

export function isFreeLicense(short: string | undefined): boolean {
  return Boolean(short && FREE_LICENSE.test(short.trim()));
}

export function isAllowedImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && ALLOWED_IMAGE_HOSTS.includes(url.hostname) && !url.username && !url.port;
  } catch {
    return false;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

type CommonsPage = {
  title?: string;
  imageinfo?: {
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    mime?: string;
    extmetadata?: Record<string, { value?: string } | undefined>;
  }[];
};

/** מפענח תשובה של Commons ומשאיר רק תמונות ברישיון חופשי */
export function parseCommons(json: unknown): ImageSuggestion[] {
  const pages = (json as { query?: { pages?: Record<string, CommonsPage> } })?.query?.pages;
  if (!pages) return [];
  const out: ImageSuggestion[] = [];
  for (const page of Object.values(pages)) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    if (info.mime && !/^image\/(jpeg|png|webp)$/.test(info.mime)) continue;
    const meta = info.extmetadata ?? {};
    const license = stripHtml(meta.LicenseShortName?.value ?? "");
    if (!isFreeLicense(license)) continue;
    const url = info.thumburl ?? info.url;
    if (!url || !isAllowedImageUrl(url)) continue;
    const artist = stripHtml(meta.Artist?.value ?? "").slice(0, 80);
    out.push({
      url,
      pageUrl: info.descriptionurl ?? "https://commons.wikimedia.org",
      credit: [artist && `צילום: ${artist}`, license, "ויקישיתוף"].filter(Boolean).join(", "),
      source: "commons",
    });
  }
  return out;
}

/** מפענח מוצר מ-Open Food Facts (תמונות המאגר ברישיון CC BY-SA) */
export function parseOpenFoodFacts(json: unknown, barcode: string): ImageSuggestion[] {
  const product = (json as { product?: Record<string, unknown> })?.product;
  if (!product) return [];
  const urls = [product.image_front_url, product.image_url].filter(
    (u): u is string => typeof u === "string" && isAllowedImageUrl(u),
  );
  const url = urls[0];
  if (!url) return [];
  return [
    {
      url,
      pageUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`,
      credit: "Open Food Facts, CC BY-SA",
      source: "openfoodfacts",
    },
  ];
}

async function getJson(fetcher: Fetch, url: string): Promise<unknown> {
  const res = await fetcher(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const IMAGE_INFO = {
  prop: "imageinfo",
  iiprop: "url|mime|extmetadata",
  iiurlwidth: "400",
  format: "json",
  origin: "*",
};

function commonsUrl(query: string) {
  const params = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: `${query} filetype:bitmap`,
    gsrnamespace: "6",
    gsrlimit: "12",
    ...IMAGE_INFO,
  });
  return `https://commons.wikimedia.org/w/api.php?${params}`;
}

/** שמות קבצי התמונה הראשית של ערכים בוויקיפדיה העברית שמתאימים לשם המוצר */
export function parsePageImages(json: unknown): string[] {
  const pages = (json as { query?: { pages?: Record<string, { pageimage?: string }> } })?.query?.pages;
  if (!pages) return [];
  return Object.values(pages)
    .map((p) => p.pageimage)
    .filter((n): n is string => typeof n === "string" && /\.(jpe?g|png|webp)$/i.test(n));
}

/**
 * התמונות של ערכים בוויקיפדיה העברית (שם המוצר בעברית מוצא שם יותר מאשר בוויקישיתוף).
 * את הרישיון בודקים בוויקישיתוף: קובץ שאינו שם (למשל "שימוש הוגן" מקומי) נפסל.
 */
async function hebrewWikipedia(fetcher: Fetch, query: string): Promise<ImageSuggestion[]> {
  const search = new URLSearchParams({
    action: "query",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "5",
    prop: "pageimages",
    piprop: "name",
    format: "json",
    origin: "*",
  });
  const names = parsePageImages(await getJson(fetcher, `https://he.wikipedia.org/w/api.php?${search}`));
  if (!names.length) return [];
  const info = new URLSearchParams({ action: "query", titles: names.map((n) => `File:${n}`).join("|"), ...IMAGE_INFO });
  return parseCommons(await getJson(fetcher, `https://commons.wikimedia.org/w/api.php?${info}`));
}

/**
 * מחפש תמונות לפי שם המוצר והברקוד. מקור שלא עונה (חסום, איטי) פשוט לא תורם הצעות.
 */
export async function suggestImages(
  input: { name: string; barcode?: string | null },
  fetcher: Fetch = fetch,
): Promise<ImageSuggestion[]> {
  const name = input.name.trim().slice(0, 80);
  const barcode = (input.barcode ?? "").replace(/\D/g, "");
  const jobs: Promise<ImageSuggestion[]>[] = [];
  if (/^\d{8,14}$/.test(barcode)) {
    jobs.push(
      getJson(
        fetcher,
        `https://world.openfoodfacts.org/api/v2/product/${barcode}.json?fields=image_front_url,image_url`,
      ).then((j) => parseOpenFoodFacts(j, barcode)),
    );
  }
  if (name.length >= 2) {
    jobs.push(hebrewWikipedia(fetcher, name));
    jobs.push(getJson(fetcher, commonsUrl(name)).then(parseCommons));
  }
  const settled = await Promise.allSettled(jobs);
  const seen = new Set<string>();
  const out: ImageSuggestion[] = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const s of r.value) {
      if (seen.has(s.url)) continue;
      seen.add(s.url);
      out.push(s);
    }
  }
  return out.slice(0, MAX_SUGGESTIONS);
}

/** קורא את בחירת הספק מהטופס ומוודא שהיא מאחד המאגרים המותרים */
export function readSuggestionChoice(raw: unknown): { url: string; pageUrl: string; credit: string } | null {
  if (typeof raw !== "string" || !raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.url !== "string" || !isAllowedImageUrl(v.url)) return null;
    const pageUrl = typeof v.pageUrl === "string" && /^https:\/\//.test(v.pageUrl) ? v.pageUrl.slice(0, 500) : "";
    const credit = typeof v.credit === "string" ? v.credit.slice(0, 200) : "";
    if (!credit) return null;
    return { url: v.url, pageUrl, credit };
  } catch {
    return null;
  }
}

/**
 * מוריד את התמונה שהספק בחר. מוריד רק מהשרתים המותרים, לא עוקב אחרי הפניות לשרת אחר,
 * ועוצר אם הקובץ גדול מהמותר.
 */
export async function downloadSuggestion(
  url: string,
  maxBytes: number,
  fetcher: Fetch = fetch,
): Promise<Buffer | null> {
  if (!isAllowedImageUrl(url)) return null;
  try {
    const res = await fetcher(url, {
      headers: { "User-Agent": USER_AGENT },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS * 2),
    });
    if (!res.ok || !res.body) return null;
    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > maxBytes) return null;
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}
