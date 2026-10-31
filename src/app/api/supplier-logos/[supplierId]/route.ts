import { db } from "@/lib/db";

// לוגו של ספק מוצג ללקוחות, לכן אין כאן בדיקת הרשאה
export async function GET(_: Request, { params }: { params: Promise<{ supplierId: string }> }) {
  const { supplierId } = await params;
  const logo = await db.supplierLogo.findUnique({ where: { supplierId } });
  if (!logo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.contentType,
      // הכתובת כוללת את גרסת הלוגו, כך שלוגו חדש מקבל כתובת חדשה
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
