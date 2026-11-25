import type { Metadata } from "next";
import Link from "next/link";
import { getSession } from "@/lib/auth/current";
import { logout } from "@/lib/auth/actions";
import { HOME_BY_ROLE } from "@/lib/auth/session";
import "./globals.css";

export const metadata: Metadata = {
  title: "השוואת ספקים",
  description: "השוואת ספקים וסלי רכש לעסקי מזון",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getSession();
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen antialiased">
        <header className="border-b border-border">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <Link href={session ? HOME_BY_ROLE[session.role] : "/"} className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-full bg-accent text-white">
                <svg
                  width="19"
                  height="19"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 11h14l-1.5 8.5a2 2 0 0 1-2 1.5h-7a2 2 0 0 1-2-1.5z" />
                  <path d="M8 11l4-7 4 7" />
                </svg>
              </span>
              <span className="text-lg font-bold">השוואת ספקים</span>
            </Link>
            {session ? (
              <div className="flex items-center gap-2 text-sm">
                <Link
                  href={HOME_BY_ROLE[session.role]}
                  className="flex items-center gap-2 text-muted hover:text-foreground"
                >
                  <span className="max-sm:hidden">{session.name}</span>
                  <span
                    className="flex size-9 items-center justify-center rounded-full bg-sand font-bold text-foreground"
                    aria-hidden="true"
                  >
                    {session.name.trim().charAt(0)}
                  </span>
                </Link>
                <form action={logout}>
                  <button className="rounded-full px-3 py-1.5 text-muted hover:bg-sand hover:text-foreground">
                    יציאה
                  </button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <Link href="/login" className="rounded-full px-4 py-2 hover:bg-sand">
                  כניסה
                </Link>
                <Link
                  href="/register"
                  className="rounded-full bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong"
                >
                  הרשמה
                </Link>
              </div>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
