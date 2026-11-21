/**
 * בדיקות של העוזר של הספק מול מסד אמיתי (אחרי `npx prisma db seed`).
 * רצות רק עם DB_TESTS=1, כי הן משנות נתונים: DB_TESTS=1 npx vitest run src/lib/agent/supplier
 */
import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { confirmAction, runAgent, type ModelCall } from "@/lib/agent/core";
import type { ActionTool, ReadTool } from "@/lib/agent/types";
import { db } from "@/lib/db";
import { supplierTools, type SupplierCtx, type SupplierOrg } from "./tools";

const enabled = process.env.DB_TESTS === "1";

const tool = (name: string) => supplierTools.find((t) => t.name === name)!;
const read = (name: string) => tool(name) as ReadTool<SupplierOrg>;
const action = (name: string) => tool(name) as ActionTool<SupplierOrg>;

async function ctxFor(email: string): Promise<SupplierCtx> {
  const user = await db.user.findUniqueOrThrow({ where: { email }, include: { supplier: true } });
  return { userId: user.id, org: { supplier: { id: user.supplier!.id, companyName: user.supplier!.companyName } } };
}

function message(content: unknown[], stop: string) {
  return { id: "m", type: "message", role: "assistant", model: "x", content, stop_reason: stop } as unknown as Anthropic.Beta.BetaMessage;
}

