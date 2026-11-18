"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth/current";
import { customerForUser } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { ENDED_STAGES, inquiryStage, matchStage } from "@/lib/offer-status";

/** פניות שהסתיימו אפשר להסתיר מהרשימה; פנייה פתוחה מבטלים קודם */
const ENDED = ENDED_STAGES;

async function customerId() {
  const session = await requireRole("CUSTOMER");
  return (await customerForUser(session.userId)).id;
}

const field = (form: FormData, name: string) => String(form.get(name) ?? "");

function done(form: FormData) {
  revalidatePath("/customer", "layout");
  // חוזרים לדף שממנו נמחק (רק כתובת פנימית של אזור הלקוח)
  const back = field(form, "back");
  redirect(back.startsWith("/customer/") ? back : "/customer/history?deleted=1");
}

/** מחיקה מיידית של חשבונית (השורות שנקראו ממנה); הסל שנוצר ממנה לא נמחק */
export async function deleteInvoice(form: FormData) {
  const id = await customerId();
  const { count } = await db.invoice.deleteMany({ where: { id: field(form, "id"), customerId: id } });
  if (count) await audit({ action: "invoice.deleted", targetType: "invoice", targetId: field(form, "id") });
  done(form);
}

export async function deleteAllInvoices(form: FormData) {
  const id = await customerId();
  const { count } = await db.invoice.deleteMany({ where: { customerId: id } });
  if (count) await audit({ action: "invoices.deleted", targetType: "customer", targetId: id, details: { count } });
  done(form);
}

/** מחיקת בדיקת מחירים שמורה אחת של סל */
export async function deleteCheck(form: FormData) {
  const id = await customerId();
  await db.optimizationRun.deleteMany({ where: { id: field(form, "id"), basket: { customerId: id } } });
  done(form);
}

/** מחיקת כל הבדיקות השמורות של סל; הסל עצמו נשאר */
export async function deleteBasketChecks(form: FormData) {
  const id = await customerId();
  await db.optimizationRun.deleteMany({ where: { basketId: field(form, "basketId"), basket: { customerId: id } } });
  done(form);
}

/**
 * הסתרה או מחיקה של פנייה/בקשת השוואה שהסתיימה, מהרשימה של הלקוח.
 * הסתרה אפשר להחזיר; מחיקה היא לצמיתות. אצל הספק הפנייה נשארת בכל מקרה.
 */
async function setOfferGone(form: FormData, deleted: boolean) {
  const id = await customerId();
  const offerId = field(form, "id");
  const now = new Date();
  const data = deleted ? { customerHiddenAt: now, customerDeletedAt: now } : { customerHiddenAt: now };
  if (field(form, "kind") === "match") {
    const m = await db.matchRequest.findFirst({ where: { id: offerId, customerId: id } });
    if (m && ENDED.includes(matchStage(m, now))) await db.matchRequest.update({ where: { id: m.id }, data });
  } else {
    const i = await db.negotiationRequest.findFirst({ where: { id: offerId, customerId: id } });
    if (i && ENDED.includes(inquiryStage(i, now))) await db.negotiationRequest.update({ where: { id: i.id }, data });
  }
  done(form);
}

export async function hideOffer(form: FormData) {
  await setOfferGone(form, false);
}

export async function deleteOffer(form: FormData) {
  await setOfferGone(form, true);
}

/** החזרת כל הפניות שהוסתרו (לא אלה שנמחקו) לרשימה */
export async function unhideOffers(form: FormData) {
  const id = await customerId();
  await db.negotiationRequest.updateMany({
    where: { customerId: id, customerDeletedAt: null },
    data: { customerHiddenAt: null },
  });
  await db.matchRequest.updateMany({
    where: { customerId: id, customerDeletedAt: null },
    data: { customerHiddenAt: null },
  });
  done(form);
}

/**
 * ניקוי כל ההיסטוריה: כל החשבוניות, כל בדיקות המחירים השמורות, והסתרת כל הפניות שהסתיימו.
 * הסלים, פניות פתוחות ופרטי העסק נשארים.
 */
export async function clearHistory(form: FormData) {
  const id = await customerId();
  const now = new Date();
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({ where: { customerId: id, customerHiddenAt: null } }),
    db.matchRequest.findMany({ where: { customerId: id, customerHiddenAt: null } }),
  ]);
  const [invoices, checks] = await db.$transaction([
    db.invoice.deleteMany({ where: { customerId: id } }),
    db.optimizationRun.deleteMany({ where: { basket: { customerId: id } } }),
    db.negotiationRequest.updateMany({
      where: { id: { in: inquiries.filter((i) => ENDED.includes(inquiryStage(i, now))).map((i) => i.id) } },
      data: { customerHiddenAt: now },
    }),
    db.matchRequest.updateMany({
      where: { id: { in: matches.filter((m) => ENDED.includes(matchStage(m, now))).map((m) => m.id) } },
      data: { customerHiddenAt: now },
    }),
  ]);
  await audit({
    action: "history.cleared",
    targetType: "customer",
    targetId: id,
    details: { invoices: invoices.count, checks: checks.count },
  });
  done(form);
}
