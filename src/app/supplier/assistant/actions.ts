"use server";

import { revalidatePath } from "next/cache";
import { cancelNote, confirmAction, parseHistory, runAgent } from "@/lib/agent/core";
import type { ConfirmResult, TurnResult } from "@/lib/agent/types";
import { supplierSystem } from "@/lib/agent/supplier/prompt";
import { supplierTools, type SupplierCtx } from "@/lib/agent/supplier/tools";
import { requireRole } from "@/lib/auth/current";
import { supplierForUser } from "@/lib/supplier/catalog";

/** ההקשר של העוזר: המשתמש המחובר והספק שלו, מהמסד בכל קריאה (לא מהדפדפן) */
async function context(): Promise<SupplierCtx> {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  return { userId: session.userId, org: { supplier: { id: supplier.id, companyName: supplier.companyName } } };
}

export async function sendToSupplierAgent(rawHistory: unknown, text: string): Promise<TurnResult> {
  const ctx = await context();
  const history = parseHistory(rawHistory);
  if (!history) {
    return { history: [], display: [{ type: "error", text: "השיחה ארוכה מדי או לא תקינה. התחילו שיחה חדשה." }] };
  }
  return runAgent({
    side: "supplier",
    system: supplierSystem(ctx.org.supplier.companyName),
    tools: supplierTools,
    ctx,
    history,
    userText: String(text ?? ""),
    limitKey: `supplier:${ctx.userId}`,
  });
}

export async function confirmSupplierAction(token: string): Promise<ConfirmResult> {
  const ctx = await context();
  const result = await confirmAction({ side: "supplier", token: String(token ?? ""), tools: supplierTools, ctx });
  if (result.ok) revalidatePath("/supplier", "layout");
  return result;
}

export async function cancelSupplierAction(title: string): Promise<string> {
  await requireRole("SUPPLIER");
  return cancelNote(String(title ?? "").slice(0, 200));
}
