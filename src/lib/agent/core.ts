import Anthropic from "@anthropic-ai/sdk";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { rateLimit, type Limit } from "@/lib/rate-limit";
import type {
  ActionTool,
  AgentContext,
  AgentHistory,
  AgentTool,
  ConfirmResult,
  DisplayItem,
  TurnResult,
} from "./types";

export const AGENT_MODEL = "claude-opus-5-5";

/** כמה סבבים של כלים מותר בתור אחד, כדי שהסוכן לא ירוץ בלי סוף */
export const MAX_STEPS = 8;
/** גודל מרבי של השיחה שהדפדפן שולח (בתווים); מעבר לזה מבקשים להתחיל שיחה חדשה */
export const MAX_HISTORY_CHARS = 400_000;
/** הודעות לסוכן לכל משתמש: כל הודעה עולה כסף */
export const AGENT_LIMIT: Limit = { max: 60, windowMs: 60 * 60_000 };
/** כמה זמן כרטיס אישור בתוקף */
const PENDING_TTL = "30m";

export const NOT_CONFIGURED =
  "העוזר עוד לא מחובר: צריך להגדיר מפתח ANTHROPIC_API_KEY בהגדרות השרת. בינתיים אפשר להשתמש בכל הדפים כרגיל.";

export function agentEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

type CreateParams = Anthropic.Beta.MessageCreateParamsNonStreaming;
/** הקריאה למודל; בבדיקות מחליפים אותה בפונקציה מדומה */
export type ModelCall = (params: CreateParams) => Promise<Anthropic.Beta.BetaMessage>;

const defaultCall: ModelCall = (params) => new Anthropic().beta.messages.create(params);

const contentSchema = z.union([z.string(), z.array(z.object({ type: z.string() }).passthrough())]);
const historySchema = z.array(z.object({ role: z.enum(["user", "assistant"]), content: contentSchema }));

/** בודק שהשיחה שהגיעה מהדפדפן במבנה תקין ולא גדולה מדי */
export function parseHistory(raw: unknown): AgentHistory | null {
  const parsed = historySchema.safeParse(raw);
  if (!parsed.success) return null;
  if (JSON.stringify(parsed.data).length > MAX_HISTORY_CHARS) return null;
  return parsed.data as AgentHistory;
}

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(value);
}

/** פעולות שכבר בוצעו (כדי שלחיצה כפולה על "אישור" לא תבצע פעמיים). מספיק לשרת אחד בפיילוט */
const g = globalThis as unknown as { __agentUsed?: Map<string, number> };
const used: Map<string, number> = (g.__agentUsed ??= new Map());

function markUsed(id: string) {
  const now = Date.now();
  for (const [k, t] of used) if (now - t > 60 * 60_000) used.delete(k);
  if (used.has(id)) return false;
  used.set(id, now);
  return true;
}

interface PendingPayload {
  side: string;
  userId: string;
  tool: string;
  input: unknown;
}

export async function signPending(payload: PendingPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience("agent-action")
    .setJti(crypto.randomUUID())
    .setIssuedAt()
    .setExpirationTime(PENDING_TTL)
    .sign(secret());
}

async function verifyPending(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), { audience: "agent-action" });
    const { side, userId, tool, input, jti } = payload as Partial<PendingPayload> & { jti?: string };
    if (typeof side !== "string" || typeof userId !== "string" || typeof tool !== "string" || !jti) return null;
    return { side, userId, tool, input, jti };
  } catch {
    return null;
  }
}

function textOf(content: Anthropic.Beta.BetaContentBlock[]) {
  return content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("\n")
    .trim();
}

export interface RunOptions<Org> {
  /** "customer" או "supplier": נכנס לחתימה של פעולות שממתינות לאישור */
  side: string;
  system: string;
  tools: AgentTool<Org>[];
  ctx: AgentContext<Org>;
  history: AgentHistory;
  userText: string;
  /** מפתח להגבלת קצב (למשל לפי משתמש) */
  limitKey: string;
  effort?: "low" | "medium" | "high";
  call?: ModelCall;
}

