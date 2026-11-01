import type { Notification } from "@prisma/client";
import Link from "next/link";
import { shekels } from "@/lib/format";
import { NOTIFICATION_ICON } from "@/lib/notifications";

const when = (d: Date) =>
  d.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });

export function NotificationList({ items, empty }: { items: Notification[]; empty: string }) {
  if (items.length === 0)
    return (
      <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-muted">
        {empty}
      </div>
    );
  return (
    <ul
      aria-label="רשימת התראות"
      className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface"
    >
      {items.map((n) => (
        <li key={n.id}>
          <Link href={n.href} className={`flex gap-3 p-4 hover:bg-background ${n.read ? "" : "bg-accent-soft/40"}`}>
            <span aria-hidden="true" className="text-lg leading-6">
              {NOTIFICATION_ICON[n.kind]}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                <span className={n.read ? "font-medium" : "font-semibold"}>
                  {!n.read && <span className="sr-only">חדש: </span>}
                  {n.title}
                </span>
                <span className="text-xs text-muted">{when(n.createdAt)}</span>
              </span>
              {n.body && <span className="text-sm text-muted">{n.body}</span>}
              {n.savingsAgorot ? (
                <span className="text-sm font-medium text-accent">חיסכון של עד {shekels(n.savingsAgorot)} בחודש</span>
              ) : null}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
