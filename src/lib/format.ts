/** סכום באגורות כ"₪1,234" (ללא מע״מ) */
export function shekels(agorot: number, fractionDigits = 0): string {
  return `₪${(agorot / 100).toLocaleString("he-IL", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export const UNIT_LABEL = { KG: "ק״ג", LITER: "ליטר", UNIT: "יחידה" } as const;
