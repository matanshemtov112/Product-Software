import Link from "next/link";
import { cookies } from "next/headers";
import { Card } from "@/components/form";
import { MFA_COOKIE, readMfaPending } from "@/lib/auth/two-factor";
import { VerifyForm } from "./verify-form";

export const metadata = { title: "אימות דו-שלבי" };

export default async function VerifyPage() {
  const pending = await readMfaPending((await cookies()).get(MFA_COOKIE)?.value);
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">אימות דו-שלבי</h1>
      {pending ? (
        <>
          <p className="text-sm text-muted">פתחו את אפליקציית האימות בטלפון והקלידו את הקוד שמופיע בה עכשיו.</p>
          <Card>
            <VerifyForm />
          </Card>
        </>
      ) : (
        <p className="text-sm">
          עבר יותר מדי זמן מאז שהקלדתם סיסמה.{" "}
          <Link href="/login" className="text-accent">
            התחברו שוב
          </Link>
        </p>
      )}
    </div>
  );
}
