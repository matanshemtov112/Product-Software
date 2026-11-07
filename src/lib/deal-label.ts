import { shekels } from "@/lib/format";
import { lastValidDay, shortDate } from "@/lib/price-status";
import type { QuantityDealInput } from "@/lib/engine/quantity-deal";

const qty = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 2 });
/** "240 יחידה" לא נשמע טוב; ליחידות כותבים "יח׳" */
const unitAfterNumber = (unitLabel: string) => (unitLabel === "יחידה" ? "יח׳" : unitLabel);

/** "מבצע כמות: מ-20 ק״ג בהזמנה, 10% הנחה, עד 30.11.2026" */
export function dealLabel(deal: QuantityDealInput, unitLabel: string) {
  const threshold = `מ-${qty(deal.minPerOrder)} ${unitAfterNumber(unitLabel)} בהזמנה`;
  const packs = deal.minPacks ? ` (${deal.minPacks} אריזות)` : "";
  const discount =
    deal.priceAgorot != null ? `${shekels(deal.priceAgorot, 2)} ל${unitLabel}` : `${qty(deal.discountPct ?? 0)}% הנחה`;
  const until = deal.validTo ? `, עד ${shortDate(lastValidDay(deal.validTo))}` : "";
  return `מבצע כמות: ${threshold}${packs}, ${discount}${until}`;
}

/** מה המצב של הלקוח מול המבצע: חל, או כמה חסר בכל הזמנה */
export function dealStatus(deal: { applied: boolean; missingPerOrder: number }, unitLabel: string) {
  return deal.applied
    ? "המבצע חל על הכמות שלכם"
    : `עוד ${qty(deal.missingPerOrder)} ${unitAfterNumber(unitLabel)} בכל הזמנה ותקבלו את המבצע`;
}

/** מבצע כמות מהמסד לצורה של התצוגה */
export function dealInput(d: {
  minPerOrder: number;
  minPacks: number | null;
  discountPct: number | null;
  priceAgorot: number | null;
  validTo: Date | null;
}): QuantityDealInput {
  return { ...d, validTo: d.validTo?.toISOString() ?? null };
}
