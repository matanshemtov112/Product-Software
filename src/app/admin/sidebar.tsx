"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Pending {
  suppliers: number;
  prices: number;
  products: number;
  reviews: number;
  reports: number;
}

const ITEMS: { href: string; label: string; pending?: keyof Pending }[] = [
  { href: "/admin", label: "סקירה ודוחות" },
  { href: "/admin/suppliers", label: "ספקים", pending: "suppliers" },
  { href: "/admin/prices", label: "אישור מחירים", pending: "prices" },
  { href: "/admin/products", label: "מוצרים ושמות נרדפים", pending: "products" },
  { href: "/admin/categories", label: "קטגוריות" },
  { href: "/admin/reviews", label: "ביקורות", pending: "reviews" },
  { href: "/admin/reports", label: "דיווחים", pending: "reports" },
  { href: "/admin/users", label: "משתמשים" },
  { href: "/admin/audit", label: "יומן פעולות" },
];

export function AdminSidebar({ pending }: { pending: Pending }) {
  const pathname = usePathname();
  return (
    <nav aria-label="ניהול" className="flex flex-col gap-1">
      <p className="px-3 pt-2 pb-1 font-semibold">ניהול הפלטפורמה</p>
      <ul className="flex flex-col gap-0.5">
        {ITEMS.map((i) => {
          const active = i.href === "/admin" ? pathname === "/admin" : pathname.startsWith(i.href);
          const count = i.pending ? pending[i.pending] : 0;
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                  active ? "bg-accent-soft font-medium" : "hover:bg-background"
                }`}
              >
                <span>{i.label}</span>
                {count > 0 && (
                  <span
                    className="rounded-full bg-accent px-2 text-xs font-medium text-white"
                    aria-label={`${count} ממתינים`}
                  >
                    {count}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
