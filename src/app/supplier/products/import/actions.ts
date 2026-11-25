"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { deniedMessage } from "@/lib/auth/permission-check";
import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { notifyPriceChange } from "@/lib/notifications";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { supplierForUser } from "@/lib/supplier/catalog";
import {
  type Cell,
  decodeCsv,
  MAX_SHEET_BYTES,
  MAX_SHEET_ROWS,
  parseCsv,
  type Preview,
  previewSheet,
} from "@/lib/supplier/price-sheet";
import { loadSheetOffers, loadSheetTiers } from "@/lib/supplier/price-sheet-load";
import { closeOpenPrices, lockOffer } from "@/lib/supplier/prices";
import { priceChangeStatus } from "@/lib/supplier/pricing-rules";

export interface ImportState {
  error?: string;
  preview?: Preview;
  fileName?: string;
  done?: { prices: number; held: number; availability: number; skipped: number };
}

async function importer() {
  const session = await requireRole("SUPPLIER");
  const denied = await deniedMessage("prices", session.userId);
  if (denied) return { denied };
  return { supplier: await supplierForUser(session.userId), userId: session.userId };
}

async function readRows(file: File): Promise<Cell[][] | { error: string }> {
  const name = file.name.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (name.endsWith(".csv") || name.endsWith(".txt")) return parseCsv(decodeCsv(bytes));
  if (name.endsWith(".xlsx")) {
    // קובץ אקסל הוא zip: בודקים את החתימה לפני שפותחים אותו
    if (bytes[0] !== 0x50 || bytes[1] !== 0x4b) return { error: "הקובץ לא נראה כמו קובץ אקסל תקין" };
    try {
      const { readSheet } = await import("read-excel-file/node");
      return (await readSheet(Buffer.from(bytes))) as Cell[][];
    } catch {
      return { error: "לא הצלחנו לקרוא את קובץ האקסל. נסו לשמור אותו שוב, או כקובץ CSV" };
    }
  }
  if (name.endsWith(".xls")) return { error: "זה פורמט אקסל ישן. באקסל: קובץ ← שמירה בשם ← בחרו ‎.xlsx או CSV" };
  return { error: "אפשר להעלות קובץ אקסל (‎.xlsx) או CSV" };
}

/** שלב 1: קריאת הקובץ והשוואה למחירון הנוכחי. שום דבר לא נשמר */
export async function previewImport(_: ImportState, form: FormData): Promise<ImportState> {
  const who = await importer();
  if ("denied" in who) return { error: who.denied };
  if (!(await rateLimit.hit(`pricelist:${who.supplier.id}`, LIMITS.priceImports))) {
    return { error: "העליתם הרבה קבצים בזמן קצר. נסו שוב בעוד כמה דקות." };
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "נא לבחור קובץ" };
  if (file.size > MAX_SHEET_BYTES) return { error: "הקובץ גדול מדי (עד 1MB)" };
  const rows = await readRows(file);
  if ("error" in rows) return { error: rows.error };
  if (rows.length > MAX_SHEET_ROWS + 5) return { error: `אפשר להעלות עד ${MAX_SHEET_ROWS} שורות בקובץ אחד` };
  const [offers, tiers] = await Promise.all([loadSheetOffers(who.supplier.id), loadSheetTiers(who.supplier.id)]);
  if (offers.length === 0) return { error: "עוד אין לכם מוצרים ברשימה. הוסיפו מוצרים, ואז אפשר לעדכן מחירים מקובץ." };
  const preview = previewSheet(rows, offers, tiers, (from, to) => priceChangeStatus(from, to) === "PENDING_APPROVAL");
  if ("error" in preview) return { error: preview.error };
  return { preview, fileName: file.name.slice(0, 80) };
}

const applySchema = z.array(
  z.object({
    offerId: z.string().min(1).max(40),
    available: z.boolean().optional(),
    changes: z
      .array(
        z.object({
          tierId: z.string().min(1).max(40),
          fromAgorot: z.number().int().nullable(),
          toAgorot: z.number().int().positive().max(100_000_000),
        }),
      )
      .max(20),
  }),
);

/**
 * שלב 2: שמירת השורות שהספק אישר. כל מוצר נשמר עם נעילה, כמו בעריכה רגילה: שינוי של יותר מ-30% ממתין לאישור,
 * ההיסטוריה נשמרת, והלקוחות מקבלים התראה. מוצר שהמחיר שלו השתנה מאז התצוגה המקדימה לא נשמר (כדי לא לדרוס).
 */
