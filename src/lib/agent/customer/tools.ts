import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { deniedMessage } from "@/lib/auth/permission-check";
import { catalogForBasket } from "@/lib/customer/catalog";
import { checkSnapshot } from "@/lib/customer/checks";
import { customerDeals } from "@/lib/customer/deals";
import { analyzeBasket, getBasket } from "@/lib/customer/quotes";
import { db } from "@/lib/db";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { matchSummary } from "@/lib/matches";
import { inquiryStage, matchStage, OFFER_STAGE_LABEL } from "@/lib/offer-status";
import { searchItems } from "@/lib/search";
import { json } from "../core";
import type { ActionTool, AgentContext, AgentTool, ReadTool } from "../types";
import { analysisSummary, mergeItems, quantityText, type BasketItemInput } from "./summary";

/** הלקוח שהסוכן פועל בשמו */
export interface CustomerOrg {
  customerId: string;
  businessName: string;
}

type Ctx = AgentContext<CustomerOrg>;

/** פעולות שמשנות סלים או מכינות פנייה דורשות תפקיד קניין או מנהל (צופה רק שואל) */
const canBuy = (ctx: Ctx) => deniedMessage("buy", ctx.userId);

const MAX_ITEMS = 200;

const itemSchema = z.object({
  productId: z.string().min(1),
  monthlyQuantity: z.number().positive().max(1_000_000),
  preferredBrand: z.string().max(60).nullable().optional(),
});

const itemJson = {
  type: "object",
  properties: {
    productId: { type: "string", description: "Catalog product id from search_catalog" },
    monthlyQuantity: { type: "number", description: "Monthly quantity in the product's unit (kg, liter or unit)" },
    preferredBrand: {
      type: ["string", "null"],
      description: "Only when the customer insists on one brand. Omit or null for any brand.",
    },
  },
  required: ["productId", "monthlyQuantity"],
  additionalProperties: false,
} as const;

/** המוצרים מהקטלוג לפי מזהה, רק כאלה שאפשר להכניס לסל */
async function catalogProducts(ids: string[]) {
  const products = await db.product.findMany({
    where: { id: { in: ids }, pendingReview: false },
    select: { id: true, name: true, unit: true },
  });
  return new Map(products.map((p) => [p.id, p]));
}

async function itemLines(items: BasketItemInput[]) {
  const products = await catalogProducts(items.map((i) => i.productId));
  const missing = items.filter((i) => !products.has(i.productId)).map((i) => i.productId);
  const lines = items.flatMap((i) => {
    const p = products.get(i.productId);
    if (!p) return [];
    return [`${p.name}: ${quantityText(i.monthlyQuantity, p.unit)}${i.preferredBrand ? ` (רק ${i.preferredBrand})` : ""}`];
  });
  return { lines, missing };
}

const searchCatalog: ReadTool<CustomerOrg, { query: string; limit?: number }> = {
  kind: "read",
  name: "search_catalog",
  description:
    "Search the platform's product catalog (Hebrew). Returns product ids, names, units, categories and the brands suppliers sell. " +
    "Use it before adding products to a basket. Search one product at a time with short Hebrew words, e.g. 'עגבניות', 'שמן קנולה'.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 20 },
    },
    required: ["query"],
    additionalProperties: false,
  },
  input: z.object({ query: z.string().trim().min(1).max(100), limit: z.number().int().min(1).max(20).optional() }),
  run: async (_ctx, { query, limit }) => {
    const catalog = await catalogForBasket();
    const found = searchItems(catalog, query, (c) => ({
      name: c.name,
      aliases: c.aliases,
      categories: [c.category, c.parentCategory ?? ""],
    })).slice(0, limit ?? 8);
    return {
      text: json(
        found.map((p) => ({
          productId: p.id,
          name: p.name,
          unit: UNIT_LABEL[p.unit],
          category: p.parentCategory ? `${p.parentCategory} / ${p.category}` : p.category,
          brands: p.brands ?? [],
        })),
      ),
      summary: `חיפשתי בקטלוג: "${query}" (${found.length} תוצאות)`,
    };
  },
};

