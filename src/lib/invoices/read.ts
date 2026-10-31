import Anthropic from "@anthropic-ai/sdk";
import { UNIT_LABEL } from "@/lib/format";

/** מוצר מהקטלוג, כפי שנשלח למודל להתאמה */
export interface InvoiceCatalogEntry {
  name: string;
  unit: keyof typeof UNIT_LABEL;
  category: string;
  aliases: string[];
}

export interface InvoiceFile {
  data: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
}

export type Confidence = "high" | "medium" | "low";

/** שורה מהחשבונית אחרי הקריאה. כמות ומחיר ביחידה של מוצר הקטלוג, המחיר באגורות ללא מע״מ */
export interface InvoiceLine {
  text: string;
  productName: string | null;
  quantity: number | null;
  unitPriceAgorot: number | null;
  confidence: Confidence;
  note?: string;
}

export interface InvoiceReading {
  supplierName: string | null;
  invoiceDate: string | null;
  lines: InvoiceLine[];
}

export type ReadResult =
  | ({ kind: "ok" } & InvoiceReading)
  | { kind: "not_configured" }
  | { kind: "refused" }
  | { kind: "error"; message: string };

export type InvoiceReader = (files: InvoiceFile[], catalog: InvoiceCatalogEntry[]) => Promise<ReadResult>;

export const INVOICE_MODEL = "claude-opus-5-5";

/** מע״מ בישראל, להמרת מחירים כשהחשבונית מציגה רק מחיר כולל מע״מ */
export const VAT_RATE = 0.18;

export function invoiceReadingEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function prompt(catalog: InvoiceCatalogEntry[]) {
  const lines = catalog
    .map(
      (c) =>
        `- ${c.name} | ${UNIT_LABEL[c.unit]} | ${c.category}${c.aliases.length ? ` | also called: ${c.aliases.join(", ")}` : ""}`,
    )
    .join("\n");
  return `You are reading a supplier invoice (חשבונית) or delivery note (תעודת משלוח) of a restaurant in Israel. It may span several pages or photos. Extract every product line so the restaurant can compare its prices with other wholesale suppliers.

For each product line:
- "text": the product description exactly as printed on the invoice.
- "product": the matching product from the platform catalog below, using its name exactly as listed. Suppliers name products differently (brands, pack sizes, abbreviations), so match on what the product is, using the category and the "also called" names. Use "" if nothing in the catalog is the same product.
- "quantity" and "unitPrice": convert to the catalog product's unit (ק״ג, ליטר or יחידה) when you can. For example a line of 2 tins of 18 liters of oil at ₪180 per tin is quantity 36 and unitPrice 10 for a product sold per liter. Take the unit price after any line discount. If there is no catalog match, give the numbers as printed. Use 0 for a number you cannot read.
- "confidence": "high" when the text, the match and the numbers are all clear; "medium" when you had to convert units or the match is likely but not certain; "low" when something is unreadable or a guess.
- "note": a short Hebrew note when confidence is not high, saying what to check, for example "לא ברור אם המחיר לקרטון או ליחידה". Otherwise "".

Skip lines that are not products: deposits (פיקדון), delivery fees, totals, VAT lines and invoice-level discounts.

Also return:
- "supplierName": the name of the supplier that issued the invoice, as printed (not the restaurant's name). "" if not visible.
- "invoiceDate": the invoice date as YYYY-MM-DD, or "" if not visible.
- "pricesIncludeVat": true only if the line prices printed on the invoice already include VAT (מע״מ). Most Israeli supplier invoices list prices before VAT and add VAT at the bottom.

Catalog (name | unit | category | other names):
${lines}`;
}

/** קורא חשבונית (תמונות או PDF) בעזרת Claude ומתאים את השורות לקטלוג */
export const claudeInvoiceReader: InvoiceReader = async (files, catalog) => {
  if (!invoiceReadingEnabled()) return { kind: "not_configured" };
  const names = catalog.map((c) => c.name);
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: INVOICE_MODEL,
      max_tokens: 16000,
      // אם המודל מסרב לבקשה מסיבות בטיחות, ה-API מריץ אותה על מודל חלופי באותה קריאה
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "medium",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              supplierName: { type: "string" },
              invoiceDate: { type: "string" },
              pricesIncludeVat: { type: "boolean" },
              lines: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string" },
                    product: { type: "string", enum: [...names, ""] },
                    quantity: { type: "number" },
                    unitPrice: { type: "number" },
                    confidence: { type: "string", enum: ["high", "medium", "low"] },
                    note: { type: "string" },
                  },
                  required: ["text", "product", "quantity", "unitPrice", "confidence", "note"],
                  additionalProperties: false,
                },
              },
            },
            required: ["supplierName", "invoiceDate", "pricesIncludeVat", "lines"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            ...files.map((f) =>
              f.mediaType === "application/pdf"
                ? ({
                    type: "document",
                    source: { type: "base64", media_type: "application/pdf", data: f.data.toString("base64") },
                  } as const)
                : ({
                    type: "image",
                    source: { type: "base64", media_type: f.mediaType, data: f.data.toString("base64") },
                  } as const),
            ),
            { type: "text", text: prompt(catalog) },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return { kind: "refused" };
    if (response.stop_reason === "max_tokens")
      return { kind: "error", message: "החשבונית ארוכה מדי. נסו להעלות פחות עמודים בכל פעם" };
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return parseInvoice(text, names);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError)
      return { kind: "error", message: "מפתח ה-API של Claude לא תקין" };
    if (error instanceof Anthropic.RateLimitError) return { kind: "error", message: "יש עומס כרגע. נסו שוב בעוד דקה" };
    if (error instanceof Anthropic.APIError) {
      console.error("invoice reading failed", error.status, error.message);
      return { kind: "error", message: "קריאת החשבונית נכשלה. נסו שוב" };
    }
    throw error;
  }
};

const positive = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * קורא את תשובת ה-JSON: משאיר רק מוצרים מהקטלוג, ממיר מחיר כולל מע״מ למחיר ללא מע״מ,
 * ומוריד את רמת הביטחון של שורה בלי כמות או מחיר.
 */
export function parseInvoice(text: string, catalogNames: string[]): ReadResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: "error", message: "קריאת החשבונית נכשלה. נסו שוב" };
  }
  const known = new Set(catalogNames);
  const obj = (raw ?? {}) as Record<string, unknown>;
  const vat = obj.pricesIncludeVat === true ? 1 + VAT_RATE : 1;
  const date = str(obj.invoiceDate);
  const lines: InvoiceLine[] = (Array.isArray(obj.lines) ? obj.lines : []).flatMap((l: Record<string, unknown>) => {
    const lineText = str(l?.text);
    if (!lineText) return [];
    const product = str(l.product);
    const quantity = positive(l.quantity);
    const price = positive(l.unitPrice);
    let confidence: Confidence = l.confidence === "high" || l.confidence === "medium" ? l.confidence : "low";
    if (!quantity || !price) confidence = "low";
    return [
      {
        text: lineText,
        productName: product && known.has(product) ? product : null,
        quantity,
        unitPriceAgorot: price ? Math.round((price * 100) / vat) : null,
        confidence,
        note: str(l.note) ?? undefined,
      },
    ];
  });
  return {
    kind: "ok",
    supplierName: str(obj.supplierName),
    invoiceDate: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
    lines,
  };
}
