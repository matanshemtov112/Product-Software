import Link from "next/link";
import { Card } from "@/components/form";
import { ResetForm } from "./reset-form";

export const metadata = { title: "בחירת סיסמה חדשה" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t = "" } = await searchParams;
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">בחירת סיסמה חדשה</h1>
      {t ? (
        <Card>
          <ResetForm token={t} />
        </Card>
      ) : (
        <p className="text-sm">
          הקישור חסר.{" "}
          <Link href="/forgot-password" className="text-accent">
            בקשת קישור חדש
          </Link>
        </p>
      )}
      <p className="text-xs text-muted">אחרי השינוי, כל המכשירים שהיו מחוברים לחשבון יתנתקו.</p>
    </div>
  );
}
