import { z } from "zod";
import { json } from "@/lib/agent/core";
import type { AgentContext, AgentTool, ConfirmCard } from "@/lib/agent/types";
import { deniedMessage } from "@/lib/auth/permission-check";
import { db } from "@/lib/db";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { lockedInquiriesWith } from "@/lib/inquiry-deadlines";
import { NO_VALIDITY, VALID_DAYS } from "@/lib/matches";
import { MAX_REPLIES } from "@/lib/notify/limits";
import { nominalPackSize, packLabel } from "@/lib/pack";
import { lastValidDay, shortDate } from "@/lib/price-status";
import { dateTime } from "@/lib/quote-validity";
import { changeRegularPrice, STALE_PRICE_MESSAGE } from "@/lib/supplier/price-change";
import { priceVersion } from "@/lib/supplier/prices";
import { APPROVAL_THRESHOLD, parseValidUntil, priceChangeStatus } from "@/lib/supplier/pricing-rules";
import { sendInquiryReply, sendMatchAnswer, type MatchAnswerInput } from "@/lib/supplier/replies";
import { PAYMENT_TERM_OPTIONS, paymentTermsLabel } from "@/lib/terms";
import {
  deals,
  deliveryAreas,
  inquiryDetails,
  marketPositions,
  matchDetails,
  openRequests,
  overview,
  priceAttention,
  searchProducts,
  type SupplierRef,
} from "./data";

/** הארגון שהכלים של הספק פועלים בשמו: הספק של המשתמש המחובר */
export interface SupplierOrg {
  supplier: SupplierRef;
}

export type SupplierCtx = AgentContext<SupplierOrg>;
type Tool = AgentTool<SupplierOrg>;

const prices = (ctx: SupplierCtx) => deniedMessage("prices", ctx.userId);
const reply = (ctx: SupplierCtx) => deniedMessage("reply", ctx.userId);

const id = z.string().trim().min(1).max(64);
const noInput = { type: "object" as const, properties: {}, additionalProperties: false };

const validityText = (days: number) => (days === NO_VALIDITY ? "בלי תוקף" : `${days} ימים`);
const validUntilFor = (days: number) => (days === NO_VALIDITY ? null : new Date(Date.now() + days * 86_400_000));
const termsText = (days: number | null) => (days === null ? "לא צוינו" : paymentTermsLabel(days));

const validDays = z
  .number()
  .int()
  .refine((d) => d === NO_VALIDITY || VALID_DAYS.includes(d), "validDays must be 0, 7, 14, 30, 60 or 90");
const paymentTerms = z
  .number()
  .int()
  .nullable()
  .refine((d) => d === null || PAYMENT_TERM_OPTIONS.includes(d), "paymentTermsDays must be null, 0, 30, 45, 60, 90 or 120");
const validDaysSchema = {
  type: "integer",
  enum: [NO_VALIDITY, ...VALID_DAYS],
  description: "How many days the offer is valid. 0 = no expiry. Ask the user if they did not say.",
};
const paymentTermsSchema = {
  type: ["integer", "null"],
  enum: [null, ...PAYMENT_TERM_OPTIONS],
  description: "Payment terms for this customer: days after end of month (שוטף + N), 0 = cash on delivery, null = not stated.",
};

// ---------- כלים שקוראים מידע ----------

