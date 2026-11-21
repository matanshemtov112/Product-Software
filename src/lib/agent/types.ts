import type Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

/**
 * ליבת הסוכן המשותפת ללקוח ולספק. כל צד מגדיר את הכלים שלו, את ההנחיות ואת ה"ארגון"
 * (מסעדה או ספק) שהכלים פועלים בשמו. הכלים רצים בשרת, עם ההרשאות של המשתמש המחובר בלבד.
 */

/** ההקשר שכל כלי מקבל: המשתמש המחובר והארגון שלו (כל צד מעביר את מה שהוא צריך) */
export interface AgentContext<Org> {
  userId: string;
  org: Org;
}

/** קישור שהצ'אט מציג מתחת לתשובה */
export interface AgentLink {
  href: string;
  label: string;
}

/** מה כלי מחזיר: טקסט למודל, ואם רוצים גם סיכום קצר וקישור למשתמש */
export interface ToolOutput {
  /** מה המודל רואה (טקסט או JSON). לא מוצג למשתמש */
  text: string;
  /** שורה קצרה בעברית שמוצגת בצ'אט, למשל "נוצר סל חדש: ירקות שבועי" */
  summary?: string;
  link?: AgentLink;
}

/** מה שמוצג למשתמש בכרטיס האישור לפני פעולה שמשנה משהו */
export interface ConfirmCard {
  title: string;
  lines: string[];
  /** טקסט כפתור האישור, למשל "יצירת הסל" */
  confirmLabel?: string;
  /** פעולה שמוחקת או מסירה משהו: הכפתור מוצג באדום */
  danger?: boolean;
}

interface ToolBase<Org, Input> {
  name: string;
  description: string;
  /** הסכמה שנשלחת למודל */
  input_schema: Anthropic.Beta.BetaTool.InputSchema;
  /** בדיקת הקלט בשרת לפני הרצה (המודל יכול לטעות) */
  input: z.ZodType<Input, z.ZodTypeDef, unknown>;
  /** ההרשאה שהכלי דורש מעבר לכניסה למערכת; נבדקת בכל הרצה */
  allowed?: (ctx: AgentContext<Org>) => Promise<string | null>;
}

/** כלי שרק קורא מידע: רץ מיד */
export interface ReadTool<Org, Input = unknown> extends ToolBase<Org, Input> {
  kind: "read";
  run: (ctx: AgentContext<Org>, input: Input) => Promise<ToolOutput>;
}

/**
 * כלי שמשנה משהו: לא רץ מיד. המודל מקבל "ממתין לאישור", והמשתמש רואה כרטיס.
 * רק אחרי לחיצה על אישור, הפעולה רצה בשרת מחדש (כולל כל הבדיקות ב-execute).
 */
export interface ActionTool<Org, Input = unknown> extends ToolBase<Org, Input> {
  kind: "action";
  /** מה יקרה, בעברית, או שגיאה אם אי אפשר לבצע (למשל סל שלא קיים) */
  describe: (ctx: AgentContext<Org>, input: Input) => Promise<ConfirmCard | { error: string }>;
  execute: (ctx: AgentContext<Org>, input: Input) => Promise<ToolOutput>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AgentTool<Org> = ReadTool<Org, any> | ActionTool<Org, any>;

/** פעולה שממתינה לאישור המשתמש; token חתום כדי שהדפדפן לא יוכל לשנות אותה */
export interface PendingAction {
  token: string;
  card: ConfirmCard;
}

/** מה שמוצג בצ'אט מתור אחד של הסוכן */
export type DisplayItem =
  | { type: "text"; text: string }
  | { type: "tool"; summary: string; link?: AgentLink }
  | { type: "pending"; action: PendingAction }
  | { type: "error"; text: string };

export type AgentHistory = Anthropic.Beta.BetaMessageParam[];

export interface TurnResult {
  history: AgentHistory;
  display: DisplayItem[];
}

export interface ConfirmResult {
  ok: boolean;
  /** מה קרה, בעברית */
  summary: string;
  link?: AgentLink;
  /** הודעה שנוספת להיסטוריה כדי שהסוכן ידע מה קרה */
  note: string;
}
