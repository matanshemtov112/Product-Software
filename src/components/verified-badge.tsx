import { verifiedSupplierIds } from "@/lib/verification-sync";

/**
 * תגית ליד שם ספק: "ספק מאומת" כשהמסמכים שלו נבדקו ואושרו, אחרת "טרם אומת".
 * רכיב שרת: בודק מול רשימת המאומתים, שנטענת פעם אחת לכל עמוד.
 */
export async function VerifiedBadge({
  supplierId,
  compact = false,
}: {
  supplierId: string | null | undefined;
  compact?: boolean;
}) {
  if (!supplierId) return null;
  const verified = (await verifiedSupplierIds()).has(supplierId);
  return verified ? (
    <span
      className="ms-1 inline-flex items-center gap-0.5 rounded bg-accent-soft px-1.5 py-0.5 align-middle text-xs font-medium text-accent"
      title="המסמכים של הספק נבדקו ואושרו על ידי צוות הפלטפורמה"
    >
      ✓{compact ? "" : " ספק מאומת"}
    </span>
  ) : (
    <span
      className="ms-1 inline-flex rounded bg-background px-1.5 py-0.5 align-middle text-xs text-muted"
      title="הספק עוד לא העביר מסמכים לבדיקה, או שהם עדיין בבדיקה"
    >
      טרם אומת
    </span>
  );
}
