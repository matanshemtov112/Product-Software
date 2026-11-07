import { nominalPackSize } from "@/lib/pack";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/current";
import { categoryTree, selectableCategories } from "@/lib/categories";
import { getOffer, offerImageUrl, pricesByTier, supplierForUser } from "@/lib/supplier/catalog";
import { validUntilInput } from "@/lib/supplier/pricing-rules";
import { ProductForm } from "../../product-form";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const offer = await getOffer(supplier.id, id);
  if (!offer) notFound();
  const categories = selectableCategories(await categoryTree(), null);
  const byTier = pricesByTier(offer);
  // ספק שמזין מחיר לאריזה רואה את המחיר לאריזה, כפי שהזין
  const shown = (agorot: number | null | undefined) =>
    agorot ? ((offer.pricePerPack ? agorot * nominalPackSize(offer) : agorot) / 100).toFixed(2) : "";
  const prices = Object.fromEntries(
    supplier.priceTiers.map((t) => [t.id, shown(byTier.get(t.id)?.live ?? byTier.get(t.id)?.expired?.price)]),
  );
  const promoPrices = Object.fromEntries(supplier.priceTiers.map((t) => [t.id, shown(byTier.get(t.id)?.promo)]));
  const base = supplier.priceTiers[0] ? byTier.get(supplier.priceTiers[0].id) : undefined;
  const promoTier = [...byTier.values()].find((p) => p.promoValidTo);
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
            supplierProductName: offer.supplierProductName ?? "",
            packType: offer.packType ?? "",
            packSize: offer.packSize,
            packSizeMax: offer.packSizeMax,
            minQuantity: offer.minQuantity,
            minPacks: offer.minPacks,
            pricePerPack: offer.pricePerPack,
            available: offer.available,
            prices,
            imageSrc: offerImageUrl(offer),
            priceType: base?.liveValidTo || base?.expired ? "UNTIL" : "FIXED",
            validUntil: validUntilInput(base?.liveValidTo),
            promoPrices,
            promoUntil: validUntilInput(promoTier?.promoValidTo),
            deal: offer.quantityDeal
              ? {
                  min: String(offer.quantityDeal.minPacks ?? offer.quantityDeal.minPerOrder),
                  minIn: offer.quantityDeal.minPacks ? "packs" : "units",
                  type: offer.quantityDeal.priceAgorot != null ? "price" : "pct",
                  value:
                    offer.quantityDeal.priceAgorot != null
                      ? shown(offer.quantityDeal.priceAgorot)
                      : String(offer.quantityDeal.discountPct ?? ""),
                  until: validUntilInput(offer.quantityDeal.validTo),
                }
              : null,
          }}
          categories={categories}
          catalog={[]}
          tiers={supplier.priceTiers}
        />
      </div>
    </div>
  );
}