/**
 * תור אחד בשיחה: ההודעה של המשתמש, ואז לולאה של המודל והכלים עד שיש תשובה.
 * כלים שמשנים משהו לא רצים כאן: הם הופכים לכרטיס אישור.
 */
export async function runAgent<Org>(opts: RunOptions<Org>): Promise<TurnResult> {
  const { side, system, tools, ctx, limitKey } = opts;
  const text = opts.userText.trim().slice(0, 4000);
  const display: DisplayItem[] = [];
  if (!text) return { history: opts.history, display };
  if (!opts.call && !agentEnabled()) return { history: opts.history, display: [{ type: "error", text: NOT_CONFIGURED }] };
  if (!rateLimit.hit(`agent:${limitKey}`, AGENT_LIMIT)) {
    const minutes = rateLimit.retryMinutes(`agent:${limitKey}`, AGENT_LIMIT);
    return {
      history: opts.history,
      display: [{ type: "error", text: `שלחתם הרבה הודעות לעוזר בשעה האחרונה. נסו שוב בעוד ${minutes} דקות.` }],
    };
  }

  const history: AgentHistory = [...opts.history, { role: "user", content: text }];
  const call = opts.call ?? defaultCall;
  const byName = new Map(tools.map((t) => [t.name, t]));
  const toolDefs: Anthropic.Beta.BetaTool[] = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));

  for (let step = 0; step < MAX_STEPS; step++) {
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await call({
        model: AGENT_MODEL,
        max_tokens: 16000,
        // אם המודל מסרב מסיבות בטיחות, ה-API מריץ את הבקשה על מודל חלופי באותה קריאה
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        cache_control: { type: "ephemeral" },
        output_config: { effort: opts.effort ?? "medium" },
        system,
        tools: toolDefs,
        messages: history,
      });
    } catch (error) {
      return { history: opts.history, display: [...display, { type: "error", text: errorText(error) }] };
    }

    history.push({ role: "assistant", content: response.content });
    const said = textOf(response.content);
    if (said) display.push({ type: "text", text: said });

    if (response.stop_reason === "refusal") {
      display.push({ type: "error", text: "העוזר לא יכול לעזור בבקשה הזו. נסו לנסח אחרת." });
      return { history, display };
    }
    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") {
      if (response.stop_reason === "max_tokens") display.push({ type: "error", text: "התשובה נקטעה. נסו לשאול שאלה קצרה יותר." });
      return { history, display };
    }

    const uses = response.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const use of uses) {
      const out = await runTool(side, byName.get(use.name), ctx, use.input);
      if (out.display) display.push(out.display);
      results.push({ type: "tool_result", tool_use_id: use.id, content: out.text, is_error: out.isError || undefined });
    }
    history.push({ role: "user", content: results });
  }

  display.push({ type: "error", text: "העוזר עבד על זה יותר מדי זמן ועצר. נסו לחלק את הבקשה לשלבים." });
  return { history, display };
}

