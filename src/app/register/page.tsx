import { Card } from "@/components/form";
import { db } from "@/lib/db";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const { kind } = await searchParams;
  const regions = await db.region.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold">הרשמה</h1>
      <Card>
        <RegisterForm regions={regions} initialKind={kind === "supplier" ? "supplier" : "customer"} />
      </Card>
    </div>
  );
}