export async function applyImport(_: ImportState, form: FormData): Promise<ImportState> {
  const who = await importer();
  if ("denied" in who) return { error: who.denied };
  const { supplier } = who;
  let input: z.infer<typeof applySchema>;
  try {
    input = applySchema.parse(JSON.parse(String(form.get("rows") ?? "[]")));
  } catch {
    return { error: "הנתונים לא תקינים. העלו את הקובץ שוב." };
  }
  if (input.length === 0) return { error: "לא נבחרו שורות לשמירה" };
  if (input.length > MAX_SHEET_ROWS) return { error: `אפשר לשמור עד ${MAX_SHEET_ROWS} שורות בבת אחת` };

  const tiers = await loadSheetTiers(supplier.id);
  const tierById = new Map(tiers.map((t) => [t.id, t]));
  const owned = await db.supplierOffer.findMany({
    where: { id: { in: input.map((r) => r.offerId) }, supplierId: supplier.id, archivedAt: null },
    select: { id: true, productId: true, product: { select: { name: true, unit: true } } },
  });
  const offerById = new Map(owned.map((o) => [o.id, o]));

  const audits: Parameters<typeof audit>[0][] = [];
  const alerts: Parameters<typeof notifyPriceChange>[0][] = [];
  let prices = 0;
  let held = 0;
  let availability = 0;
  let skipped = 0;
  for (const row of input) {
    const offer = offerById.get(row.offerId);
    if (!offer || row.changes.some((c) => !tierById.has(c.tierId))) {
      skipped++;
      continue;
    }
    const result = await db.$transaction(
      async (tx) => {
        await lockOffer(tx, offer.id);
        const at = new Date();
        const live = await tx.offerPrice.findMany({
          where: {
            offerId: offer.id,
            status: "LIVE",
            validFrom: { lte: at },
            OR: [{ validTo: null }, { validTo: { gt: at } }],
          },
          orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
        });
        // המחיר השתנה מאז התצוגה המקדימה (איש צוות אחר, לשונית אחרת): לא דורסים
        for (const c of row.changes) {
          const regular = live.find((p) => p.tierId === c.tierId && p.kind === "REGULAR");
          if ((regular?.unitPriceAgorot ?? null) !== c.fromAgorot) return { stale: true as const };
        }
        let changed = 0;
        let pending = 0;
        for (const c of row.changes) {
          const tier = tierById.get(c.tierId)!;
          const regular = live.find((p) => p.tierId === c.tierId && p.kind === "REGULAR") ?? null;
          const promo = live.find((p) => p.tierId === c.tierId && p.kind === "PROMOTION") ?? null;
          const status = priceChangeStatus(regular?.unitPriceAgorot ?? null, c.toAgorot);
          if (status === "PENDING_APPROVAL") pending++;
          await tx.offerPrice.updateMany({
            where: { offerId: offer.id, tierId: tier.id, kind: "REGULAR", status: "PENDING_APPROVAL" },
            data: { status: "REJECTED" },
          });
          if (status === "LIVE") await closeOpenPrices(tx, { offerId: offer.id, tierId: tier.id, kind: "REGULAR", at });
          await tx.offerPrice.create({
            data: {
              offerId: offer.id,
              tierId: tier.id,
              unitPriceAgorot: c.toAgorot,
              status,
              kind: "REGULAR",
              validFrom: at,
              validTo: null,
              termEndsAt: null,
            },
          });
          changed++;
          audits.push({
            action: status === "LIVE" ? "price.changed" : "price.held",
            targetType: "offer",
            targetId: offer.id,
            details: {
              supplier: supplier.companyName,
              tier: tier.name,
              from: regular?.unitPriceAgorot ?? null,
              to: c.toAgorot,
              type: "FIXED",
              source: "import",
            },
          });
          const before =
            promo && regular
              ? Math.min(promo.unitPriceAgorot, regular.unitPriceAgorot)
              : (regular?.unitPriceAgorot ?? null);
          const after = promo ? Math.min(promo.unitPriceAgorot, c.toAgorot) : c.toAgorot;
          if (status === "LIVE" && tier.minMonthlyAgorot === 0 && before !== after) {
            alerts.push({
              supplierId: supplier.id,
              supplierName: supplier.companyName,
              productId: offer.productId,
              productName: offer.product.name,
              unitLabel: UNIT_LABEL[offer.product.unit],
              oldAgorot: before,
              newAgorot: after,
            });
          }
        }
        let availChanged = false;
        if (row.available !== undefined) {
          const r = await tx.supplierOffer.updateMany({
            where: { id: offer.id, available: !row.available },
            data: { available: row.available },
          });
          availChanged = r.count > 0;
        }
        return { stale: false as const, changed, pending, availChanged };
      },
      { timeout: 20_000 },
    );
    if (result.stale) {
      skipped++;
      continue;
    }
    prices += result.changed - result.pending;
    held += result.pending;
    if (result.availChanged) availability++;
  }

  for (const entry of audits) await audit(entry);
  await audit({
    action: "pricelist.imported",
    targetType: "supplier",
    targetId: supplier.id,
    details: { file: String(form.get("fileName") ?? ""), prices, held, availability, skipped },
  });
  for (const alert of alerts) await notifyPriceChange(alert);
  revalidatePath("/supplier", "layout");
  return { done: { prices, held, availability, skipped } };
}