describe.skipIf(!enabled)("supplier assistant tools (db)", () => {
  let manager: SupplierCtx;
  let sales: SupplierCtx;
  let pricing: SupplierCtx;
  const created: string[] = [];

  beforeAll(async () => {
    process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
    manager = await ctxFor("supplier1@demo.local");
    sales = await ctxFor("sales@demo.local");
    pricing = await ctxFor("pricing@demo.local");
  });

  afterAll(async () => {
    if (created.length) await db.matchRequest.deleteMany({ where: { id: { in: created } } });
  });

  async function firstProduct(ctx: SupplierCtx) {
    const out = await read("search_products").run(ctx, { query: "" });
    const data = JSON.parse(out.text);
    const product = data.products.find((p: { pricesPerUnit: { regular: number | null }[] }) => p.pricesPerUnit[0].regular);
    return product as {
      offerId: string;
      product: string;
      priceVersion: string;
      pricesPerUnit: { tierId: string; regular: number }[];
    };
  }

  it("search returns own products with a price version and nothing about competitors", async () => {
    const out = await read("search_products").run(manager, { query: "" });
    const data = JSON.parse(out.text);
    expect(data.total).toBeGreaterThan(0);
    expect(data.products[0].priceVersion).toBeTruthy();
    const offers = await db.supplierOffer.findMany({ where: { id: { in: data.products.map((p: { offerId: string }) => p.offerId) } } });
    expect(offers.every((o) => o.supplierId === manager.org.supplier.id)).toBe(true);
  });

  it("market position never contains other supplier names", async () => {
    const out = await read("market_position").run(manager, {});
    const others = await db.supplier.findMany({ where: { id: { not: manager.org.supplier.id } }, select: { companyName: true } });
    for (const o of others) expect(out.text).not.toContain(o.companyName);
    expect(out.text).not.toMatch(/supplierId|companyName/);
  });

  it("inquiry details never include contact details", async () => {
    const inquiry = await db.negotiationRequest.findFirstOrThrow({ where: { supplierId: manager.org.supplier.id } });
    const out = await read("get_inquiry").run(manager, { inquiryId: inquiry.id });
    const users = await db.user.findMany({ where: { customerId: inquiry.customerId } });
    for (const u of users) {
      expect(out.text).not.toContain(u.email);
      if (u.phone) expect(out.text).not.toContain(u.phone);
    }
  });

  it("another supplier's inquiry is not found", async () => {
    const other = await db.negotiationRequest.findFirstOrThrow({ where: { supplierId: { not: manager.org.supplier.id } } });
    const out = await read("get_inquiry").run(manager, { inquiryId: other.id });
    expect(out.text).toContain("not found");
  });

  it("roles: sales cannot change prices, pricing cannot reply", async () => {
    expect(await action("update_price").allowed!(sales)).toBeTruthy();
    expect(await action("update_price").allowed!(pricing)).toBeNull();
    expect(await action("reply_inquiry").allowed!(pricing)).toBeTruthy();
    expect(await action("reply_inquiry").allowed!(sales)).toBeNull();
  });

  it("price change: card, save, history kept, stale version refused", async () => {
    const p = await firstProduct(manager);
    const old = p.pricesPerUnit[0].regular;
    const input = { offerId: p.offerId, price: Math.round(old * 105) / 100, per: "unit", priceVersion: p.priceVersion };
    const card = await action("update_price").describe(manager, input);
    expect("title" in card && card.lines.join(" ")).toContain("מחיר חדש");
    const before = await db.offerPrice.count({ where: { offerId: p.offerId } });
    const out = await action("update_price").execute(manager, input);
    expect(out.summary).toContain("עודכן");
    expect(await db.offerPrice.count({ where: { offerId: p.offerId } })).toBe(before + 1);
    const closed = await db.offerPrice.findFirst({
      where: { offerId: p.offerId, unitPriceAgorot: Math.round(old * 100), validTo: { not: null } },
    });
    expect(closed).not.toBeNull();
    // אותה הצעה שוב: הגרסה כבר לא עדכנית
    const again = await action("update_price").execute(manager, input);
    expect(again.summary).toContain("לא נשמר");
    const staleCard = await action("update_price").describe(manager, input);
    expect("error" in staleCard).toBe(true);
  });

  it("a change over 30% waits for admin approval", async () => {
    const p = await firstProduct(manager);
    const input = { offerId: p.offerId, price: p.pricesPerUnit[0].regular * 2, per: "unit", priceVersion: p.priceVersion };
    const card = await action("update_price").describe(manager, input);
    expect("title" in card && card.lines.join(" ")).toContain("ממתין לאישור");
    const out = await action("update_price").execute(manager, input);
    expect(out.summary).toContain("ממתין לאישור");
    const latest = await db.offerPrice.findFirstOrThrow({ where: { offerId: p.offerId }, orderBy: { createdAt: "desc" } });
    expect(latest.status).toBe("PENDING_APPROVAL");
  });

  it("reply to an inquiry through the full agent flow, approved once", async () => {
    const inquiry = await db.negotiationRequest.findFirstOrThrow({
      where: { supplierId: manager.org.supplier.id, outcome: null, replyCount: 0 },
    });
    const replyInput = {
      inquiryId: inquiry.id,
      decision: "offer",
      message: "שלום, נשמח לספק לכם במחירים שבהצעה.",
      validDays: 14,
      paymentTermsDays: 30,
    };
    const call: ModelCall = async (params) => {
      const last = params.messages.at(-1)!;
      if (last.role === "user" && typeof last.content === "string") {
        return message([{ type: "tool_use", id: "t1", name: "reply_inquiry", input: replyInput }], "tool_use");
      }
      return message([{ type: "text", text: "הכנתי תשובה, אשרו בכרטיס." }], "end_turn");
    };
    const turn = await runAgent({
      side: "supplier",
      system: "test",
      tools: supplierTools,
      ctx: manager,
      history: [],
      userText: "תענה לפנייה",
      limitKey: "test",
      call,
    });
    const pending = turn.display.find((d) => d.type === "pending");
    expect(pending && pending.type === "pending").toBe(true);
    // עד האישור לא נשמר כלום
    expect((await db.negotiationRequest.findUniqueOrThrow({ where: { id: inquiry.id } })).replyCount).toBe(0);
    const token = pending!.type === "pending" ? pending!.action.token : "";
    // איש צוות אחר לא יכול להשתמש בכרטיס
    const stolen = await confirmAction({ side: "supplier", token, tools: supplierTools, ctx: sales });
    expect(stolen.ok).toBe(false);
    const ok = await confirmAction({ side: "supplier", token, tools: supplierTools, ctx: manager });
    expect(ok.ok).toBe(true);
    const saved = await db.negotiationRequest.findUniqueOrThrow({ where: { id: inquiry.id } });
    expect(saved.status).toBe("OFFERED");
    expect(saved.replyCount).toBe(1);
    expect(saved.paymentTermsDays).toBe(30);
    const twice = await confirmAction({ side: "supplier", token, tools: supplierTools, ctx: manager });
    expect(twice.ok).toBe(false);
  });

  it("answer a match request: counter must be below today's price", async () => {
    const customer = await db.customer.findFirstOrThrow();
    const request = await db.matchRequest.create({
      data: {
        customerId: customer.id,
        supplierId: manager.org.supplier.id,
        reveal: "CEILING",
        lines: {
          create: {
            productId: (await db.product.findFirstOrThrow()).id,
            productName: "מוצר בדיקה",
            unit: "KG",
            monthlyQuantity: 10,
            currentPriceAgorot: 5000,
            targetPriceAgorot: 4000,
            shownPriceAgorot: 4200,
          },
        },
      },
      include: { lines: true },
    });
    created.push(request.id);
    const details = await read("get_match_request").run(sales, { requestId: request.id });
    // במצב "מתחת לסף" המחיר שנמצא לא נחשף
    expect(details.text).not.toContain("40");
    expect(details.text).toContain("42");
    const lineId = request.lines[0].id;
    const base = { requestId: request.id, validDays: 0, paymentTermsDays: null };
    const matched = await action("answer_match").describe(sales, { ...base, answers: [{ lineId, response: "matched" }] });
    expect("error" in matched).toBe(true);
    const tooHigh = await action("answer_match").describe(sales, {
      ...base,
      answers: [{ lineId, response: "counter", counterPrice: 55 }],
    });
    expect("error" in tooHigh).toBe(true);
    const input = { ...base, answers: [{ lineId, response: "counter", counterPrice: 41.5 }] };
    expect("title" in (await action("answer_match").describe(sales, input))).toBe(true);
    const out = await action("answer_match").execute(sales, input);
    expect(out.summary).toContain("נשלחה");
    const line = await db.matchRequestLine.findUniqueOrThrow({ where: { id: lineId } });
    expect(line.response).toBe("COUNTER");
    expect(line.counterPriceAgorot).toBe(4150);
  });
});
