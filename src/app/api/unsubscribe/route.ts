import { NextResponse, type NextRequest } from "next/server";
import { unsubscribe } from "@/lib/notify/consent";
import { readUnsubscribeToken } from "@/lib/notify/unsubscribe";

/**
 * הסרה בלחיצה אחת מתוך תוכנת הדואר (כותרת List-Unsubscribe-Post, RFC 8058).
 * GET (למשל מי שפותח את הקישור בדפדפן) מועבר לדף האישור.
 */
export async function POST(request: NextRequest) {
  const parsed = readUnsubscribeToken(request.nextUrl.searchParams.get("t") ?? "");
  if (!parsed) return NextResponse.json({ error: "invalid link" }, { status: 400 });
  await unsubscribe(parsed.userId, parsed.category);
  return NextResponse.json({ ok: true });
}

export function GET(request: NextRequest) {
  const url = new URL("/unsubscribe", request.url);
  const t = request.nextUrl.searchParams.get("t");
  if (t) url.searchParams.set("t", t);
  return NextResponse.redirect(url);
}
