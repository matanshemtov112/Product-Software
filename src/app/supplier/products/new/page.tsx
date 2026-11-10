import { requireRole } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { categoryTree, selectableCategories } from "@/lib/categories";
import { domainCategoryIds, supplierForUser } from "@/lib/supplier/catalog";
import { ProductForm } from "../product-form";

export default async function NewProductPage({ searchParams }: { searchParams: Promise<{ addPack?: string }> }) {
  const session = await requireRole("SUPPLIER");
  const supplier = await supplierForUser(session.userId);
  // אריזה נוספת למוצר שכבר ברשימה: מתחילים מפרטי המוצר, בלי אריזה ומחירים
  const { addPack } = await searchParams;
  const base = addPack
    ? await db.supplierOffer.findFirst({
        where: { id: addPack, supplierId: supplier.id },
        include: { product: { select: { name: true, categoryId: true, unit: true } } },
      })
    : null;
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
      <div>
        <h1 className="text-2xl font-bold">{base ? `אריזה נוספת: ${base.product.name}` : "מוצר חדש"}</h1>
        {base && (
          <p className="text-sm text-muted">
            מוסיפים את אותו מוצר בגודל אריזה אחר, עם מחיר משלו. הלקוח יראה בהשוואה את האריזה שמשתלמת לכמות שלו, ואת
            האחרות מתחתיה.
          </p>
        )}
      </div>
      <div className="rounded-lg border border-border bg-surface p-5">
        <ProductForm
          initial={{
            addPack: Boolean(base),
            productName: base?.product.name ?? "",
            categoryId: base?.product.categoryId ?? "",
            unit: base?.product.unit ?? "KG",
            brand: base?.brand ?? "",
            supplierSku: "",
            supplierProductName: base?.supplierProductName ?? "",
            packType: "",
            packSize: 1,
            packSizeMax: null,
            minQuantity: 0,
            minPacks: null,
            pricePerPack: false,
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