const readTools: Tool[] = [
  {
    kind: "read",
    name: "get_overview",
    description:
      "Summary of the supplier account: number of products, products without a price, prices waiting for admin approval, prices older than 30 days, unanswered inquiries and match requests, how often the supplier appeared in customer comparisons in the last 30 days, delivery circles, verification. Use it for 'what should I do today' questions.",
    input_schema: noInput,
    input: z.object({}).passthrough(),
    run: async (ctx) => ({ text: json(await overview(ctx.org.supplier)), summary: "בדקתי את מצב החשבון" }),
  },
  {
    kind: "read",
    name: "search_products",
    description:
      "Search the supplier's own products (not archived) by name, brand, SKU, barcode or category. Returns every price tier with the regular price per base unit (kg / liter / unit), validity, promotion, pending approval, pack and quantity deal, plus offerId, tierId and priceVersion, which update_price needs. An empty query lists all products. Prices are in shekels excluding VAT.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Words to search for, in Hebrew as the supplier wrote them. Empty for all." },
        limit: { type: "integer", minimum: 1, maximum: 40, description: "Max products to return (default 15)." },
      },
      required: ["query"],
      additionalProperties: false,
    },
    input: z.object({ query: z.string().max(100), limit: z.number().int().min(1).max(40).optional() }),
    run: async (ctx, input: { query: string; limit?: number }) => {
      const result = await searchProducts(ctx.org.supplier, input.query, input.limit);
      const withVersions = await Promise.all(
        result.products.map(async (p) => ({ ...p, priceVersion: await priceVersion(db, p.offerId) })),
      );
      return {
        text: json({ ...result, products: withVersions }),
        summary: input.query ? `חיפשתי במוצרים: "${input.query}" (${result.total} תוצאות)` : `עברתי על המוצרים (${result.total})`,
      };
    },
  },
  {
    kind: "read",
    name: "prices_needing_attention",
    description:
      "Products whose prices need the supplier's attention: no valid price, expired validity (the product is out of comparisons), validity or promotion ending within 7 days, not updated for more than 30 days (customers see it as old), or waiting for admin approval.",
    input_schema: noInput,
    input: z.object({}).passthrough(),
    run: async (ctx) => {
      const result = await priceAttention(ctx.org.supplier);
      return { text: json(result), summary: `בדקתי מחירים שצריכים עדכון (${result.count})`, link: { href: "/supplier", label: "המחירון" } };
    },
  },
  {
    kind: "read",
    name: "market_position",
    description:
      "The supplier's position against the market for its products: rank (1 = cheapest), number of suppliers, price band (cheapest / up to 3% above / 3-10% / more than 10% above the cheapest) and the market median. Only for products sold by at least 3 suppliers. Never contains a specific competitor's price or name.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Optional product or category name to filter by." } },
      additionalProperties: false,
    },
    input: z.object({ query: z.string().max(100).optional() }),
    run: async (ctx, input: { query?: string }) => ({
      text: json(await marketPositions(ctx.org.supplier, input.query)),
      summary: "בדקתי את המיקום שלכם מול השוק",
      link: { href: "/supplier/market", label: "מול השוק" },
    }),
  },
  {
    kind: "read",
    name: "list_open_requests",
    description:
      "Customer inquiries (פניות) and match requests (בקשות השוואה) that have not ended, newest first, with status, totals, replies left and the date an unanswered inquiry closes automatically.",
    input_schema: noInput,
    input: z.object({}).passthrough(),
    run: async (ctx) => ({
      text: json(await openRequests(ctx.org.supplier)),
      summary: "בדקתי פניות ובקשות השוואה פתוחות",
      link: { href: "/supplier/inquiries", label: "הפניות" },
    }),
  },
  {
    kind: "read",
    name: "get_inquiry",
    description:
      "One customer inquiry: the business, its message, the quote it received from the system for this supplier (products, monthly quantities, the supplier's prices), the gap to the cheaper option, a deal snapshot if it came from a deal, previous reply and replies left. Customer contact details are never included.",
    input_schema: {
      type: "object",
      properties: { inquiryId: { type: "string" } },
      required: ["inquiryId"],
      additionalProperties: false,
    },
    input: z.object({ inquiryId: id }),
    run: async (ctx, input: { inquiryId: string }) => {
      const details = await inquiryDetails(ctx.org.supplier, input.inquiryId);
      if (!details) return { text: "Inquiry not found for this supplier." };
      return { text: json(details), summary: `קראתי את הפנייה מ${details.customer}`, link: { href: details.link, label: "לפנייה" } };
    },
  },
  {
    kind: "read",
    name: "get_match_request",
    description:
      "One match request: per product the monthly quantity, what the customer pays this supplier today, what the customer found (an exact price, or in 'below a ceiling' mode only the ceiling), and the answers so far. Gives the lineId values that answer_match needs.",
    input_schema: {
      type: "object",
      properties: { requestId: { type: "string" } },
      required: ["requestId"],
      additionalProperties: false,
    },
    input: z.object({ requestId: id }),
    run: async (ctx, input: { requestId: string }) => {
      const details = await matchDetails(ctx.org.supplier, input.requestId);
      if (!details) return { text: "Match request not found for this supplier." };
      return { text: json(details), summary: `קראתי את בקשת ההשוואה מ${details.customer}`, link: { href: details.link, label: "לבקשה" } };
    },
  },
  {
    kind: "read",
    name: "list_deals",
    description:
      "The supplier's active price promotions and quantity deals. Creating or ending deals is done on the deals page (/supplier/deals) or the product page, not by the assistant.",
    input_schema: noInput,
    input: z.object({}).passthrough(),
    run: async (ctx) => ({
      text: json(await deals(ctx.org.supplier)),
      summary: "בדקתי את המבצעים",
      link: { href: "/supplier/deals", label: "מבצעים" },
    }),
  },
  {
    kind: "read",
    name: "delivery_areas",
    description:
      "The supplier's delivery circles on the map with delivery days, order cutoff and notes, the general regions and general delivery terms. Editing is done on /supplier/areas.",
    input_schema: noInput,
    input: z.object({}).passthrough(),
    run: async (ctx) => ({
      text: json(await deliveryAreas(ctx.org.supplier)),
      summary: "בדקתי את אזורי החלוקה",
      link: { href: "/supplier/areas", label: "אזורי חלוקה" },
    }),
  },
];

