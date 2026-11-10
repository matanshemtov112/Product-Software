"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { mySuppliers } from "@/lib/customer/my-suppliers";
import { customerProfile } from "@/lib/customer/profile";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notifications";
import { isValid, matchCandidates, offeredPrice, OPEN_MATCH, validCeiling } from "@/lib/matches";
import { parseShekels } from "@/lib/supplier/pricing-rules";

export interface MatchFormState {
  error?: string;
}

async function currentCustomer() {
  const session = await requireRole("CUSTOMER");
  return customerForUser(session.userId);
}

/** שליחת בקשה לספק הנוכחי להשוות מחירים. המחירים מחושבים מחדש בשרת, לא נלקחים מהטופס */
export async function sendMatchRequest(_: MatchFormState, form: FormData): Promise<MatchFormState> {
  const customer = await currentCustomer();
  const key = String(form.get("key") ?? "");
  const supplier = (await mySuppliers(customer.id)).find((s) => s.key === key);
  if (!supplier?.supplierId) return { error: "הספק הזה לא רשום במערכת. אפשר לשלוח לו את ההודעה בוואטסאפ" };
  const chosen = new Set(form.getAll("product").map(String));
  const lines = matchCandidates(supplier.lines).filter((c) => chosen.has(c.productId));
  if (lines.length === 0) return { error: "נא לסמן לפחות מוצר אחד" };
  // איך להציג לספק: המחיר שנמצא, או רק סף שהלקוח קבע (לא נמוך מהמחיר שנמצא, כדי שההודעה תהיה נכונה)
  const reveal = form.get("reveal") === "CEILING" ? "CEILING" : "EXACT";
  const shown = new Map<string, number>();
  if (reveal === "CEILING") {
    for (const l of lines) {
      const ceiling = parseShekels(form.get(`ceiling_${l.productId}`));
      if (ceiling === null || !validCeiling(ceiling, l.targetPriceAgorot, l.currentPriceAgorot)) {
        return { error: `הסף ל"${l.productName}" צריך להיות בין המחיר שמצאנו למחיר שאתם משלמים היום` };
      }
      shown.set(l.productId, ceiling);
    }
  }
  if (!rateLimit.hit(`inquiry:${customer.id}`, LIMITS.inquiries)) {
    return { error: "שלחתם הרבה פניות היום. נסו שוב מחר." };
  }
  const open = await db.matchRequest.findFirst({
    where: { customerId: customer.id, supplierId: supplier.supplierId, status: { in: OPEN_MATCH } },
  });
  if (open) return { error: "כבר יש בקשה פתוחה לספק הזה. אפשר לשלוח חדשה אחרי שיענה" };

  const basketId = supplier.baskets[0]?.id ?? null;
  const basket = basketId ? await db.basket.findUnique({ where: { id: basketId }, include: { items: true } }) : null;
  const message =
    String(form.get("message") ?? "")
      .trim()
      .slice(0, 1000) || null;
  const request = await db.matchRequest.create({
    data: {
      customerId: customer.id,
      supplierId: supplier.supplierId,
      basketId,
      message,
      reveal,
      customerProfile: basket ? JSON.parse(JSON.stringify(await customerProfile(customer.id, basket))) : undefined,
      lines: {
        create: lines.map((l) => ({
          productId: l.productId,
          productName: l.productName,
          unit: l.unit,
          monthlyQuantity: l.monthlyQuantity,
          currentPriceAgorot: l.currentPriceAgorot,
          targetPriceAgorot: l.targetPriceAgorot,
          shownPriceAgorot: shown.get(l.productId) ?? null,
        })),
      },
    },
  });
  await notify([
    {
      supplierId: supplier.supplierId,
      kind: "NEW_MATCH_REQUEST",
      title: `${customer.businessName} מבקשים שתשוו מחירים ל-${lines.length} מוצרים`,
      body: "לקוח קיים שלכם מצא מחירים זולים יותר ורוצה להמשיך לעבוד איתכם.",
      href: `/supplier/matches/${request.id}`,
    },
  ]);
  revalidatePath("/customer", "layout");
  redirect(`/customer/matches/${request.id}?sent=1`);
}

/**
 * הלקוח מאשר או דוחה את תשובת הספק לשורה. אישור מעדכן את "המחיר היום" בסל,
 * כך שההשוואות הבאות יתחילו מהמחיר החדש.
 */
export async function decideMatchLine(form: FormData) {
  const customer = await currentCustomer();
  const lineId = String(form.get("lineId") ?? "");
  const decision = form.get("decision") === "ACCEPTED" ? "ACCEPTED" : "REJECTED";
  const line = await db.matchRequestLine.findFirst({
    where: { id: lineId, request: { customerId: customer.id } },
    include: { request: { include: { lines: true } } },
  });
  if (!line || line.decision !== "PENDING") return;
  const price = offeredPrice(line);
  if (price === null) return;
  if (decision === "ACCEPTED" && !isValid(line.request.validUntil)) return;

  await db.matchRequestLine.update({ where: { id: line.id }, data: { decision, decidedAt: new Date() } });
  const basketId = line.request.basketId;
  if (decision === "ACCEPTED" && basketId) {
    await db.basketItem.updateMany({
      where: { basketId, productId: line.productId },
      data: { currentUnitPriceAgorot: price },
    });
  }
  // כשכל ההצעות קיבלו החלטה, הבקשה מסתיימת
  const pending = line.request.lines.some(
    (l) => l.id !== line.id && l.decision === "PENDING" && offeredPrice(l) !== null,
  );
  if (!pending) {
    await db.matchRequest.update({ where: { id: line.requestId }, data: { status: "CLOSED" } });
    const lines = line.request.lines.map((l) => (l.id === line.id ? { ...l, decision } : l));
    const accepted = lines.filter((l) => l.decision === "ACCEPTED").length;
    await notify([
      {
        supplierId: line.request.supplierId,
        kind: "MATCH_DECIDED",
        title: `${customer.businessName} ${accepted ? `אישרו ${accepted} מחירים מההצעה שלכם` : "לא אישרו את ההצעה שלכם"}`,
        href: `/supplier/matches/${line.requestId}`,
        dedupeKey: `match-decided:${line.requestId}`,
      },
    ]);
  }
  revalidatePath("/customer", "layout");
  redirect(`/customer/matches/${line.requestId}`);
}
