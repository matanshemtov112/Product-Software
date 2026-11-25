import Link from "next/link";
import { Card } from "@/components/form";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "שכחתי סיסמה" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">שכחתי סיסמה</h1>
      <Card>
        <ForgotForm />
      </Card>
      <Link href="/login" className="text-sm text-accent">
        חזרה לכניסה
      </Link>
    </div>
  );
}
