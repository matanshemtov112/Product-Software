"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** כמה זמן עבר מהבדיקה האחרונה, בניסוח קצר */
function since(iso: string | null) {
  if (!iso) return "לא נבדק";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return "נבדק היום";
  if (days < 30) return `נבדק לפני ${days} ימים`;
  return "הגיע הזמן לבדוק";
}

export function CustomerSidebar({
  businessName,
  cuisine,
  saved,
  replies,
  reviewsAboutMe,
}: {
  businessName: string;
  cuisine: string;
  saved: { id: string; name: string; lastCheck: string | null }[];
  replies: number;
  reviewsAboutMe: number;
}) {
  const pathname = usePathname();
  const item = (selected: boolean) =>
    `flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${selected ? "bg-accent-soft font-medium text-accent" : "hover:bg-background"}`;

  return (
    <nav aria-label="תפריט מסעדה" className="flex flex-col gap-4">
      <div className="px-3 pt-2">
        <p className="font-semibold">{businessName}</p>
        <p className="text-xs text-muted">{cuisine}</p>
      </div>
      <Link
        href="/customer/baskets/new"
        className="mx-1 rounded-md bg-accent px-3 py-2 text-center text-sm font-medium text-white"
      >
        + בדיקת מחירים חדשה
      </Link>
      <Link
        href="/customer/invoices/new"
        className={`mx-1 -mt-2 rounded-md border px-3 py-2 text-center text-sm font-medium ${pathname.startsWith("/customer/invoices") ? "border-accent bg-accent-soft text-accent" : "border-accent text-accent hover:bg-accent-soft"}`}
      >
        העלאת חשבונית
      </Link>
      <div>
        <p className="px-3 pb-1 text-xs font-medium text-muted">הסלים השמורים שלי</p>
        {saved.length === 0 ? (
          <p className="px-3 text-xs text-muted">אחרי בדיקה אפשר לשמור את הסל ולבדוק אותו שוב כל חודש.</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {saved.map((b) => {
              const stale = since(b.lastCheck) === "הגיע הזמן לבדוק";
              return (
                <li key={b.id}>
                  <Link
                    href={`/customer/baskets/${b.id}`}
                    className={item(pathname.startsWith(`/customer/baskets/${b.id}`))}
                  >
                    <span className="min-w-0">
                      <span className="block truncate">{b.name}</span>
                      <span className={`block text-xs ${stale ? "text-accent" : "text-muted"}`}>
                        {since(b.lastCheck)}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div>
        <p className="px-3 pb-1 text-xs font-medium text-muted">חיפוש ספקים</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link href="/customer/suppliers" className={item(pathname.startsWith("/customer/suppliers"))}>
              הספקים שלי
            </Link>
          </li>
          <li>
            <Link href="/customer/competitors" className={item(pathname === "/customer/competitors")}>
              מתחרים לספק שלי
            </Link>
          </li>
          <li>
            <Link href="/customer/photo-search" className={item(pathname === "/customer/photo-search")}>
              חיפוש מוצר בצילום
            </Link>
          </li>
        </ul>
      </div>
      <div>
        <p className="px-3 pb-1 text-xs font-medium text-muted">החשבון שלי</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link href="/customer" className={item(pathname === "/customer")}>
              סקירה ובדיקות
            </Link>
          </li>
          <li>
            <Link
              href="/customer/inquiries"
              className={item(pathname === "/customer/inquiries" || pathname.startsWith("/customer/matches"))}
            >
              <span>פניות לספקים</span>
              {replies > 0 && <span className="text-xs text-muted">{replies} תשובות</span>}
            </Link>
          </li>
          <li>
            <Link href="/customer/reviews" className={item(pathname === "/customer/reviews")}>
              <span>ביקורות עליי</span>
              {reviewsAboutMe > 0 && <span className="text-xs text-muted">{reviewsAboutMe}</span>}
            </Link>
          </li>
          <li>
            <Link href="/customer/profile" className={item(pathname === "/customer/profile")}>
              פרטי העסק
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
