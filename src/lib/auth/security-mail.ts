import { appUrl, deliverQueued, queueEmails } from "@/lib/email";

/** אימייל למשתמש על שינוי באבטחת החשבון שלו, כדי שיידע מיד אם זה לא הוא */
export async function notifyUserSecurity(
  user: { id: string; email: string; name: string },
  subject: string,
  what: string,
) {
  await queueEmails([
    {
      userId: user.id,
      to: user.email,
      kind: "INSTANT",
      subject: `אבטחת החשבון: ${subject}`,
      text: [
        `שלום ${user.name},`,
        "",
        what,
        "",
        `אם זה לא אתם, אפסו סיסמה מיד: ${appUrl("/forgot-password")} וכתבו לנו.`,
      ].join("\n"),
    },
  ]);
  await deliverQueued(5).catch(() => undefined);
}
