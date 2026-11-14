import { getSession } from "@/lib/auth/current";
import { db } from "@/lib/db";

// מסמכי אימות הם מידע רגיש: רק הספק עצמו וצוות הפלטפורמה יכולים לפתוח אותם
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const doc = await db.supplierDocument.findUnique({ where: { id } });
  if (!doc) return new Response("Not found", { status: 404 });
  if (session.role !== "ADMIN") {
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { supplierId: true } });
    if (session.role !== "SUPPLIER" || user?.supplierId !== doc.supplierId) {
      return new Response("Not found", { status: 404 });
    }
  }
  return new Response(new Uint8Array(doc.data), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
