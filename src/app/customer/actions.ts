"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/auth/current";
import { basketQuotes, customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { OPEN_INQUIRY } from "@/lib/inquiries";

export interface FormState {
  error?: string;
}

const inquirySchema = z.object({
  supplierId: z.string().min(1),
  message: z.string().trim().min(5, "נא לכתוב כמה מילים לספק").max(1000, "ההודעה ארוכה מדי (עד 1,000 תווים)"),
});

/**
 * פנייה לספק עם ההצעה שהלקוח קיבל. ההצעה והפער מחושבים מחדש כאן, ולא נלקחים מהטופס,
 * כדי שהספק יקבל את המספרים שהמערכת באמת הציגה.
 */
export async function sendInquiry(_: FormState, form: FormData): Promise<FormState> {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const parsed = inquirySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const { supplierId, message } = parsed.data;

  const basket = customer.baskets[0];
  if (!basket) return { error: "אין סל להשוואה" };
  const row = (await basketQuotes(basket.id)).rows.find((r) => r.supplierId === supplierId);
  if (!row) return { error: "הספק הזה לא מציע כרגע מוצרים מהסל שלך" };

  const open = await db.negotiationRequest.findFirst({
    where: { customerId: customer.id, supplierId, status: { in: OPEN_INQUIRY } },
  });
  if (open) return { error: "כבר שלחת פנייה לספק הזה והיא ממתינה לתשובה" };

  await db.negotiationRequest.create({
    data: {
      customerId: customer.id,
      supplierId,
      gapAgorot: row.quote.gapAgorot,
      totalAgorot: row.snapshot.totalAgorot,
      quote: JSON.parse(JSON.stringify(row.snapshot)),
      message,
    },
  });
  revalidatePath("/customer");
  redirect("/customer?sent=1#inquiries");
}
