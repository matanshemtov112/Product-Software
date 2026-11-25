import { cache } from "react";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { notify } from "@/lib/notifications";
import { verification } from "@/lib/verification";

/**
 * מחשב מחדש אם הספק מאומת (אחרי העלאה, בדיקה או שינוי "מפעל"), ושומר את התאריכים.
 * הספק מקבל התראה כשהוא נהיה מאומת, או כשהאימות בוטל.
 */
export async function syncVerification(supplierId: string, now = new Date()) {
  const supplier = await db.supplier.findUnique({
    where: { id: supplierId },
    include: { documents: { select: { kind: true, status: true, validUntil: true } } },
  });
  if (!supplier) return;
  const v = verification(supplier.documents, supplier.isManufacturer, now);
  const was = Boolean(supplier.verifiedAt);
  await db.supplier.update({
    where: { id: supplierId },
    data: v.verified
      ? { verifiedAt: supplier.verifiedAt ?? now, verifiedUntil: v.until }
      : { verifiedAt: null, verifiedUntil: null },
  });
  if (v.verified === was) return;
  await notify([
    {
      supplierId,
      kind: "VERIFICATION",
      title: v.verified ? "החשבון שלכם אומת ✓" : "החשבון שלכם כבר לא מאומת",
      body: v.verified
        ? 'הלקוחות רואים עכשיו את התגית "ספק מאומת" ליד השם שלכם, גם בהשוואות.'
        : "חסר מסמך, מסמך נדחה או שהתוקף שלו עבר. העלו מסמך מעודכן בעמוד אימות החשבון.",
      href: "/supplier/verification",
    },
  ]);
  await audit({
    action: v.verified ? "supplier.verified" : "supplier.unverified",
    targetType: "supplier",
    targetId: supplierId,
    details: { supplier: supplier.companyName },
  });
}

/** הספקים המאומתים כרגע, פעם אחת לכל בקשה */
export const verifiedSupplierIds = cache(async (): Promise<Set<string>> => {
  const now = new Date();
  const rows = await db.supplier.findMany({
    where: { verifiedAt: { not: null }, OR: [{ verifiedUntil: null }, { verifiedUntil: { gt: now } }] },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
});
