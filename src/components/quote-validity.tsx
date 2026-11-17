import Link from "next/link";
import { dateTime, QUOTE_VALID_HOURS, quoteExpired, quoteValidUntil } from "@/lib/quote-validity";

/**
 * תוקף ההצעה מהמערכת: 12 שעות מרגע הפנייה. ללקוח, אחרי שפגה, מוצע לבדוק מחדש;
 * לספק מוסבר שהמחירים בהצעה הם מאותו רגע.
 */
export function QuoteValidity({
  sentAt,
  audience,
  recheckHref,
}: {
  sentAt: Date;
  audience: "CUSTOMER" | "SUPPLIER";
  /** לאן ללכת כדי לבדוק מחדש (ללקוח) */
  recheckHref?: string;
}) {
  const until = dateTime(quoteValidUntil(sentAt));
  if (!quoteExpired(sentAt)) {
    return (
      <p className="text-xs text-muted">
        המחירים מהמערכת נכונים לרגע הפנייה ובתוקף {QUOTE_VALID_HOURS} שעות, עד {until}.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-2 rounded-md border border-[#e0b400] bg-[#fff8db] px-3 py-2 text-sm text-black sm:flex-row sm:items-center sm:justify-between">
      <p>
        {audience === "CUSTOMER"
          ? `ההצעה מהמערכת הייתה בתוקף עד ${until}. מאז המחירים אולי השתנו, ולכן היא כבר לא מחייבת.`
          : `המחירים בהצעה מהמערכת הם מ-${dateTime(sentAt)} ותקפים ${QUOTE_VALID_HOURS} שעות. ייתכן שהשתנו מאז, אז כדאי להציע לפי המחירים של היום.`}
      </p>
      {audience === "CUSTOMER" && recheckHref && (
        <Link
          href={recheckHref}
          className="shrink-0 whitespace-nowrap rounded-md bg-accent px-3 py-1.5 font-medium text-white"
        >
          בדיקת המחירים של היום
        </Link>
      )}
    </div>
  );
}
