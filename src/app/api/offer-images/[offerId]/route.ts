import { db } from "@/lib/db";

// תמונות מוצר אינן מידע רגיש ומוצגות גם ללקוחות, לכן אין כאן בדיקת הרשאה
export async function GET(_: Request, { params }: { params: Promise<{ offerId: string }> }) {
  const { offerId } = await params;
  const image = await db.offerImage.findUnique({ where: { offerId } });
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image.data), {
    headers: {
      "Content-Type": image.contentType,
      // הכתובת כוללת את גרסת התמונה, כך שתמונה חדשה מקבלת כתובת חדשה
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
