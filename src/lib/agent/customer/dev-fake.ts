import type Anthropic from "@anthropic-ai/sdk";
import type { ModelCall } from "../core";

/**
 * מודל מדומה לפיתוח ולצילומי מסך בלי מפתח API (AGENT_FAKE=1, רק מחוץ לייצור):
 * "סל" מחפש עגבניות ומציע סל, כל השאר מקבל תשובה קבועה.
 */
export function customerFakeEnabled() {
  return process.env.NODE_ENV !== "production" && process.env.AGENT_FAKE === "1";
}

const reply = (content: unknown[], stop: string) =>
  ({ id: "fake", type: "message", role: "assistant", model: "fake", content, stop_reason: stop }) as unknown as Anthropic.Beta.BetaMessage;

export const customerFakeCall: ModelCall = async ({ messages }) => {
  const last = messages.at(-1)!;
  if (Array.isArray(last.content) && last.content[0]?.type === "tool_result") {
    const result = last.content[0];
    const text = typeof result.content === "string" ? result.content : "";
    if (text.startsWith("[{")) {
      const [first] = JSON.parse(text) as { productId: string }[];
      return reply(
        [{ type: "tool_use", id: "fake-2", name: "create_basket", input: { name: "ירקות שבועי", items: [{ productId: first.productId, monthlyQuantity: 40 }] } }],
        "tool_use",
      );
    }
    return reply([{ type: "text", text: "הכנתי סל עם 40 ק״ג עגבניות בחודש. לחצו על \"יצירת הסל\" בכרטיס כדי שאצור אותו." }], "end_turn");
  }
  const said = typeof last.content === "string" ? last.content : "";
  if (said.includes("סל")) {
    return reply(
      [
        { type: "text", text: "מחפש בקטלוג…" },
        { type: "tool_use", id: "fake-1", name: "search_catalog", input: { query: "עגבניות" } },
      ],
      "tool_use",
    );
  }
  return reply([{ type: "text", text: "זה מצב הדגמה בלי חיבור ל-Claude. נסו לכתוב \"תבנה לי סל\"." }], "end_turn");
};
