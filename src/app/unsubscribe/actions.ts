"use server";

import { redirect } from "next/navigation";
import { unsubscribe } from "@/lib/notify/consent";
import { readUnsubscribeToken } from "@/lib/notify/unsubscribe";

/** הסרה מרשימת התפוצה מהקישור באימייל, בלי צורך להתחבר */
export async function confirmUnsubscribe(form: FormData) {
  const token = String(form.get("t") ?? "");
  const parsed = readUnsubscribeToken(token);
  if (!parsed) redirect("/unsubscribe?bad=1");
  await unsubscribe(parsed.userId, parsed.category);
  redirect(`/unsubscribe?t=${encodeURIComponent(token)}&done=1`);
}
