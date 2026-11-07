export interface OfferRow {
  productId: string;
  productName: string;
  unit: string;
  category: string;
  supplierId: string;
  supplierName: string;
  /** מחיר במדרגה הבסיסית; null כשאין מחיר פעיל */
  priceAgorot: number | null;
  /** איך המוצר מגיע אצל הספק, למשל "קרטון 15–20 ק״ג" */
  pack?: string;
}

export interface ProductSuppliers {
  productId: string;
  productName: string;
  unit: string;
  category: string;
  suppliers: { id: string; name: string; priceAgorot: number | null; pack?: string }[];
}

export interface PhotoMatches {
  exact: ProductSuppliers[];
  similar: ProductSuppliers[];
}

/**
 * מקבץ את ההצעות של הספקים לפי המוצרים שזוהו בתמונה, בסדר שהמודל החזיר.
 * בכל מוצר הספקים ממוינים מהזול ליקר; מוצר שאף ספק באזור לא מוכר לא מוצג.
 */
export function groupMatches(identified: { exact: string[]; similar: string[] }, offers: OfferRow[]): PhotoMatches {
  const byName = new Map<string, ProductSuppliers>();
  for (const o of offers) {
    let entry = byName.get(o.productName);
    if (!entry) {
      entry = { productId: o.productId, productName: o.productName, unit: o.unit, category: o.category, suppliers: [] };
      byName.set(o.productName, entry);
    }
    if (!entry.suppliers.some((s) => s.id === o.supplierId)) {
      entry.suppliers.push({ id: o.supplierId, name: o.supplierName, priceAgorot: o.priceAgorot, pack: o.pack });
    }
  }
  for (const entry of byName.values()) {
    entry.suppliers.sort((a, b) => (a.priceAgorot ?? Infinity) - (b.priceAgorot ?? Infinity));
  }
  const take = (names: string[]) => names.flatMap((n) => byName.get(n) ?? []);
  return {
    exact: take(identified.exact),
    similar: take(identified.similar.filter((n) => !identified.exact.includes(n))),
  };
}
