import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getSession } from "@/lib/auth/current";
import { can } from "@/lib/auth/permission-check";
import { db } from "@/lib/db";
import { priceListCsv } from "@/lib/supplier/price-sheet";
import { loadSheetOffers, loadSheetTiers } from "@/lib/supplier/price-sheet-load";

/** הורדת המחירון של הספק כקובץ שנפתח באקסל, לעדכון והעלאה בחזרה */
export async function GET() {
  const session = await getSession();
  if (session?.role !== "SUPPLIER") return new NextResponse("Not found", { status: 404 });
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { supplierId: true, role: true },
  });
  if (!user?.supplierId || user.role !== "SUPPLIER" || !(await can("prices", session.userId))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const [offers, tiers] = await Promise.all([loadSheetOffers(user.supplierId), loadSheetTiers(user.supplierId)]);
  await audit({
    action: "pricelist.downloaded",
    targetType: "supplier",
    targetId: user.supplierId,
    details: { rows: offers.length },
  });
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jerusalem" });
  return new NextResponse(priceListCsv(offers, tiers), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pricelist-${day}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
