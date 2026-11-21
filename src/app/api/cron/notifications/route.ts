import { NextResponse } from "next/server";
import { runNotificationJobs } from "@/lib/notify/jobs";

export const dynamic = "force-dynamic";

/** הפעלה מתוזמנת של משימות ההתראות משירות חיצוני: Authorization: Bearer CRON_SECRET */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ran = await runNotificationJobs(new Date(), { force: new URL(req.url).searchParams.has("force") });
  return NextResponse.json({ ran });
}
