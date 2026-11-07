import type { MatchDecision, MatchResponse, MatchStatus } from "@prisma/client";
import { shekels } from "@/lib/format";
import type { PaidComparisonLine } from "@/lib/customer/paid-prices";

export const MATCH_STATUS_LABEL: Record<MatchStatus, string> = {
  SENT: "נשלחה",
  READ: "הספק ראה",
  ANSWERED: "הספק השיב",
  CLOSED: "הסתיימה",
};

export const MATCH_RESPONSE_LABEL: Record<MatchResponse, string> = {
  PENDING: "ממתין לתשובה",
  MATCHED: "הספק משווה",
  COUNTER: "הצעה נגדית",
  DECLINED: "הספק לא משווה",
};

export const MATCH_DECISION_LABEL: Record<MatchDecision, string> = {
  PENDING: "ממתין להחלטה שלכם",
  ACCEPTED: "אישרתם",
  REJECTED: "דחיתם",
};

/** כמה ימים הספק יכול לתת להצעה שלו */
export const VALID_DAYS = [7, 14, 30, 60, 90];

/** ההצעה של הספק עדיין בתוקף (או שלא נקבע לה תוקף) */
export const isValid = (validUntil: Date | null, now = new Date()) => !validUntil || validUntil >= now;

/** בקשה פתוחה היא בקשה שהספק עוד לא ענה עליה */
export const OPEN_MATCH: MatchStatus[] = ["SENT", "READ"];

export interface MatchCandidate {
  productId: string;
  productName: string;
  unit: string;
  monthlyQuantity: number;
  currentPriceAgorot: number;
  targetPriceAgorot: number;
  monthlySavingAgorot: number;
}

/** המוצרים שאפשר לבקש עליהם השוואה: יש במערכת מחיר זול ממה שהלקוח משלם היום */
export function matchCandidates(lines: PaidComparisonLine[]): MatchCandidate[] {
  return lines
    .filter((l) => l.best && l.best.unitPriceAgorot < l.paidAgorot)
    .map((l) => ({
      productId: l.productId,
      productName: l.productName,
      unit: l.unit,
      monthlyQuantity: l.quantity,
      currentPriceAgorot: l.paidAgorot,
      targetPriceAgorot: l.best!.unitPriceAgorot,
      monthlySavingAgorot: l.monthlySavingAgorot,
    }))
    .sort((a, b) => b.monthlySavingAgorot - a.monthlySavingAgorot);
}

interface LineLike {
  monthlyQuantity: number;
  currentPriceAgorot: number;
  targetPriceAgorot: number;
  response: MatchResponse;
  counterPriceAgorot: number | null;
  decision: MatchDecision;
}

/** המחיר שהספק הציע לשורה: המחיר הזול אם השווה, ההצעה הנגדית שלו, או null */
export function offeredPrice(line: LineLike): number | null {
  if (line.response === "MATCHED") return line.targetPriceAgorot;
  if (line.response === "COUNTER") return line.counterPriceAgorot;
  return null;
}

const monthlySaving = (line: LineLike, price: number | null) =>
  price === null ? 0 : Math.max(0, Math.round((line.currentPriceAgorot - price) * line.monthlyQuantity));

export interface MatchSummary {
  /** החיסכון שהלקוח ביקש: עד המחיר הזול במערכת */
  requestedAgorot: number;
  /** החיסכון שהספק הציע (השוואה והצעות נגדיות) */
  offeredAgorot: number;
  /** החיסכון שהלקוח אישר */
  acceptedAgorot: number;
  matched: number;
  countered: number;
  declined: number;
  /** שורות עם הצעה שהלקוח עוד לא החליט עליהן */
  awaitingDecision: number;
}

export function matchSummary(lines: LineLike[]): MatchSummary {
  const s: MatchSummary = {
    requestedAgorot: 0,
    offeredAgorot: 0,
    acceptedAgorot: 0,
    matched: 0,
    countered: 0,
    declined: 0,
    awaitingDecision: 0,
  };
  for (const l of lines) {
    const price = offeredPrice(l);
    s.requestedAgorot += monthlySaving(l, l.targetPriceAgorot);
    s.offeredAgorot += monthlySaving(l, price);
    if (l.decision === "ACCEPTED") s.acceptedAgorot += monthlySaving(l, price);
    if (l.response === "MATCHED") s.matched++;
    if (l.response === "COUNTER") s.countered++;
    if (l.response === "DECLINED") s.declined++;
    if (price !== null && l.decision === "PENDING") s.awaitingDecision++;
  }
  return s;
}

/**
 * הודעה מוכנה לספק שלא רשום במערכת, לשליחה בוואטסאפ או במייל.
 * בלי שמות של ספקים אחרים.
 */
export function matchRequestText(businessName: string, lines: MatchCandidate[], unitLabel: (u: string) => string) {
  const rows = lines.map(
    (l) =>
      `• ${l.productName}: משלמים היום ${shekels(l.currentPriceAgorot, 2)} ל${unitLabel(l.unit)}, ` +
      `מצאנו ${shekels(l.targetPriceAgorot, 2)} (${l.monthlyQuantity} ${unitLabel(l.unit)} בחודש)`,
  );
  return [
    `שלום, כאן ${businessName}.`,
    "השווינו מחירים ומצאנו הצעות זולות יותר לחלק מהמוצרים שאנחנו קונים אצלכם (המחירים ללא מע״מ):",
    ...rows,
    "נשמח להמשיך לעבוד איתכם. תוכלו להשוות את המחירים, או להציע מחיר אחר?",
  ].join("\n");
}
