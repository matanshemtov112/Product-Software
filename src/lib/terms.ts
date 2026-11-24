// תנאי תשלום ותנאי אספקה כפי שהלקוח רואה אותם

/** האפשרויות לתנאי תשלום ללקוח מסוים: 0 = מזומן / בעת האספקה, אחרת שוטף + ימים */
export const PAYMENT_TERM_OPTIONS = [0, 30, 45, 60, 90, 120];

export function paymentTermsLabel(days: number) {
  return days === 0 ? "מזומן / בעת האספקה" : `שוטף + ${days}`;
}

/** תנאי התשלום שהלקוח רואה לפני שיש לו הצעה אישית */
export function publicPaymentTerms(s: { paymentTermsDays: number; paymentTermsPerCustomer: boolean }) {
  return s.paymentTermsPerCustomer ? "נקבעים מול כל לקוח" : paymentTermsLabel(s.paymentTermsDays);
}

/** תנאי תשלום מהטופס: ריק = לא צוין */
export function parsePaymentTerms(value: FormDataEntryValue | null): number | null | undefined {
  if (value === null || value === "") return null;
  const n = Number(value);
  return PAYMENT_TERM_OPTIONS.includes(n) ? n : undefined;
}

export const WEEK_DAYS = ["א", "ב", "ג", "ד", "ה", "ו"] as const;

export interface AreaTerms {
  deliveryDays?: string | null;
  orderCutoff?: string | null;
  deliveryNote?: string | null;
}

/** ימי אספקה תקינים בסדר השבוע, למשל "א,ג,ה"; null כשלא נבחר יום */
export function normalizeDays(days: string[]): string | null {
  const set = new Set(days);
  const ordered = WEEK_DAYS.filter((d) => set.has(d));
  return ordered.length ? ordered.join(",") : null;
}

/** שעה תקינה hh:mm, או null */
export function normalizeCutoff(value: string | null | undefined): string | null {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((value ?? "").trim());
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

/** תנאי האספקה של אזור במשפט אחד, או null כשלא מולאו */
export function areaTermsText(t: AreaTerms): string | null {
  const parts: string[] = [];
  if (t.deliveryDays) {
    const days = t.deliveryDays.split(",");
    parts.push(
      days.length === WEEK_DAYS.length
        ? "אספקה בכל יום א׳ עד ו׳"
        : `אספקה בימים ${days.map((d) => `${d}׳`).join(", ")}`,
    );
  }
  if (t.orderCutoff) parts.push(`הזמנה עד ${t.orderCutoff} מגיעה באספקה הבאה`);
  if (t.deliveryNote) parts.push(t.deliveryNote);
  return parts.length ? parts.join(". ") + (t.deliveryNote?.match(/[.!?]$/) ? "" : ".") : null;
}

/** כמה פעמים בשבוע ספק מגיע ללקוח, ובאילו ימים אם הם קבועים */
export interface DeliveryFrequency {
  perWeek: number;
  days: string[] | null;
}

export const MAX_DELIVERIES_PER_WEEK = WEEK_DAYS.length;

/**
 * לפי מה שהספק בחר: מספר פעמים בשבוע (PER_WEEK), או הימים הקבועים באזור של הלקוח (BY_AREA).
 * ספק שעוד לא בחר מוצג לפי ימי האזור, אם מילא כאלה. null כשאין מה להציג.
 */
export function deliveryFrequency(
  schedule: "BY_AREA" | "PER_WEEK" | null | undefined,
  perWeek: number | null | undefined,
  areaDays: string | null | undefined,
): DeliveryFrequency | null {
  if (schedule === "PER_WEEK") {
    return perWeek && perWeek >= 1 && perWeek <= MAX_DELIVERIES_PER_WEEK ? { perWeek, days: null } : null;
  }
  const days = (areaDays ?? "")
    .split(",")
    .map((d) => d.trim())
    .filter((d) => (WEEK_DAYS as readonly string[]).includes(d));
  return days.length ? { perWeek: days.length, days } : null;
}

/** "פעם בשבוע", "פעמיים בשבוע", "3 פעמים בשבוע" */
export function timesPerWeekText(n: number): string {
  if (n === 1) return "פעם בשבוע";
  if (n === 2) return "פעמיים בשבוע";
  if (n >= MAX_DELIVERIES_PER_WEEK) return "כל יום, א׳ עד ו׳";
  return `${n} פעמים בשבוע`;
}

/** המשפט שהלקוח רואה, למשל "3 פעמים בשבוע (א׳, ג׳, ה׳)" */
export function deliveryFrequencyText(f: DeliveryFrequency | null): string | null {
  if (!f) return null;
  const base = timesPerWeekText(f.perWeek);
  if (!f.days || f.perWeek >= MAX_DELIVERIES_PER_WEEK) return base;
  return `${base} (${f.days.map((d) => `${d}׳`).join(", ")})`;
}
