import Link from "next/link";
import { Card } from "@/components/form";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ kind?: string; out?: string }> }) {
  const { kind, out } = await searchParams;
  return (
    <div className="mx-auto flex max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">כניסה</h1>
      {out === "all" && (
        <p role="status" className="rounded-md border border-border bg-surface px-3 py-2 text-sm">
          יצאתם מהחשבון בכל המכשירים.
        </p>
      )}
      <Card>
        <LoginForm initialKind={kind === "supplier" ? "supplier" : "customer"} />
      </Card>
      <p className="text-sm text-muted">
        אין לכם חשבון?{" "}
        <Link href="/register" className="text-accent">
          הרשמה
        </Link>
      </p>
    </div>
  );
}
