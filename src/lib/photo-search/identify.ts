import Anthropic from "@anthropic-ai/sdk";

export interface CatalogEntry {
  name: string;
  category: string;
}

export interface PhotoImage {
  data: Buffer;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
}

/** מה המודל זיהה בתמונה, בשמות מתוך הקטלוג בלבד */
export type Identification =
  | { kind: "ok"; description: string; exact: string[]; similar: string[] }
  | { kind: "not_configured" }
  | { kind: "refused" }
  | { kind: "error"; message: string };

export type Identifier = (image: PhotoImage, catalog: CatalogEntry[]) => Promise<Identification>;

export const PHOTO_MODEL = "claude-opus-5-5";

/** החיפוש בצילום פעיל רק כשהוגדר מפתח API בסביבה */
export function photoSearchEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function prompt(catalog: CatalogEntry[]) {
  const lines = catalog.map((c) => `- ${c.name} (${c.category})`).join("\n");
  return `You are helping a restaurant in Israel find which wholesale food suppliers sell a product. The user photographed a product (it may be raw produce, a packaged item, or a piece of kitchen equipment) and wants to know who sells it.

Identify the product in the photo and match it to the platform's catalog below. Use only names exactly as they appear in the catalog.

- "exact": catalog products that are the same product as in the photo (usually zero or one).
- "similar": up to three catalog products that could replace it or are the closest alternatives, most similar first. Leave empty if nothing in the catalog is reasonably close.
- "description": one short sentence in Hebrew describing what you see, for example "פטריות שמפיניון לבנות טריות בקופסה". If the photo does not show a food or kitchen product, say so in that sentence and leave both lists empty.

Catalog (product name, then its category):
${lines}`;
}

/** מזהה את המוצר בתמונה בעזרת Claude, ומחזיר רק שמות שקיימים בקטלוג */
export const claudeIdentifier: Identifier = async (image, catalog) => {
  if (!photoSearchEnabled()) return { kind: "not_configured" };
  const names = catalog.map((c) => c.name);
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: PHOTO_MODEL,
      max_tokens: 4000,
      // אם המודל מסרב לבקשה מסיבות בטיחות, ה-API מריץ אותה על מודל חלופי באותה קריאה
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: {
        effort: "low",
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              description: { type: "string" },
              exact: { type: "array", items: { type: "string", enum: names } },
              similar: { type: "array", items: { type: "string", enum: names } },
            },
            required: ["description", "exact", "similar"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data.toString("base64") } },
            { type: "text", text: prompt(catalog) },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return { kind: "refused" };
    const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
    return parseIdentification(text, names);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { kind: "error", message: "מפתח ה-API של Claude לא תקין" };
    if (error instanceof Anthropic.RateLimitError) return { kind: "error", message: "יש עומס כרגע. נסו שוב בעוד דקה" };
    if (error instanceof Anthropic.APIError) {
      console.error("photo search failed", error.status, error.message);
      return { kind: "error", message: "הזיהוי נכשל. נסו שוב" };
    }
    throw error;
  }
};

/** קורא את תשובת ה-JSON ומשאיר רק שמות מהקטלוג, בלי כפילויות */
export function parseIdentification(text: string, catalogNames: string[]): Identification {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { kind: "error", message: "הזיהוי נכשל. נסו שוב" };
  }
  const known = new Set(catalogNames);
  const obj = (raw ?? {}) as Record<string, unknown>;
  const pick = (v: unknown) =>
    Array.isArray(v) ? [...new Set(v.filter((n): n is string => typeof n === "string" && known.has(n)))] : [];
  const exact = pick(obj.exact);
  const similar = pick(obj.similar).filter((n) => !exact.includes(n));
  const description = typeof obj.description === "string" ? obj.description.trim() : "";
  return { kind: "ok", description, exact, similar };
}
