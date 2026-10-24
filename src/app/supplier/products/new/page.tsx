import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  const [categories, catalog] = await Promise.all([
    db.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.product.findMany({
      where: { pendingReview: false, offers: { none: { supplierId: supplier.id } } },
      orderBy: { name: "asc" },
      select: { name: true, categoryId: true, unit: true },
    }),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">מוצר חדש</h1>
      <div className="rounded-lg border border-border bg-surface p-5">
        <ProductForm
          initial={{
            productName: "",
            categoryId: "",
            unit: "KG",
            brand: "",
            supplierSku: "",
            packSize: 1,
            minQuantity: 0,
            available: true,
            prices: {},
          }}
          categories={categories}
          catalog={catalog}
          tiers={supplier.priceTiers}
        />
      </div>
    </div>
  );
}
