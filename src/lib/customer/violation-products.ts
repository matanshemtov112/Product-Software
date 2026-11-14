import { supplierPriceList } from "@/lib/customer/catalog";
import { UNIT_LABEL } from "@/lib/format";
import type { ViolationProduct } from "@/components/report/price-violation-button";

/** המוצרים של ספק לטופס דיווח על הפרת מחיר */
export async function violationProducts(supplierId: string): Promise<ViolationProduct[]> {
  const list = await supplierPriceList(supplierId);
  return (list?.items ?? []).map((i) => ({
    id: i.product.id,
    name: i.product.name,
    unitLabel: UNIT_LABEL[i.product.unit] ?? i.product.unit,
    priceAgorot: i.priceAgorot,
  }));
}
