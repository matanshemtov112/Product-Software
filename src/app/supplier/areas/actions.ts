"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { isManager } from "@/lib/auth/team";
import { db } from "@/lib/db";
import { isNearIsrael, MAX_RADIUS_KM, MIN_RADIUS_KM } from "@/lib/geo";
import { supplierForUser } from "@/lib/supplier/catalog";

/** מספר העיגולים המרבי לספק: מספיק לכיסוי מדויק של כל הארץ */
const MAX_AREAS = 30;

const areasSchema = z
  .array(
    z.object({
      label: z.string().trim().min(1, "לכל אזור צריך שם").max(60, "שם האזור ארוך מדי"),
      lat: z.number().finite(),
      lng: z.number().finite(),
      radiusKm: z.number().min(MIN_RADIUS_KM).max(MAX_RADIUS_KM),
    }),
  )
  .max(MAX_AREAS, `אפשר לסמן עד ${MAX_AREAS} אזורים`);

export interface AreasState {
  error?: string;
  saved?: boolean;
}

/** שמירת אזורי החלוקה שהספק סימן על המפה (מחליפה את כל האזורים הקודמים) */
export async function saveDeliveryAreas(_: AreasState, form: FormData): Promise<AreasState> {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  if (!(await isManager(session.userId))) return { error: "רק מנהל יכול לשנות את אזורי החלוקה" };

  let raw: unknown;
  try {
    raw = JSON.parse(String(form.get("areas") ?? "[]"));
  } catch {
    return { error: "לא הצלחנו לקרוא את האזורים. נסו שוב." };
  }
  const parsed = areasSchema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "האזורים לא תקינים" };
  if (parsed.data.some((a) => !isNearIsrael(a))) return { error: "אחד האזורים מחוץ לישראל" };

  await db.$transaction([
    db.deliveryArea.deleteMany({ where: { supplierId: supplier.id } }),
    db.deliveryArea.createMany({ data: parsed.data.map((a) => ({ ...a, supplierId: supplier.id })) }),
  ]);
  await audit({
    action: "supplier.areas",
    targetType: "supplier",
    targetId: supplier.id,
    details: { count: parsed.data.length, areas: parsed.data.map((a) => `${a.label} (${a.radiusKm} ק״מ)`) },
  });
  revalidatePath("/supplier", "layout");
  return { saved: true };
}