// ---------- כלים שמשנים משהו (רק אחרי אישור בכרטיס) ----------

interface PriceInput {
  offerId: string;
  tierId?: string;
  price: number;
  per: "unit" | "pack";
  validUntil?: string;
  priceVersion: string;
}

/** המחיר החדש ליחידת בסיס, המדרגה והמחיר הנוכחי; או שגיאה בעברית */
async function preparePrice(ctx: SupplierCtx, input: PriceInput) {
  const supplier = ctx.org.supplier;
  const offer = await db.supplierOffer.findFirst({
    where: { id: input.offerId, supplierId: supplier.id },
    include: { product: { select: { name: true, unit: true } } },
  });
  if (!offer) return { error: "המוצר לא נמצא אצלכם" };
  if (offer.archivedAt) return { error: "המוצר בארכיון. אפשר להחזיר אותו מדף הארכיון ואז לעדכן מחיר" };
  const tiers = await db.priceTier.findMany({ where: { supplierId: supplier.id }, orderBy: { minMonthlyAgorot: "asc" } });
  if (!tiers.length) return { error: "אין לכם מדרגות מחיר. את המחיר הראשון מכניסים בטופס המוצר" };
  const tier = input.tierId ? tiers.find((t) => t.id === input.tierId) : tiers[0];
  if (!tier) return { error: "מדרגת המחיר לא נמצאה" };
  const variable = offer.packSizeMax !== null && offer.packSizeMax > offer.packSize;
  if (input.per === "pack" && variable) return { error: "במוצר במשקל משתנה המחיר הוא לפי יחידת מידה ולא לאריזה" };
  const divisor = input.per === "pack" ? nominalPackSize(offer) : 1;
  const agorot = Math.round((input.price * 100) / divisor);
  if (!(agorot > 0)) return { error: "המחיר צריך להיות חיובי" };
  let validTo: Date | null = null;
  if (input.validUntil) {
    validTo = parseValidUntil(input.validUntil);
    if (!validTo) return { error: "תאריך התוקף צריך להיות מהיום ועד שנה קדימה" };
  }
  const now = new Date();
  const current = await db.offerPrice.findFirst({
    where: {
      offerId: offer.id,
      tierId: tier.id,
      kind: "REGULAR",
      status: "LIVE",
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gt: now } }],
    },
    orderBy: [{ validFrom: "desc" }, { createdAt: "desc" }],
  });
  return { offer, tier, agorot, validTo, current, isBase: tier.id === tiers[0].id };
}

