import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { categoryTree, selectableCategories } from "@/lib/categories";
import { domainCategoryIds, supplierForUser } from "@/lib/supplier/catalog";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  // ספק רואה רק את סוגי המוצרים והמוצרים מהתחומים שבחר
  const domains = await domainCategoryIds(supplier);
  const [categories, catalog] = await Promise.all([
    categoryTree().then((tree) => selectableCategories(tree, domains)),
    db.product.findMany({
      where: {
        pendingReview: false,
        offers: { none: { supplierId: supplier.id } },
        ...(domains ? { categoryId: { in: domains } } : {}),
      },
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
            supplierProductName: "",
            packType: "",
            packSize: 1,
            packSizeMax: null,
            minQuantity: 0,
            minPacks: null,
            available: true,
            prices: {},
            imageSrc: null,
          }}
          categories={categories}
          catalog={catalog}
          tiers={supplier.priceTiers}
        />
      </div>
    </div>
  );
}