const listBaskets: ReadTool<CustomerOrg, Record<string, never>> = {
  kind: "read",
  name: "list_baskets",
  description: "List the customer's baskets (price checks): id, name, number of products, whether saved for monthly checks, last check date.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  input: z.object({}).strict(),
  run: async (ctx) => {
    const baskets = await db.basket.findMany({
      where: { customerId: ctx.org.customerId },
      select: {
        id: true,
        name: true,
        savedAt: true,
        createdAt: true,
        currentSupplierName: true,
        _count: { select: { items: true } },
        runs: { select: { createdAt: true, bestCostAgorot: true }, orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return {
      text: json(
        baskets.map((b) => ({
          basketId: b.id,
          name: b.name,
          products: b._count.items,
          savedForMonthlyCheck: Boolean(b.savedAt),
          currentSupplier: b.currentSupplierName,
          created: b.createdAt.toISOString().slice(0, 10),
          lastCheck: b.runs[0] ? { date: b.runs[0].createdAt.toISOString().slice(0, 10), bestCostPerMonth: shekels(b.runs[0].bestCostAgorot) } : null,
        })),
      ),
    };
  },
};

const getBasketComparison: ReadTool<CustomerOrg, { basketId: string }> = {
  kind: "read",
  name: "get_basket_comparison",
  description:
    "Get one basket's products and the live price comparison: cheapest total, single supplier option, recommended mix, " +
    "monthly saving vs what the customer pays today, ranked suppliers, suppliers excluded by minimum order, and brand requests. " +
    "All prices are in shekels, excluding VAT.",
  input_schema: {
    type: "object",
    properties: { basketId: { type: "string" } },
    required: ["basketId"],
    additionalProperties: false,
  },
  input: z.object({ basketId: z.string().min(1) }),
  run: async (ctx, { basketId }) => {
    const basket = await getBasket(ctx.org.customerId, basketId);
    if (!basket) return { text: "Basket not found for this customer." };
    const analysis = await analyzeBasket(basket.id);
    const names = new Map(basket.items.map((i) => [i.productId, i.product.name]));
    return {
      text: json({
        basket: {
          name: basket.name,
          deliveriesPerMonth: basket.deliveriesPerMonth,
          currentSupplier: basket.currentSupplier?.companyName ?? basket.currentSupplierName,
          items: basket.items.map((i) => ({
            productId: i.productId,
            name: i.product.name,
            monthlyQuantity: i.monthlyQuantity,
            unit: UNIT_LABEL[i.product.unit],
            paysTodayPerUnit: i.currentUnitPriceAgorot == null ? null : shekels(i.currentUnitPriceAgorot, 2),
            onlyBrand: i.preferredBrand,
          })),
        },
        comparison: analysisSummary(analysis, names),
      }),
      summary: `בדקתי את ההשוואה של "${basket.name}"`,
      link: { href: `/customer/baskets/${basket.id}`, label: "לדף הסל" },
    };
  },
};

const listOffers: ReadTool<CustomerOrg, Record<string, never>> = {
  kind: "read",
  name: "list_inquiries_and_offers",
  description:
    "List the customer's inquiries to suppliers and price-match requests with supplier name, dates and the status of the supplier's offer: " +
    "חדשה = supplier hasn't answered yet, נשלחה = supplier sent an offer the customer hasn't opened, נצפתה = customer opened it, " +
    "then התקבלה / נדחתה / פג תוקף / בוטלה / הספק לא ענה.",
  input_schema: { type: "object", properties: {}, additionalProperties: false },
  input: z.object({}).strict(),
  run: async (ctx) => {
    const [inquiries, matches] = await Promise.all([
      db.negotiationRequest.findMany({
        where: { customerId: ctx.org.customerId, customerHiddenAt: null },
        include: { supplier: { select: { companyName: true } } },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
      db.matchRequest.findMany({
        where: { customerId: ctx.org.customerId, customerHiddenAt: null },
        include: { supplier: { select: { companyName: true } }, lines: true },
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);
    return {
      text: json({
        inquiries: inquiries.map((i) => ({
          supplier: i.supplier.companyName,
          sent: i.createdAt.toISOString().slice(0, 10),
          status: OFFER_STAGE_LABEL[inquiryStage(i)],
          supplierReplied: Boolean(i.repliedAt),
          offerValidUntil: i.validUntil?.toISOString().slice(0, 10) ?? null,
          link: `/customer/inquiries/${i.id}`,
        })),
        priceMatchRequests: matches.map((m) => {
          const sum = matchSummary(m.lines);
          return {
            supplier: m.supplier.companyName,
            sent: m.createdAt.toISOString().slice(0, 10),
            status: OFFER_STAGE_LABEL[matchStage(m)],
            products: m.lines.length,
            requestedSavingPerMonth: shekels(sum.requestedAgorot),
            offeredSavingPerMonth: m.answeredAt ? shekels(sum.offeredAgorot) : null,
            link: `/customer/matches/${m.id}`,
          };
        }),
      }),
      summary: "בדקתי את הפניות וההצעות שלכם",
      link: { href: "/customer/inquiries", label: "לכל הפניות" },
    };
  },
};

const listDeals: ReadTool<CustomerOrg, { onlyMyProducts?: boolean }> = {
  kind: "read",
  name: "list_deals",
  description: "Active supplier deals (price promotions and quantity deals) from suppliers that deliver to the customer. Products in the customer's baskets come first.",
  input_schema: {
    type: "object",
    properties: { onlyMyProducts: { type: "boolean", description: "Only products that are in the customer's baskets" } },
    additionalProperties: false,
  },
  input: z.object({ onlyMyProducts: z.boolean().optional() }),
  run: async (ctx, { onlyMyProducts }) => {
    const deals = (await customerDeals(ctx.org.customerId)).filter((d) => !onlyMyProducts || d.inMyBaskets).slice(0, 25);
    return {
      text: json(
        deals.map((d) => ({
          supplier: d.supplierName,
          product: d.productName,
          pack: d.pack,
          regularPrice: d.regularAgorot == null ? null : `${shekels(d.regularAgorot, 2)} ל${d.unitLabel}`,
          promotion: d.promotion
            ? { price: `${shekels(d.promotion.priceAgorot, 2)} ל${d.unitLabel}`, until: d.promotion.validTo?.toISOString().slice(0, 10) ?? null }
            : null,
          quantityDeal: d.quantityDeal?.label ?? null,
          inMyBaskets: d.inMyBaskets,
        })),
      ),
      summary: `בדקתי מבצעים (${deals.length})`,
      link: { href: "/customer/deals", label: "לדף המבצעים" },
    };
  },
};

const prepareInquiry: ReadTool<CustomerOrg, { basketId: string; supplierId: string; message?: string }> = {
  kind: "read",
  name: "prepare_inquiry",
  description:
    "Prepare (NOT send) an inquiry to a supplier about one basket. Returns a link to the inquiry page with your draft message filled in; " +
    "the customer reviews the quote and message there and presses send. The supplierId must come from get_basket_comparison.",
  input_schema: {
    type: "object",
    properties: {
      basketId: { type: "string" },
      supplierId: { type: "string" },
      message: { type: "string", description: "Optional short draft in Hebrew to the supplier (5-1000 characters)" },
    },
    required: ["basketId", "supplierId"],
    additionalProperties: false,
  },
  input: z.object({ basketId: z.string().min(1), supplierId: z.string().min(1), message: z.string().trim().max(1000).optional() }),
  allowed: canBuy,
  run: async (ctx, { basketId, supplierId, message }) => {
    const basket = await getBasket(ctx.org.customerId, basketId);
    if (!basket) return { text: "Basket not found for this customer." };
    const row = (await analyzeBasket(basket.id)).rows.find((r) => r.supplierId === supplierId);
    if (!row) return { text: "This supplier does not currently offer products from this basket." };
    const qs = message && message.length >= 5 ? `?message=${encodeURIComponent(message)}` : "";
    return {
      text: "Link ready. The customer must open it, review and press send. Nothing was sent.",
      summary: `הכנתי פנייה ל${row.supplierName} על "${basket.name}" (עוד לא נשלחה)`,
      link: { href: `/customer/baskets/${basket.id}/inquiry/${supplierId}${qs}`, label: "לבדיקה ושליחה" },
    };
  },
};

const basketFields = {
  name: z.string().trim().min(2).max(60),
  deliveriesPerMonth: z.number().int().min(1).max(31).optional(),
};

const createBasket: ActionTool<CustomerOrg, { name: string; deliveriesPerMonth?: number; items: BasketItemInput[] }> = {
  kind: "action",
  name: "create_basket",
  description:
    "Create a new basket (price check) with products and monthly quantities. Get product ids from search_catalog first. " +
    "Needs the customer's approval in a card; nothing is created until they approve.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short Hebrew basket name, e.g. 'ירקות שבועי'" },
      deliveriesPerMonth: { type: "integer", minimum: 1, maximum: 31, description: "Default 4" },
      items: { type: "array", items: itemJson, minItems: 1, maxItems: MAX_ITEMS },
    },
    required: ["name", "items"],
    additionalProperties: false,
  },
  input: z.object({ ...basketFields, items: z.array(itemSchema).min(1).max(MAX_ITEMS) }),
  allowed: canBuy,
  describe: async (_ctx, input) => {
    const items = mergeItems([], input.items, []);
    const { lines, missing } = await itemLines(items);
    if (missing.length) return { error: `unknown product ids: ${missing.join(", ")}. Use search_catalog.` };
    return {
      title: `יצירת סל חדש: ${input.name}`,
      lines: [...lines, `${input.deliveriesPerMonth ?? 4} אספקות בחודש`],
      confirmLabel: "יצירת הסל",
    };
  },
  execute: async (ctx, input) => {
    const items = mergeItems([], input.items, []);
    const products = await catalogProducts(items.map((i) => i.productId));
    const valid = items.filter((i) => products.has(i.productId));
    if (valid.length === 0) throw new Error("no valid products");
    const basket = await db.basket.create({
      data: {
        customerId: ctx.org.customerId,
        name: input.name,
        deliveriesPerMonth: input.deliveriesPerMonth ?? 4,
        source: "MANUAL",
        items: {
          create: valid.map((i) => ({
            productId: i.productId,
            monthlyQuantity: i.monthlyQuantity,
            preferredBrand: i.preferredBrand ?? null,
          })),
        },
      },
    });
    await audit({ action: "basket.created", targetType: "basket", targetId: basket.id, details: { via: "assistant" } });
    revalidatePath("/customer", "layout");
    return {
      text: `Basket created. basketId=${basket.id}, ${valid.length} products. You can now call get_basket_comparison.`,
      summary: `נוצר סל חדש: ${input.name}`,
      link: { href: `/customer/baskets/${basket.id}`, label: "להשוואת המחירים" },
    };
  },
};

const updateBasket: ActionTool<CustomerOrg, { basketId: string; set?: BasketItemInput[]; remove?: string[]; name?: string }> = {
  kind: "action",
  name: "update_basket",
  description:
    "Change an existing basket: add products or change quantities/brand ('set'), remove products ('remove', product ids), or rename. " +
    "Needs the customer's approval in a card.",
  input_schema: {
    type: "object",
    properties: {
      basketId: { type: "string" },
      set: { type: "array", items: itemJson, maxItems: MAX_ITEMS },
      remove: { type: "array", items: { type: "string" }, maxItems: MAX_ITEMS },
      name: { type: "string" },
    },
    required: ["basketId"],
    additionalProperties: false,
  },
  input: z.object({
    basketId: z.string().min(1),
    set: z.array(itemSchema).max(MAX_ITEMS).optional(),
    remove: z.array(z.string()).max(MAX_ITEMS).optional(),
    name: basketFields.name.optional(),
  }),
  allowed: canBuy,
  describe: async (ctx, input) => {
    const basket = await getBasket(ctx.org.customerId, input.basketId);
    if (!basket) return { error: "basket not found" };
    const set = input.set ?? [];
    const remove = (input.remove ?? []).filter((id) => basket.items.some((i) => i.productId === id));
    if (!set.length && !remove.length && !input.name) return { error: "nothing to change" };
    const { lines, missing } = await itemLines(mergeItems([], set, []));
    if (missing.length) return { error: `unknown product ids: ${missing.join(", ")}. Use search_catalog.` };
    const names = new Map(basket.items.map((i) => [i.productId, i.product.name]));
    const after = mergeItems(basket.items, set, remove);
    if (after.length === 0) return { error: "a basket must keep at least one product" };
    return {
      title: `עדכון הסל "${basket.name}"`,
      lines: [
        ...(input.name ? [`שם חדש: ${input.name}`] : []),
        ...lines.map((l) => `הוספה או עדכון: ${l}`),
        ...remove.map((id) => `הסרה: ${names.get(id)}`),
      ],
      confirmLabel: "עדכון הסל",
      danger: remove.length > 0,
    };
  },
  execute: async (ctx, input) => {
    const basket = await getBasket(ctx.org.customerId, input.basketId);
    if (!basket) throw new Error("basket not found");
    const after = mergeItems(basket.items, input.set ?? [], input.remove ?? []);
    const products = await catalogProducts(after.map((i) => i.productId));
    const valid = after.filter((i) => products.has(i.productId));
    if (valid.length === 0) throw new Error("empty basket");
    // מחיר "היום" שהלקוח הזין נשמר למוצרים שנשארו
    const paid = new Map(basket.items.map((i) => [i.productId, i.currentUnitPriceAgorot]));
    const id = basket.id;
    await db.$transaction(async (tx) => {
      // נעילה על הסל, כמו בשמירה מהטופס: שתי שמירות במקביל לא משכפלות מוצרים
      await tx.$queryRaw`SELECT id FROM "Basket" WHERE id = ${id} FOR UPDATE`;
      await tx.basketItem.deleteMany({ where: { basketId: id } });
      await tx.basket.update({
        where: { id },
        data: {
          ...(input.name ? { name: input.name } : {}),
          items: {
            create: valid.map((i) => ({
              productId: i.productId,
              monthlyQuantity: i.monthlyQuantity,
              preferredBrand: i.preferredBrand ?? null,
              currentUnitPriceAgorot: paid.get(i.productId) ?? null,
            })),
          },
        },
      });
    });
    await audit({ action: "basket.updated", targetType: "basket", targetId: id, details: { via: "assistant" } });
    revalidatePath("/customer", "layout");
    return {
      text: `Basket updated, now ${valid.length} products.`,
      summary: `הסל "${input.name ?? basket.name}" עודכן`,
      link: { href: `/customer/baskets/${id}`, label: "להשוואת המחירים" },
    };
  },
};

const saveCheck: ActionTool<CustomerOrg, { basketId: string }> = {
  kind: "action",
  name: "save_monthly_check",
  description:
    "Save today's prices of a basket as a check, and keep the basket for a monthly re-check (next time the customer sees what changed). Needs approval.",
  input_schema: {
    type: "object",
    properties: { basketId: { type: "string" } },
    required: ["basketId"],
    additionalProperties: false,
  },
  input: z.object({ basketId: z.string().min(1) }),
  allowed: canBuy,
  describe: async (ctx, { basketId }) => {
    const basket = await getBasket(ctx.org.customerId, basketId);
    if (!basket) return { error: "basket not found" };
    return {
      title: `שמירת הבדיקה של "${basket.name}"`,
      lines: ["המחירים של היום יישמרו", "בבדיקה הבאה תראו מה השתנה אצל כל ספק"],
      confirmLabel: "שמירה",
    };
  },
  execute: async (ctx, { basketId }) => {
    const basket = await getBasket(ctx.org.customerId, basketId);
    if (!basket) throw new Error("basket not found");
    const customer = await db.customer.findUniqueOrThrow({ where: { id: ctx.org.customerId }, select: { preference: true } });
    const analysis = await analyzeBasket(basket.id);
    await db.$transaction([
      db.optimizationRun.create({
        data: {
          basketId: basket.id,
          preference: customer.preference,
          result: JSON.parse(JSON.stringify(checkSnapshot(analysis))),
          bestCostAgorot: analysis.result.lowestCost?.totalAgorot ?? 0,
          savingsAgorot: analysis.result.monthlySavingsAgorot,
        },
      }),
      db.basket.update({ where: { id: basket.id }, data: { savedAt: basket.savedAt ?? new Date() } }),
    ]);
    revalidatePath("/customer", "layout");
    return {
      text: "Check saved.",
      summary: `הבדיקה של "${basket.name}" נשמרה`,
      link: { href: `/customer/baskets/${basket.id}`, label: "לדף הסל" },
    };
  },
};

export const CUSTOMER_TOOLS: AgentTool<CustomerOrg>[] = [
  searchCatalog,
  listBaskets,
  getBasketComparison,
  listOffers,
  listDeals,
  prepareInquiry,
  createBasket,
  updateBasket,
  saveCheck,
];
