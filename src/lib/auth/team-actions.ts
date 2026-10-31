"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "./password";
import { currentMember } from "./team";

export interface TeamFormState {
  error?: string;
  added?: string;
}

const PATH = { CUSTOMER: "/customer/team", SUPPLIER: "/supplier/team" } as const;

async function manager() {
  const member = await currentMember();
  if (!member?.user.isManager) return null;
  return member;
}

const memberSchema = z.object({
  name: z.string().trim().min(2, "שם קצר מדי").max(60),
  email: z.string().trim().toLowerCase().email("אימייל לא תקין"),
  phone: z.string().trim().max(20).optional(),
  password: z.string().min(8, "סיסמה של 8 תווים לפחות"),
  isManager: z.literal("on").optional(),
});

/** המנהל מוסיף משתמש לעסק או לספק, עם סיסמה ראשונית שהוא מעביר לו */
export async function addMember(_: TeamFormState, form: FormData): Promise<TeamFormState> {
  const me = await manager();
  if (!me) return { error: "רק מנהל יכול להוסיף משתמשים" };
  const parsed = memberSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "פרטים חסרים" };
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email } })) return { error: "כבר קיים חשבון עם האימייל הזה" };
  await db.user.create({
    data: {
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      passwordHash: await hashPassword(d.password),
      role: me.role,
      isManager: d.isManager === "on",
      ...me.org,
    },
  });
  revalidatePath(PATH[me.role]);
  return { added: d.email };
}

/** הסרת משתמש או שינוי הרשאה; תמיד נשאר לפחות מנהל אחד */
export async function updateMember(form: FormData) {
  const me = await manager();
  if (!me) return;
  const userId = String(form.get("userId") ?? "");
  const action = String(form.get("action") ?? "");
  const target = await db.user.findFirst({ where: { id: userId, ...me.org } });
  if (!target || target.id === me.user.id) return;
  if (action === "remove") await db.user.delete({ where: { id: target.id } });
  else if (action === "manager" || action === "member")
    await db.user.update({ where: { id: target.id }, data: { isManager: action === "manager" } });
  revalidatePath(PATH[me.role]);
}
