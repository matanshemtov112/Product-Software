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
        <header className="border-b border-border bg-surface">
          <nav className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
            <Link href="/" className="font-semibold text-accent">
              השוואת ספקים
            </Link>
            {session ? (
              <div className="flex items-center gap-4 text-sm">
                <Link href={HOME_BY_ROLE[session.role]}>{session.name}</Link>
                <form action={logout}>
                  <button className="text-muted hover:text-foreground">יציאה</button>
                </form>
              </div>
            ) : (
              <div className="flex items-center gap-4 text-sm">
                <Link href="/login">כניסה</Link>
                <Link href="/register" className="rounded-md bg-accent px-3 py-1.5 text-white">
                  הרשמה
                </Link>
              </div>
            )}
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
