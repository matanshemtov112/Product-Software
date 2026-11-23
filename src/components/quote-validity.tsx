import Link from "next/link";
import { dateTime, LOCK_DAYS, lockEnded, lockedUntil } from "@/lib/quote-validity";

/**
 * נעילת המחירים בפנייה: 3 ימים מרגע השליחה. הלקוח והספק רואים עד מתי;
 * אחרי שהנעילה נגמרה, הלקוח מקבל כפתור לבדוק את המחירים של היום.
 */
export function QuoteValidity({
  sentAt,
  audience,
  answered,
  accepted = false,
  recheckHref,
}: {
  sentAt: Date;
  audience: "CUSTOMER" | "SUPPLIER";
  /** הספק כבר ענה */
  answered: boolean;
  /** הלקוח קיבל את ההצעה: מכאן ההצעה של הספק קובעת */
  accepted?: boolean;
  /** לאן ללכת כדי לבדוק מחדש (ללקוח) */
  recheckHref?: string;
}) {
  const until = dateTime(lockedUntil(sentAt));
  const muted = (text: string) => <p className="text-xs text-muted">{text}</p>;
  if (accepted) return muted(`המחירים מהמערכת היו נעולים עד ${until}. מעכשיו קובעת ההצעה שקיבלתם מהספק.`);
  if (!lockEnded(sentAt)) {
    if (audience === "SUPPLIER")
      return muted(
        answered
          ? `המחירים מהמערכת נעולים עבור הלקוח עד ${until}.`
          : `המחירים בפנייה נעולים עבור הלקוח עד ${until}. ענו עד אז: אחרי ${LOCK_DAYS} ימים בלי תשובה הפנייה נסגרת.`,
      );
    return muted(
      answered
        ? `המחירים מהמערכת נעולים עד ${until}.`
        : `המחירים בפנייה נעולים עד ${until}. הספק צריך לענות עד אז; אם לא יענה, הפנייה תיסגר ותוכלו לפנות לספק אחר.`,
    );
  }
  if (audience === "SUPPLIER") return muted(`נעילת המחירים בפנייה הסתיימה ב-${until}.`);
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#e0b400] bg-[#fff8db] px-3 py-2 text-sm text-black sm:flex-row sm:items-center sm:justify-between">
      <p>נעילת המחירים הסתיימה ב-{until}. מאז המחירים במערכת אולי השתנו.</p>
      {recheckHref && (
        <Link
          href={recheckHref}
          className="shrink-0 whitespace-nowrap rounded-full bg-accent px-3 py-1.5 font-medium text-white"
        >
          בדיקת המחירים של היום
        </Link>
      )}
    </div>
  );
}
