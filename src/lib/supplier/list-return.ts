// חזרה לרשימת המוצרים של הספק אחרי עריכה: לאותו חיפוש, אותה תצוגה ואותו מוצר, בלי לקפוץ לראש הרשימה

const KEYS = ["q", "category", "view"] as const;

/** הפרמטרים של הרשימה כפי שהם עכשיו, כמחרוזת שנשמרת בקישור לעריכה */
export function listQuery(params: Partial<Record<(typeof KEYS)[number], string | undefined>>) {
  const out = new URLSearchParams();
  for (const k of KEYS) if (params[k]) out.set(k, params[k]!);
  return out.toString();
}

/** הכתובת לחזרה: רק הפרמטרים המותרים (לא כתובת חיצונית), עם המוצר שנשמר כדי לגלול אליו */
export function listUrl(back: unknown, savedOfferId?: string) {
  const parsed = new URLSearchParams(typeof back === "string" ? back : "");
  const out = new URLSearchParams();
  for (const k of KEYS) {
    const v = parsed.get(k);
    if (v) out.set(k, v.slice(0, 100));
  }
  if (savedOfferId) out.set("saved", savedOfferId);
  const query = out.toString();
  return `/supplier${query ? `?${query}` : ""}${savedOfferId ? `#offer-${savedOfferId}` : ""}`;
}