async function runTool<Org>(
  side: string,
  tool: AgentTool<Org> | undefined,
  ctx: AgentContext<Org>,
  rawInput: unknown,
): Promise<{ text: string; isError?: boolean; display?: DisplayItem }> {
  if (!tool) return { text: "Unknown tool.", isError: true };
  const parsed = tool.input.safeParse(rawInput);
  if (!parsed.success) {
    return { text: `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, isError: true };
  }
  const denied = tool.allowed ? await tool.allowed(ctx) : null;
  if (denied) return { text: `Not allowed for this user: ${denied}`, isError: true, display: { type: "error", text: denied } };
  try {
    if (tool.kind === "read") {
      const out = await tool.run(ctx, parsed.data);
      return { text: out.text, display: out.summary ? { type: "tool", summary: out.summary, link: out.link } : undefined };
    }
    const card = await tool.describe(ctx, parsed.data);
    if ("error" in card) return { text: `Cannot do this: ${card.error}`, isError: true };
    const token = await signPending({ side, userId: ctx.userId, tool: tool.name, input: parsed.data });
    return {
      text:
        "Not done yet. The user now sees a confirmation card with these details and must press the approve button. " +
        "Do not call this tool again for the same request. Tell the user briefly what will happen and that they need to approve it. " +
        `Card: ${card.title}. ${card.lines.join(" | ")}`,
      display: { type: "pending", action: { token, card } },
    };
  } catch (error) {
    console.error("agent tool failed", tool.name, error);
    return { text: "The tool failed with an internal error. Tell the user to try again or use the regular page.", isError: true };
  }
}

/**
 * המשתמש לחץ "אישור" בכרטיס: בודקים את החתימה, שהכרטיס של המשתמש הזה ובצד הזה,
 * שלא בוצע כבר, ומריצים את הפעולה מחדש עם כל הבדיקות שלה.
 */
export async function confirmAction<Org>(opts: {
  side: string;
  token: string;
  tools: AgentTool<Org>[];
  ctx: AgentContext<Org>;
}): Promise<ConfirmResult> {
  const fail = (summary: string): ConfirmResult => ({ ok: false, summary, note: `[הפעולה לא בוצעה: ${summary}]` });
  const pending = await verifyPending(opts.token);
  if (!pending || pending.side !== opts.side || pending.userId !== opts.ctx.userId) {
    return fail("האישור פג או לא תקין. בקשו מהעוזר שוב.");
  }
  const tool = opts.tools.find((t) => t.name === pending.tool);
  if (!tool || tool.kind !== "action") return fail("הפעולה לא קיימת.");
  const parsed = tool.input.safeParse(pending.input);
  if (!parsed.success) return fail("הפרטים של הפעולה לא תקינים.");
  const denied = tool.allowed ? await tool.allowed(opts.ctx) : null;
  if (denied) return fail(denied);
  if (!markUsed(pending.jti)) return fail("הפעולה הזו כבר בוצעה.");
  try {
    const out = await (tool as ActionTool<Org>).execute(opts.ctx, parsed.data);
    return {
      ok: true,
      summary: out.summary ?? "בוצע",
      link: out.link,
      note: `[המשתמש אישר את הפעולה והיא בוצעה. ${out.text}]`,
    };
  } catch (error) {
    // פעולה שנכשלה אפשר לנסות שוב
    used.delete(pending.jti);
    console.error("agent action failed", tool.name, error);
    return fail("משהו השתבש. נסו שוב או השתמשו בדף הרגיל.");
  }
}

/** המשתמש לחץ "ביטול": רק הערה להיסטוריה */
export function cancelNote(title: string) {
  return `[המשתמש ביטל את הפעולה "${title}". אל תבצע אותה בלי בקשה חדשה.]`;
}

function errorText(error: unknown) {
  if (error instanceof Anthropic.AuthenticationError) return "מפתח ה-API של Claude לא תקין. צריך לבדוק אותו בהגדרות השרת.";
  if (error instanceof Anthropic.RateLimitError) return "יש עומס כרגע. נסו שוב בעוד דקה.";
  if (error instanceof Anthropic.BadRequestError) {
    console.error("agent bad request", error.message);
    return "השיחה ארוכה או לא תקינה. התחילו שיחה חדשה.";
  }
  if (error instanceof Anthropic.APIError) {
    console.error("agent call failed", error.status, error.message);
    return "העוזר לא זמין כרגע. נסו שוב בעוד כמה דקות.";
  }
  console.error("agent call failed", error);
  return "העוזר לא זמין כרגע. נסו שוב בעוד כמה דקות.";
}

/** עוזר קטן לכלים: JSON קומפקטי למודל */
export function json(value: unknown) {
  return JSON.stringify(value);
}
