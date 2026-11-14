import { Card } from "@/components/form";
import { currentMember, teamMembers } from "@/lib/auth/team";
import { updateMember } from "@/lib/auth/team-actions";
import { AddMemberForm } from "./add-member-form";

/** ניהול הצוות, משותף לעסק ולספק */
export async function TeamPage({ orgName }: { orgName: string }) {
  const me = await currentMember();
  if (!me) return null;
  const members = await teamMembers(me.org);
  const manager = me.user.isManager;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">משתמשים</h1>
        <p className="text-sm text-muted">
          מי מ{orgName} נכנס למערכת. מנהל עורך את פרטי העסק, המדרגות והצוות; משתמש רגיל עושה את כל השאר.
        </p>
      </div>
      <Card>
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {m.name}
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${m.isManager ? "bg-accent-soft text-accent" : "bg-background text-muted"}`}
                  >
                    {m.isManager ? "מנהל" : "משתמש"}
                  </span>
                  {m.id === me.user.id && <span className="text-xs text-muted">(אתם)</span>}
                </p>
                <p className="truncate text-sm text-muted" dir="ltr">
                  {m.email}
                  {m.phone ? ` · ${m.phone}` : ""}
                </p>
              </div>
              {manager && m.id !== me.user.id && (
                <form action={updateMember} className="flex shrink-0 gap-3 text-sm">
                  <input type="hidden" name="userId" value={m.id} />
                  <button
                    name="action"
                    value={m.isManager ? "member" : "manager"}
                    className="text-accent hover:underline"
                  >
                    {m.isManager ? "הפיכה למשתמש רגיל" : "הפיכה למנהל"}
                  </button>
                  <button name="action" value="remove" className="text-danger hover:underline">
                    הסרה
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {manager ? (
        <Card title="הוספת משתמש">
          <AddMemberForm />
        </Card>
      ) : (
        <p className="text-sm text-muted">רק מנהל יכול להוסיף או להסיר משתמשים.</p>
      )}
    </div>
  );
}
