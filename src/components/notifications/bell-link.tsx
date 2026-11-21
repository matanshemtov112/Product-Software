"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** קישור להתראות עם מונה של התראות שלא נקראו */
export function BellLink({ href, unread }: { href: string; unread: number }) {
  const active = usePathname() === href;
  return (
    <Link
      href={href}
      className={`mx-1 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "hover:bg-background"}`}
    >
      <span className="flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d="M8 2a4 4 0 0 0-4 4v2.5L2.5 11h11L12 8.5V6a4 4 0 0 0-4-4ZM6.5 13a1.5 1.5 0 0 0 3 0"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
        </svg>
        התראות
      </span>
      {unread > 0 && (
        <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-xs font-medium text-white">
          {unread}
          <span className="sr-only"> חדשות</span>
        </span>
      )}
    </Link>
  );
}
