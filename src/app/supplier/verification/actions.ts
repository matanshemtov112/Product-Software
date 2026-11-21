"use server";

import type { DocumentKind } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { isManager } from "@/lib/auth/team";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";
import { DOC_LABEL, detectDocType, MAX_DOC_BYTES } from "@/lib/verification";
import { syncVerification } from "@/lib/verification-sync";

export interface DocFormState {
  error?: string;
  saved?: boolean;
}

async function managedSupplier() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  return { supplier, manager: await isManager(session.userId) };
}

/** העלאת מסמך לאימות. מסמך חדש מאותו סוג מחליף את הקודם וחוזר לבדיקה */
export async function uploadDocument(_: DocFormState, form: FormData): Promise<DocFormState> {
  const { supplier, manager } = await managedSupplier();
  if (!manager) return { error: "רק מנהל יכול להעלות מסמכים" };
  const kind = String(form.get("kind") ?? "") as DocumentKind;
  if (!(kind in DOC_LABEL)) return { error: "סוג מסמך לא מוכר" };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "נא לבחור קובץ" };
  if (file.size > MAX_DOC_BYTES) return { error: "הקובץ גדול מדי (עד 5MB)" };
  const data = Buffer.from(await file.arrayBuffer());
  const contentType = detectDocType(data);
  if (!contentType) return { error: "אפשר להעלות PDF, JPG או PNG" };
  const rawDate = String(form.get("validUntil") ?? "");
  const validUntil = rawDate ? new Date(`${rawDate}T23:59:59`) : null;
  if (validUntil && (Number.isNaN(validUntil.getTime()) || validUntil <= new Date())) {
    return { error: "התוקף של המסמך כבר עבר. נא להעלות מסמך בתוקף" };
  }
  const fields = {
    fileName: file.name.slice(0, 120) || "מסמך",
    data,
    contentType,
    size: file.size,
    validUntil,
    status: "PENDING" as const,
    rejectReason: null,
    reviewedAt: null,
  };
  await db.supplierDocument.upsert({
    where: { supplierId_kind: { supplierId: supplier.id, kind } },
    create: { supplierId: supplier.id, kind, ...fields },
    update: fields,
  });
  await audit({
    action: "supplier.document",
    targetType: "supplier",
    targetId: supplier.id,
    details: { kind: DOC_LABEL[kind], file: fields.fileName },
  });
  await syncVerification(supplier.id);
  revalidatePath("/supplier", "layout");
  revalidatePath("/admin", "layout");
  return { saved: true };
}

/** "אנחנו מפעל שמייצר": משנה אילו מסמכים נדרשים */
export async function setManufacturer(form: FormData) {
  const { supplier, manager } = await managedSupplier();
  if (!manager) return;
  await db.supplier.update({
    where: { id: supplier.id },
    data: { isManufacturer: form.get("isManufacturer") === "yes" },
  });
  await syncVerification(supplier.id);
  revalidatePath("/supplier", "layout");
}