const updatePrice: Tool = {
  kind: "action",
  name: "update_price",
  description:
    "Change the regular price of one existing product in one price tier (fixed price, or a price valid until a date). The user approves on a card before anything is saved. First call search_products and pass its offerId, tierId and priceVersion unchanged. Price is in shekels excluding VAT, per base unit (kg / liter / unit) or per pack. A change of more than 30% waits for admin approval. Promotions, quantity deals, new products, product details, brand changes and deleting or archiving are done on the product page, not here.",
  input_schema: {
    type: "object",
    properties: {
      offerId: { type: "string" },
      tierId: { type: "string", description: "Price tier; omit for the basic tier." },
      price: { type: "number", exclusiveMinimum: 0, description: "New price in shekels, excluding VAT." },
      per: { type: "string", enum: ["unit", "pack"], description: "unit = per kg/liter/unit; pack = for the whole pack." },
      validUntil: {
        type: "string",
        description: "Last day the price is valid, YYYY-MM-DD. Omit for a fixed price with no end date.",
      },
      priceVersion: { type: "string", description: "priceVersion from search_products, unchanged." },
    },
    required: ["offerId", "price", "per", "priceVersion"],
    additionalProperties: false,
  },
  input: z.object({
    offerId: id,
    tierId: id.optional(),
    price: z.number().positive().max(100_000),
    per: z.enum(["unit", "pack"]),
    validUntil: z.string().max(10).optional(),
    priceVersion: z.string().max(64),
  }),
  allowed: prices,
  describe: async (ctx, input: PriceInput) => {
    const p = await preparePrice(ctx, input);
    if ("error" in p) return { error: p.error! };
    if ((await priceVersion(db, p.offer.id)) !== input.priceVersion) return { error: STALE_PRICE_MESSAGE };
    const unit = UNIT_LABEL[p.offer.product.unit];
    const pack = packLabel({ ...p.offer, unit: p.offer.product.unit });
    const old = p.current?.unitPriceAgorot ?? null;
    const status = priceChangeStatus(old, p.agorot);
    const lines = [
      `מוצר: ${p.offer.product.name}${p.offer.brand ? ` (${p.offer.brand})` : ""}, ${pack}`,
      `מדרגה: ${p.tier.name}`,
      `מחיר עכשיו: ${old === null ? "אין מחיר בתוקף" : `${shekels(old, 2)} ל${unit}`}`,
      `מחיר חדש: ${shekels(p.agorot, 2)} ל${unit}${input.per === "pack" ? ` (${shekels(Math.round(input.price * 100), 2)} לאריזה)` : ""}, ללא מע״מ`,
      p.validTo ? `בתוקף עד ${shortDate(lastValidDay(p.validTo))}` : "מחיר קבוע, בלי תאריך סיום",
    ];
    if (old !== null) {
      const pct = Math.round(((p.agorot - old) / old) * 1000) / 10;
      lines.push(`שינוי: ${pct > 0 ? "+" : ""}${pct}%`);
    }
    if (status === "PENDING_APPROVAL")
      lines.push(`שינוי של יותר מ-${APPROVAL_THRESHOLD * 100}% ממתין לאישור מנהל המערכת לפני שלקוחות רואים אותו`);
    else if (p.isBase && old !== null && old !== p.agorot) lines.push("לקוחות שהמוצר בסל שלהם יקבלו התראה על השינוי");
    const locked = await lockedInquiriesWith(ctx.org.supplier.id, p.offer.product.name);
    if (locked.count > 0 && locked.until)
      lines.push(`יש ${locked.count} פניות פתוחות עם המוצר: המחיר בהן נעול עד ${dateTime(locked.until)} והשינוי לא יחול עליהן`);
    return { title: "עדכון מחיר", lines, confirmLabel: "שמירת המחיר" } satisfies ConfirmCard;
  },
  execute: async (ctx, input: PriceInput) => {
    const p = await preparePrice(ctx, input);
    if ("error" in p) return { text: `Not saved: ${p.error}`, summary: `המחיר לא נשמר: ${p.error}` };
    const result = await changeRegularPrice({
      supplier: ctx.org.supplier,
      offerId: p.offer.id,
      tierId: p.tier.id,
      agorot: p.agorot,
      validTo: p.validTo,
      version: input.priceVersion,
    });
    const link = { href: `/supplier/products/${p.offer.id}`, label: "לדף המוצר" };
    if (!result.ok) return { text: `Not saved: ${result.error}`, summary: `המחיר לא נשמר: ${result.error}`, link };
    const unit = UNIT_LABEL[p.offer.product.unit];
    const price = `${shekels(p.agorot, 2)} ל${unit}`;
    const summary =
      result.status === "UNCHANGED"
        ? `המחיר של ${p.offer.product.name} כבר היה ${price}, לא שיניתי`
        : result.status === "PENDING_APPROVAL"
          ? `המחיר החדש של ${p.offer.product.name} (${price}) ממתין לאישור מנהל המערכת`
          : `המחיר של ${p.offer.product.name} עודכן ל-${price}`;
    return { text: `Result: ${result.status}. ${summary}`, summary, link };
  },
};

interface ReplyInput {
  inquiryId: string;
  decision: "offer" | "cannot_match";
  message: string;
  validDays: number;
  paymentTermsDays: number | null;
}

