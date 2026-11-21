import { ConfirmButton } from "@/components/confirm-button";
import { Card } from "@/components/form";
import { currentMember, teamMembers } from "@/lib/auth/team";
import { updateMember } from "@/lib/auth/team-actions";
import { ROLE_DESCRIPTION, ROLE_LABEL, ROLES_FOR } from "@/lib/auth/permissions";
import { AUDIT_LABEL } from "@/lib/audit";
import { db } from "@/lib/db";
import { AddMemberForm } from "./add-member-form";

const when = (d: Date) =>
  d.toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** ניהול הצוות, משותף לעסק ולספק: כל עובד מקבל תפקיד מוכן */
export async function TeamPage({ orgName }: { orgName: string }) {
  const me = await currentMember();
  if (!me) return null;
  const members = await teamMembers(me.org);
  const manager = me.user.teamRole === "MANAGER";
  const roles = ROLES_FOR[me.role];
  // יומן הצוות: מי עשה מה, רק למנהל
  const log = manager
    ? await db.auditLog.findMany({
        where: { userId: { in: members.map((m) => m.id) }, action: { not: "login.failed" } },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    : [];
  const options = roles.map((r) => ({
    value: r,
    label: ROLE_LABEL[r],
    description: ROLE_DESCRIPTION[me.role][r] ?? "",
  }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">משתמשים</h1>
        <p className="text-sm text-muted">מי מ{orgName} נכנס למערכת, ומה כל אחד רשאי לעשות לפי התפקיד שלו.</p>
      </div>
      <Card>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li
              key={m.id}
              data-member={m.email}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {m.name}
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${m.teamRole === "MANAGER" ? "bg-accent-soft text-accent" : "bg-background text-muted"}`}
                  >
                    {ROLE_LABEL[m.teamRole]}
                  </span>
                  {m.id === me.user.id && <span className="text-xs text-muted">(אתם)</span>}
                </p>
                <p className="truncate text-sm text-muted" dir="ltr">
                  {m.email}
                  {m.phone ? ` · ${m.phone}` : ""}
                </p>
              </div>
              {manager && m.id !== me.user.id && (
                <div className="flex shrink-0 flex-wrap items-center gap-3 text-sm">
                  <form action={updateMember} className="flex items-center gap-2">
                    <input type="hidden" name="userId" value={m.id} />
                    <input type="hidden" name="action" value="role" />
                    <label className="sr-only" htmlFor={`role-${m.id}`}>
                      תפקיד
                    </label>
                    <select
                      id={`role-${m.id}`}
                      name="teamRole"
                      defaultValue={m.teamRole}
                      className="rounded-md border border-border bg-surface px-2 py-1"
                    >
                      {roles.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                    <button className="text-accent hover:underline">שמירת תפקיד</button>
                  </form>
                  <form action={updateMember}>
                    <input type="hidden" name="userId" value={m.id} />
                    <ConfirmButton
                      name="action"
                      value="remove"
                      className="text-danger hover:underline"
                      confirm={`להסיר את ${m.name} מהצוות? הכניסה למערכת עם המשתמש הזה תיחסם.`}
                    >
                      הסרה
                    </ConfirmButton>
                  </form>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card title="מה כל תפקיד יכול לעשות">
        <dl className="grid gap-2 text-sm">
          {options.map((o) => (
            <div key={o.value} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="font-medium sm:w-28 sm:shrink-0">{o.label}</dt>
              <dd className="text-muted">{o.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted">כל שינוי נרשם ביומן הפעולות עם שם העובד שביצע אותו.</p>
      </Card>
      {manager && (
        <Card title="מה הצוות עשה לאחרונה">
          {log.length === 0 ? (
            <p className="text-sm text-muted">עוד אין פעולות ביומן.</p>
          ) : (
            <ul data-team-log className="divide-y divide-border text-sm">
              {log.map((e) => (
                <li key={e.id} className="flex flex-wrap gap-x-3 py-1.5">
                  <span className="w-24 shrink-0 text-muted tabular-nums">{when(e.createdAt)}</span>
                  <span className="font-medium">{e.actor ?? "?"}</span>
                  <span>{AUDIT_LABEL[e.action] ?? e.action}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {manager ? (
        <Card title="הוספת משתמש">
          <AddMemberForm options={options} />
        </Card>
      ) : (
        <p className="text-sm text-muted">רק מנהל יכול להוסיף משתמשים, להסיר אותם ולשנות תפקידים.</p>
      )}
    </div>
  );
}
