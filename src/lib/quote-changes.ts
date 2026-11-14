import { shekels } from "@/lib/format";

/**
 * מה הלקוח ראה על המסך כשפתח את הדף, כדי לזהות בשליחה שהמחיר השתנה בינתיים.
 * ההצעה עצמה תמיד מחושבת מחדש בשרת; זה רק להשוואה ולאזהרה, לא מקור למחיר.
 */
export interface SeenLine {
  name: string;
  price: number;
  brand?: string;
}

export function seenQuote(lines: { productName: string; unitPriceAgorot: number; brand?: string }[], total: number) {
  return JSON.stringify({
    t: total,
    l: lines.map((l) => [l.productName, l.unitPriceAgorot, l.brand ?? ""]),
  });
}

function parse(seen: string): { total: number; lines: SeenLine[] } | null {
  try {
    const raw = JSON.parse(seen) as { t: unknown; l: unknown };
    if (typeof raw.t !== "number" || !Array.isArray(raw.l)) return null;
    const lines = raw.l
      .filter(
        (x): x is [string, number, string] => Array.isArray(x) && typeof x[0] === "string" && typeof x[1] === "number",
      )
      .map(([name, price, brand]) => ({ name, price, brand: brand || undefined }));
    return { total: raw.t, lines };
  } catch {
    return null;
  }
}

/**
 * השינויים בין מה שהלקוח ראה למה שיישלח עכשיו, כטקסט קצר לכל מוצר.
 * מערך ריק כשאין שינוי (או כשאין מה להשוות).
 */
export function quoteChanges(
  seen: string | null | undefined,
  now: { lines: { productName: string; unitPriceAgorot: number; brand?: string }[]; total: number },
): string[] {
  if (!seen) return [];
  const before = parse(seen);
  if (!before) return [];
  const changes: string[] = [];
  const current = new Map(now.lines.map((l) => [l.productName, l]));
  for (const b of before.lines) {
    const n = current.get(b.name);
    if (!n) {
      changes.push(`${b.name}: הספק כבר לא מציע אותו כרגע`);
      continue;
    }
    if ((n.brand ?? "") !== (b.brand ?? "")) {
      changes.push(`${b.name}: המותג השתנה מ-${b.brand ?? "ללא מותג"} ל-${n.brand ?? "ללא מותג"} (מוצר חלופי)`);
    }
    if (n.unitPriceAgorot !== b.price) {
      changes.push(`${b.name}: ${shekels(b.price, 2)} ← ${shekels(n.unitPriceAgorot, 2)}`);
    }
  }
  for (const n of now.lines) {
    if (!before.lines.some((b) => b.name === n.productName)) changes.push(`${n.productName}: נוסף להצעה`);
  }
  if (changes.length && before.total !== now.total) {
    changes.push(`סה״כ בחודש: ${shekels(before.total)} ← ${shekels(now.total)}`);
  }
  return changes;
}

/** מה שהלקוח ראה, רק למוצרים שבחר לשלוח (בדף מוצגים כל המוצרים, והוא מסמן חלק מהם) */
export function onlyChosen(seen: string, chosen: { productName: string }[]): string | null {
  const before = parse(seen);
  if (!before) return null;
  const names = new Set(chosen.map((c) => c.productName));
  const lines = before.lines.filter((l) => names.has(l.name));
  return seenQuote(
    lines.map((l) => ({ productName: l.name, unitPriceAgorot: l.price, brand: l.brand })),
    0,
  );
}