const replyInquiry: Tool = {
  kind: "action",
  name: "reply_inquiry",
  description:
    "Send the supplier's reply to a customer inquiry, after the user approves the text on a card. decision 'offer' sends an offer; 'cannot_match' tells the customer the supplier cannot match and closes the inquiry. Write the message in Hebrew, in the supplier's name, short and polite, with only what the user asked to offer. Do not invent prices, discounts or terms. Do not promise delivery fees or free delivery: the platform has no delivery fees, only a minimum order. Replies are limited per inquiry.",
  input_schema: {
    type: "object",
    properties: {
      inquiryId: { type: "string" },
      decision: { type: "string", enum: ["offer", "cannot_match"] },
      message: { type: "string", description: "The reply text to the customer, Hebrew, 2-1000 characters." },
      validDays: validDaysSchema,
      paymentTermsDays: paymentTermsSchema,
    },
    required: ["inquiryId", "decision", "message", "validDays", "paymentTermsDays"],
    additionalProperties: false,
  },
  input: z.object({
    inquiryId: id,
    decision: z.enum(["offer", "cannot_match"]),
    message: z.string().trim().min(2).max(1000),
    validDays,
    paymentTermsDays: paymentTerms,
  }),
  allowed: reply,
  describe: async (ctx, input: ReplyInput) => {
    const inquiry = await db.negotiationRequest.findFirst({
      where: { id: input.inquiryId, supplierId: ctx.org.supplier.id },
      include: { customer: { select: { businessName: true } } },
    });
    if (!inquiry) return { error: "הפנייה לא נמצאה" };
    if (inquiry.outcome) return { error: "הפנייה כבר הסתיימה" };
    if (inquiry.replyCount >= MAX_REPLIES) return { error: "נגמרו התשובות שאפשר לשלוח לפנייה הזו" };
    const offer = input.decision === "offer";
    return {
      title: offer ? `תשובה לפנייה של ${inquiry.customer.businessName}` : `"לא נוכל להתאים" ל${inquiry.customer.businessName}`,
      lines: [
        `ההודעה ללקוח: ${input.message}`,
        ...(offer ? [`תוקף ההצעה: ${validityText(input.validDays)}`] : ["הפנייה תיסגר"]),
        `תנאי תשלום: ${termsText(input.paymentTermsDays)}`,
        `אחרי השליחה יישארו ${MAX_REPLIES - inquiry.replyCount - 1} תשובות לפנייה הזו`,
      ],
      confirmLabel: "שליחה ללקוח",
      danger: !offer,
    };
  },
  execute: async (ctx, input: ReplyInput) => {
    const sent = await sendInquiryReply(ctx.org.supplier, {
      inquiryId: input.inquiryId,
      reply: input.message,
      status: input.decision === "offer" ? "OFFERED" : "CLOSED",
      paymentTermsDays: input.paymentTermsDays,
      validUntil: validUntilFor(input.validDays),
      via: "assistant",
    });
    const link = { href: `/supplier/inquiries/${input.inquiryId}`, label: "לפנייה" };
    if (!sent.ok) return { text: `Not sent: ${sent.error}`, summary: `התשובה לא נשלחה: ${sent.error}`, link };
    return { text: "The reply was sent to the customer.", summary: "התשובה נשלחה ללקוח", link };
  },
};

interface MatchInput {
  requestId: string;
  answers: { lineId: string; response: "matched" | "counter" | "declined"; counterPrice?: number }[];
  note?: string;
  validDays: number;
  paymentTermsDays: number | null;
}

const RESPONSE = { matched: "MATCHED", counter: "COUNTER", declined: "DECLINED" } as const;

