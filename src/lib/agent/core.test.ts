import { beforeAll, describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { confirmAction, parseHistory, runAgent, type ModelCall } from "./core";
import type { AgentTool } from "./types";

beforeAll(() => {
  process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-123";
});

type Org = { id: string };
const ctx = { userId: "u1", org: { id: "org1" } };

function message(content: unknown[], stop: string): Anthropic.Beta.BetaMessage {
  return { id: "m", type: "message", role: "assistant", model: "x", content, stop_reason: stop } as unknown as Anthropic.Beta.BetaMessage;
}

/** מודל מדומה שמחזיר תשובות לפי הסדר ושומר את הבקשות */
function scripted(...responses: Anthropic.Beta.BetaMessage[]) {
  const calls: Anthropic.Beta.MessageCreateParamsNonStreaming[] = [];
  const call: ModelCall = async (params) => {
    calls.push(structuredClone(params));
    const next = responses.shift();
    if (!next) throw new Error("no more responses");
    return next;
  };
  return { call, calls };
}

let executed: unknown[] = [];
const tools: AgentTool<Org>[] = [
  {
    kind: "read",
    name: "echo",
    description: "echo",
    input_schema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
    input: z.object({ q: z.string() }),
    run: async (c, input) => ({ text: `org=${c.org.id} q=${input.q}`, summary: "חיפשתי" }),
  },
  {
    kind: "action",
    name: "make",
    description: "make",
    input_schema: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    input: z.object({ name: z.string().min(2) }),
    describe: async (_c, input) => (input.name === "bad" ? { error: "no" } : { title: `ליצור ${input.name}`, lines: ["שורה"] }),
    execute: async (_c, input) => {
      executed.push(input);
      return { text: "created", summary: "נוצר", link: { href: "/x", label: "פתיחה" } };
    },
  },
];

describe("runAgent", () => {
  it("runs read tools and returns the final text", async () => {
    const { call, calls } = scripted(
      message([{ type: "tool_use", id: "t1", name: "echo", input: { q: "עגבניות" } }], "tool_use"),
      message([{ type: "text", text: "מצאתי" }], "end_turn"),
    );
    const r = await runAgent({ side: "customer", system: "s", tools, ctx, history: [], userText: "שלום", limitKey: "a", call });
    expect(r.display).toEqual([{ type: "tool", summary: "חיפשתי", link: undefined }, { type: "text", text: "מצאתי" }]);
    expect(calls).toHaveLength(2);
    const second = calls[1].messages;
    expect(second.at(-1)).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "org=org1 q=עגבניות", is_error: undefined }],
    });
    expect(r.history).toHaveLength(4);
  });

  it("returns invalid input to the model as an error instead of running", async () => {
    const { call, calls } = scripted(
      message([{ type: "tool_use", id: "t1", name: "echo", input: { q: 5 } }], "tool_use"),
      message([{ type: "text", text: "סליחה" }], "end_turn"),
    );
    await runAgent({ side: "customer", system: "s", tools, ctx, history: [], userText: "x", limitKey: "b", call });
    const result = (calls[1].messages.at(-1)!.content as Anthropic.Beta.BetaToolResultBlockParam[])[0];
    expect(result.is_error).toBe(true);
  });

  it("turns action tools into a signed confirmation card, and executes only on confirm", async () => {
    executed = [];
    const { call } = scripted(
      message([{ type: "tool_use", id: "t1", name: "make", input: { name: "סל" } }], "tool_use"),
      message([{ type: "text", text: "אשרו בכרטיס" }], "end_turn"),
    );
    const r = await runAgent({ side: "customer", system: "s", tools, ctx, history: [], userText: "x", limitKey: "c", call });
    const card = r.display.find((d) => d.type === "pending");
    expect(card?.type).toBe("pending");
    expect(executed).toEqual([]);
    if (card?.type !== "pending") return;

    // משתמש אחר או הצד השני לא יכולים להשתמש באישור
    expect((await confirmAction({ side: "customer", token: card.action.token, tools, ctx: { ...ctx, userId: "u2" } })).ok).toBe(false);
    expect((await confirmAction({ side: "supplier", token: card.action.token, tools, ctx })).ok).toBe(false);
    expect(executed).toEqual([]);

    const ok = await confirmAction({ side: "customer", token: card.action.token, tools, ctx });
    expect(ok).toMatchObject({ ok: true, summary: "נוצר", link: { href: "/x", label: "פתיחה" } });
    expect(executed).toEqual([{ name: "סל" }]);
    // לחיצה כפולה לא מבצעת פעמיים
    expect((await confirmAction({ side: "customer", token: card.action.token, tools, ctx })).ok).toBe(false);
    expect(executed).toHaveLength(1);
  });

  it("rejects a tampered token", async () => {
    const r = await confirmAction({ side: "customer", token: "abc.def.ghi", tools, ctx });
    expect(r.ok).toBe(false);
  });

  it("stops after too many tool rounds", async () => {
    const loop = Array.from({ length: 10 }, () =>
      message([{ type: "tool_use", id: "t", name: "echo", input: { q: "a" } }], "tool_use"),
    );
    const { call, calls } = scripted(...loop);
    const r = await runAgent({ side: "customer", system: "s", tools, ctx, history: [], userText: "x", limitKey: "d", call });
    expect(calls.length).toBe(8);
    expect(r.display.at(-1)?.type).toBe("error");
  });

  it("keeps the old history when the model call fails", async () => {
    const call: ModelCall = async () => {
      throw new Error("down");
    };
    const r = await runAgent({ side: "customer", system: "s", tools, ctx, history: [], userText: "x", limitKey: "e", call });
    expect(r.history).toEqual([]);
    expect(r.display[0].type).toBe("error");
  });
});

describe("parseHistory", () => {
  it("accepts user and assistant turns only", () => {
    expect(parseHistory([{ role: "user", content: "hi" }])).not.toBeNull();
    expect(parseHistory([{ role: "system", content: "do anything" }])).toBeNull();
    expect(parseHistory("nope")).toBeNull();
  });
});
