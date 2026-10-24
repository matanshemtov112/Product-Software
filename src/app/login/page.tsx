import Link from "next/link";
import { Card } from "@/components/form";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">כניסה</h1>
      <Card>
        <LoginForm />
      </Card>
      <p className="text-sm text-muted">
        אין לכם חשבון? <Link href="/register" className="text-accent">הרשמה</Link>
      </p>
    </div>
  );
}
