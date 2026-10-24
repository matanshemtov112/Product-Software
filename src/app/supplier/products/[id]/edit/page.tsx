import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { getOffer, offerImageUrl, pricesByTier, supplierForUser } from "@/lib/supplier/catalog";
import { ProductForm } from "../../product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const offer = await getOffer(supplier.id, id);
  if (!offer) notFound();
  const categories = await db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const byTier = pricesByTier(offer);
  const prices = Object.fromEntries(
    supplier.priceTiers.map((t) => {
      const p = byTier.get(t.id);
      const agorot = p?.live;
      return [t.id, agorot ? (agorot / 100).toFixed(2) : ""];
    }),
  );
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">עריכת {offer.product.name}</h1>
      <div className="rounded-lg border border-border bg-surface p-5">
        <ProductForm
          initial={{
            offerId: offer.id,
            productName: offer.product.name,
            categoryId: offer.product.categoryId,
            unit: offer.product.unit,
            brand: offer.brand ?? "",
            supplierSku: offer.supplierSku ?? "",
            packSize: offer.packSize,
            minQuantity: offer.minQuantity,
            available: offer.available,
            prices,
            imageSrc: offerImageUrl(offer),
          }}
          categories={categories}
          catalog={[]}
          tiers={supplier.priceTiers}
        />
      </div>
    </div>
  );
}
