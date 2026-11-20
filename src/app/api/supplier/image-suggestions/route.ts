import { getSession } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { suggestImages } from "@/lib/images/suggest";
import { LIMITS, rateLimit } from "@/lib/rate-limit";

// הצעות תמונה ממאגרים פתוחים ברשת, לספקים שאינם יצרנים.
// ההצעות לא כוללות אף פעם תמונות שספקים אחרים העלו למערכת.
export async function GET(req: Request) {
  const session = await getSession();
  if (!session || session.role !== "SUPPLIER") return Response.json({ error: "unauthorized" }, { status: 401 });
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { supplier: { select: { id: true, isManufacturer: true } } },
  });
  const supplier = user?.supplier;
  if (!supplier) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (supplier.isManufacturer) return Response.json({ manufacturer: true, suggestions: [] });
  if (!rateLimit.hit(`images:${supplier.id}`, LIMITS.imageSearch)) {
    return Response.json(
      { error: "חיפשתם הרבה תמונות בשעה האחרונה. נסו שוב מאוחר יותר.", suggestions: [] },
      { status: 429 },
    );
  }
  const params = new URL(req.url).searchParams;
  const suggestions = await suggestImages({ name: params.get("name") ?? "", barcode: params.get("barcode") });
  return Response.json({ suggestions }, { headers: { "Cache-Control": "private, no-store" } });
}
