import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { catalogForBasket, supplierPriceList } from "@/lib/customer/catalog";
import { customerForUser, getBasket } from "@/lib/customer/quotes";
import { BasketBuilder, type BuilderRow } from "../../basket-builder";

export default async function EditBasket({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("CUSTOMER");
  const customer = await customerForUser(session.userId);
  const basket = await getBasket(customer.id, id);
  if (!basket) notFound();

  const price = (agorot: number | null) => (agorot !== null ? (agorot / 100).toFixed(2) : "");
  const existing: BuilderRow[] = basket.items.map((i) => ({
    productId: i.productId,
    quantity: String(i.monthlyQuantity),
    price: price(i.currentUnitPriceAgorot),
    included: true,
  }));

  // סל לפי ספק נוכחי: מציגים שוב את כל הקטלוג של הספק, עם הבחירות שנשמרו
  const list = basket.source === "CURRENT_SUPPLIER" && basket.currentSupplierId
    ? await supplierPriceList(basket.currentSupplierId)
    : null;
  const catalog = list
    ? list.items.map((i) => i.product)
    : await catalogForBasket();
  const rows = list
    ? list.items.map(
        (i): BuilderRow =>
          existing.find((r) => r.productId === i.product.id) ?? {
            productId: i.product.id,
            quantity: "",
            price: price(i.priceAgorot),
            included: false,
          },
      )
    : existing;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Link href={`/customer/baskets/${basket.id}`} className="text-sm text-muted hover:text-foreground">
          → חזרה להשוואה
        </Link>
        <h1 className="text-2xl font-bold">עריכת {basket.name}</h1>
      </div>
      <div className="rounded-lg border border-border bg-surface p-5">
        <BasketBuilder
          basketId={basket.id}
          source={list ? "CURRENT_SUPPLIER" : basket.source === "CURRENT_SUPPLIER" ? "MANUAL" : basket.source}
          currentSupplier={list ? { id: list.id, name: list.name } : undefined}
          catalog={catalog}
          initialRows={rows}
          initialName={basket.name}
          initialDeliveries={basket.deliveriesPerMonth}
          submitLabel="שמירה והשוואה מחדש"
        />
      </div>
    </div>
  );
}
