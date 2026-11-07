import type { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";

const ROLE: Record<Role, string> = { CUSTOMER: "לקוח", SUPPLIER: "ספק", ADMIN: "אדמין" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireRole("ADMIN");
  const q = ((await searchParams).q ?? "").trim();
  const contains = { contains: q, mode: "insensitive" as const };
  const users = await db.user.findMany({
    where: q
      ? {
          OR: [
            { email: contains },
            { name: contains },
            { customer: { businessName: contains } },
            { supplier: { companyName: contains } },
          ],
        }
      : {},
    include: { customer: { select: { businessName: true } }, supplier: { select: { companyName: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">משתמשים</h1>
        <p className="text-sm text-muted">כל מי שנרשם למערכת. מנהל של עסק או ספק מוסיף ומסיר משתמשים בעצמו.</p>
      </div>
      <form className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="חיפוש לפי שם, מייל או עסק"
          aria-label="חיפוש משתמש"
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent"
        />
        <button className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white">חיפוש</button>
      </form>
      <section className="rounded-lg border border-border bg-surface p-2">
        {users.length === 0 ? (
          <p className="p-3 text-sm text-muted">לא נמצאו משתמשים.</p>
        ) : (
          <ul className="divide-y divide-border">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium">
                    {u.name}
                    {u.isManager && u.role !== "ADMIN" && <span className="text-xs text-muted"> · מנהל</span>}
                  </p>
                  <p className="truncate text-xs text-muted" dir="ltr">
                    {u.email}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-muted">
                  {ROLE[u.role]}
                  {(u.customer?.businessName ?? u.supplier?.companyName) &&
                    ` · ${u.customer?.businessName ?? u.supplier?.companyName}`}{" "}
                  · {u.createdAt.toLocaleDateString("he-IL")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
