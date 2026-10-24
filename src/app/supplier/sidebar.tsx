"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export function SupplierSidebar({
  categories,
  total,
  newInquiries,
  rating,
}: {
  categories: { id: string; name: string; count: number }[];
  total: number;
  newInquiries: number;
  rating: { average: number; count: number } | null;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const onProducts = pathname === "/supplier";
  const active = params.get("category");
  const view = params.get("view");

  const href = (category?: string) => {
    const next = new URLSearchParams();
    if (category) next.set("category", category);
    if (view) next.set("view", view);
    const qs = next.toString();
    return qs ? `/supplier?${qs}` : "/supplier";
  };
  const item = (selected: boolean) =>
    `flex items-center justify-between rounded-md px-3 py-2 text-sm ${selected ? "bg-accent-soft font-medium text-accent" : "hover:bg-background"}`;

  return (
    <nav aria-label="תפריט ספק" className="flex flex-col gap-4">
      <div>
        <p className="px-3 pb-1 text-xs font-medium text-muted">המוצרים שלי</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link href={href()} className={item(onProducts && !active)}>
              <span>כל המוצרים</span>
              <span className="text-xs text-muted">{total}</span>
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={href(c.id)} className={item(onProducts && active === c.id)}>
                <span>{c.name}</span>
                <span className="text-xs text-muted">{c.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="px-3 pb-1 text-xs font-medium text-muted">לקוחות</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link href="/supplier/inquiries" className={item(pathname.startsWith("/supplier/inquiries"))}>
              <span>פניות</span>
              {newInquiries > 0 && (
                <span className="rounded-full bg-accent px-2 text-xs font-medium text-white" aria-label={`${newInquiries} חדשות`}>
                  {newInquiries}
                </span>
              )}
            </Link>
          </li>
          <li>
            <Link href="/supplier/reviews" className={item(pathname === "/supplier/reviews")}>
              <span>דירוגים</span>
              {rating && (
                <span className="text-xs text-muted" aria-label={`ממוצע ${rating.average.toFixed(1)}`}>
                  ★ {rating.average.toFixed(1)}
                </span>
              )}
            </Link>
          </li>
        </ul>
      </div>
      <div>
        <p className="px-3 pb-1 text-xs font-medium text-muted">החשבון שלי</p>
        <ul className="flex flex-col gap-0.5">
          <li>
            <Link href="/supplier/profile" className={item(pathname === "/supplier/profile")}>
              פרטי פרופיל
            </Link>
          </li>
        </ul>
      </div>
    </nav>
  );
}