const answerMatch: Tool = {
  kind: "action",
  name: "answer_match",
  description:
    "Answer a match request, after the user approves on a card. Give an answer for every product line still waiting (lineId from get_match_request): 'matched' = match the price the customer found (only in exact mode), 'counter' = the supplier's own price per base unit in shekels (must be lower than what the customer pays today), 'declined'. The prices apply to this customer only. Only use prices the user gave you.",
  input_schema: {
    type: "object",
    properties: {
      requestId: { type: "string" },
      answers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            lineId: { type: "string" },
            response: { type: "string", enum: ["matched", "counter", "declined"] },
            counterPrice: { type: "number", description: "Shekels per base unit, excluding VAT; only for counter." },
          },
          required: ["lineId", "response"],
          additionalProperties: false,
        },
      },
      note: { type: "string", description: "Optional note to the customer, Hebrew, up to 1000 characters." },
      validDays: validDaysSchema,
      paymentTermsDays: paymentTermsSchema,
    },
    required: ["requestId", "answers", "validDays", "paymentTermsDays"],
    additionalProperties: false,
  },
  input: z.object({
    requestId: id,
    answers: z
      .array(
        z.object({
          lineId: id,
          response: z.enum(["matched", "counter", "declined"]),
          counterPrice: z.number().positive().max(100_000).optional(),
        }),
      )
      .min(1)
      .max(100),
    note: z.string().trim().max(1000).optional(),
    validDays,
    paymentTermsDays: paymentTerms,
  }),
  allowed: reply,
  describe: async (ctx, input: MatchInput) => {
    const request = await db.matchRequest.findFirst({
      where: { id: input.requestId, supplierId: ctx.org.supplier.id },
      include: { lines: true, customer: { select: { businessName: true } } },
    });
    if (!request) return { error: "הבקשה לא נמצאה" };
    if (request.status === "CLOSED" || request.outcome) return { error: "הבקשה כבר הסתיימה" };
    if (request.answerCount >= MAX_REPLIES) return { error: "נגמרו התשובות שאפשר לשלוח לבקשה הזו" };
    const lines: string[] = [];
    for (const line of request.lines) {
      if (line.decision !== "PENDING") continue;
      const unit = UNIT_LABEL[line.unit as keyof typeof UNIT_LABEL] ?? line.unit;
      const a = input.answers.find((x) => x.lineId === line.id);
      if (!a) return { error: `חסרה תשובה ל"${line.productName}"` };
      if (a.response === "matched" && request.reveal === "CEILING")
        return { error: `בבקשה הזו אפשר לענות רק במחיר שלכם ל"${line.productName}"` };
      if (a.response === "counter") {
        const counter = a.counterPrice ? Math.round(a.counterPrice * 100) : 0;
        if (!counter) return { error: `חסר מחיר להצעה הנגדית ל"${line.productName}"` };
        if (counter >= line.currentPriceAgorot)
          return { error: `ההצעה ל"${line.productName}" צריכה להיות נמוכה מ-${shekels(line.currentPriceAgorot, 2)} שהלקוח משלם היום` };
        lines.push(`${line.productName}: הצעה ${shekels(counter, 2)} ל${unit}`);
      } else if (a.response === "matched") {
        lines.push(`${line.productName}: משווה ל-${shekels(line.targetPriceAgorot, 2)} ל${unit}`);
      } else {
        lines.push(`${line.productName}: לא נוכל להתאים`);
      }
    }
    if (!lines.length) return { error: "אין מוצרים שממתינים לתשובה" };
    return {
      title: `תשובה לבקשת ההשוואה של ${request.customer.businessName}`,
      lines: [
        ...lines,
        ...(input.note ? [`הערה ללקוח: ${input.note}`] : []),
        `תוקף: ${validityText(input.validDays)}`,
        `תנאי תשלום: ${termsText(input.paymentTermsDays)}`,
        "המחירים חלים על הלקוח הזה בלבד",
      ],
      confirmLabel: "שליחה ללקוח",
    };
  },
  execute: async (ctx, input: MatchInput) => {
    const lines: MatchAnswerInput["lines"] = {};
    for (const a of input.answers) {
      lines[a.lineId] = {
        response: RESPONSE[a.response],
        counterAgorot: a.response === "counter" && a.counterPrice ? Math.round(a.counterPrice * 100) : null,
      };
    }
    const sent = await sendMatchAnswer(ctx.org.supplier, {
      requestId: input.requestId,
      lines,
      note: input.note ?? null,
      validUntil: validUntilFor(input.validDays),
      paymentTermsDays: input.paymentTermsDays,
      via: "assistant",
    });
    const link = { href: `/supplier/matches/${input.requestId}`, label: "לבקשה" };
    if (!sent.ok) return { text: `Not sent: ${sent.error}`, summary: `התשובה לא נשלחה: ${sent.error}`, link };
    return { text: "The answer was sent to the customer.", summary: "התשובה לבקשת ההשוואה נשלחה ללקוח", link };
  },
};

export const supplierTools: Tool[] = [...readTools, updatePrice, replyInquiry, answerMatch];
