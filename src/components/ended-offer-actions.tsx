import Link from "next/link";
import { deleteOffer, hideOffer } from "@/app/customer/history/actions";
import { ConfirmForm } from "./confirm-form";

/** ליד פנייה שהסתיימה: פנייה חדשה לאותו ספק, הסתרה מהרשימה, או מחיקה ממנה */
export function EndedOfferActions({
  id,
  kind,
  supplierName,
  newHref,
  back,
}: {
  id: string;
  kind: "inquiry" | "match";
  supplierName: string;
  newHref: string;
  /** לאן לחזור אחרי הסתרה או מחיקה */
  back: string;
}) {
  const what = kind === "match" ? "בקשת ההשוואה" : "הפנייה";
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link href={newHref} className="rounded-full bg-accent px-3 py-1.5 font-medium text-white">
        פנייה חדשה
      </Link>
      <ConfirmForm
        needs="buy"
        action={hideOffer}
        fields={{ id, kind, back }}
        confirm={`להסתיר את ${what} ל${supplierName} מהרשימה שלכם? אפשר להחזיר אותה מדף ההיסטוריה.`}
        className="text-muted hover:underline"
      >
        הסתרה
      </ConfirmForm>
      <ConfirmForm
        needs="buy"
        action={deleteOffer}
        fields={{ id, kind, back }}
        confirm={`למחוק את ${what} ל${supplierName} מהרשימה שלכם? אי אפשר להחזיר אותה. אצל הספק היא נשארת.`}
        className="text-danger hover:underline"
      >
        מחיקה
      </ConfirmForm>
    </div>
  );
}
