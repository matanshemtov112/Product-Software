"use server";

import { requireRole } from "@/lib/auth/current";
import { cancelNote, confirmAction, parseHistory, runAgent } from "@/lib/agent/core";
import { CUSTOMER_SYSTEM } from "@/lib/agent/customer/prompt";
import { CUSTOMER_TOOLS, type CustomerOrg } from "@/lib/agent/customer/tools";
import type { AgentContext, ConfirmResult, TurnResult } from "@/lib/agent/types";
import { customerForUser } from "@/lib/customer/quotes";
import { customerFakeCall, customerFakeEnabled } from "@/lib/agent/customer/dev-fake";

/** המשתמש המחובר והמסעדה שלו; נבדק מחדש בכל הודעה */
async function context(): Promise<AgentContext<CustomerOrg>> {
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  return { userId: session.userId, org: { customerId: customer.id, businessName: customer.businessName } };
}

export async function customerAgentTurn(rawHistory: unknown, text: string): Promise<TurnResult> {
  const ctx = await context();
  const history = parseHistory(rawHistory);
  if (!history) {
    return { history: [], display: [{ type: "error", text: "השיחה ארוכה מדי. התחילו שיחה חדשה." }] };
  }
  return runAgent({
    side: "customer",
    system: CUSTOMER_SYSTEM,
    tools: CUSTOMER_TOOLS,
    ctx,
    history,
    userText: String(text ?? ""),
    limitKey: ctx.userId,
    call: customerFakeEnabled() ? customerFakeCall : undefined,
  });
}

export async function customerAgentConfirm(token: string): Promise<ConfirmResult> {
  const ctx = await context();
  return confirmAction({ side: "customer", token: String(token ?? ""), tools: CUSTOMER_TOOLS, ctx });
}

export async function customerAgentCancel(title: string): Promise<string> {
  await requireRole("CUSTOMER");
  return cancelNote(String(title ?? "").slice(0, 200));
}
