/** כתובת הלוגו של הספק, עם הגרסה כדי שלוגו חדש לא יוצג מהמטמון הישן */
export function supplierLogoUrl(supplierId: string, logo: { updatedAt: Date } | null | undefined) {
  return logo ? `/api/supplier-logos/${supplierId}?v=${logo.updatedAt.getTime()}` : null;
}
