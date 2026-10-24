// נתוני דמו לפיתוח: אזורים, 18 קטגוריות, קטלוג קנוני, ארבעה ספקים מומצאים, לקוח דמו ואדמין.
// הספקים והמחירים מומצאים ואינם מייצגים ספקים אמיתיים. כל המחירים ללא מע״מ.
import { PrismaClient, type Unit } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";

const db = new PrismaClient();
const ils = (n: number) => Math.round(n * 100);

const REGIONS = ["מרכז", "שרון", "ירושלים", "חיפה והקריות", "צפון", "דרום"];

const CATEGORIES = [
  "בשר ועוף",
  "דגים ופירות ים",
  "פירות וירקות",
  "מוצרי חלב",
  "ביצים",
  "מוצרים יבשים",
  "קפואים",
  "משקאות",
  "אלכוהול",
  "אריזות",
  "חומרי ניקוי",
  "חד-פעמי",
  "מאפים",
  "קפה",
  "תבלינים ורטבים",
  "ציוד מטבח",
  "ציוד למסעדות",
  "אחר",
];

const PRODUCTS: { name: string; category: string; unit: Unit; spec?: string }[] = [
  { name: "חזה עוף טרי", category: "בשר ועוף", unit: "KG", spec: "טרי, כשר" },
  { name: "שוקיים עוף", category: "בשר ועוף", unit: "KG", spec: "טרי, כשר" },
  { name: "בקר טחון", category: "בשר ועוף", unit: "KG", spec: "טרי, 15% שומן" },
  { name: "אנטריקוט", category: "בשר ועוף", unit: "KG", spec: "טרי" },
  { name: "עגבניות", category: "פירות וירקות", unit: "KG" },
  { name: "בצל יבש", category: "פירות וירקות", unit: "KG" },
  { name: "תפוחי אדמה", category: "פירות וירקות", unit: "KG" },
  { name: "מלפפונים", category: "פירות וירקות", unit: "KG" },
  { name: "חסה ערבית", category: "פירות וירקות", unit: "UNIT" },
  { name: "לימונים", category: "פירות וירקות", unit: "KG" },
  { name: "גבינה צהובה 28%", category: "מוצרי חלב", unit: "KG" },
  { name: "גבינה לבנה 5%", category: "מוצרי חלב", unit: "KG" },
  { name: "שמנת מתוקה 32%", category: "מוצרי חלב", unit: "LITER" },
  { name: "חלב 3%", category: "מוצרי חלב", unit: "LITER" },
  { name: "ביצים L", category: "ביצים", unit: "UNIT", spec: "תבנית 30" },
  { name: "קמח לבן", category: "מוצרים יבשים", unit: "KG" },
  { name: "אורז פרסי", category: "מוצרים יבשים", unit: "KG" },
  { name: "שמן קנולה", category: "מוצרים יבשים", unit: "LITER" },
  { name: "סוכר לבן", category: "מוצרים יבשים", unit: "KG" },
  { name: "פחית שתייה קלה 330 מ״ל", category: "משקאות", unit: "UNIT" },
  { name: "קופסת אלומיניום לטייק-אווי", category: "חד-פעמי", unit: "UNIT" },
];

interface DemoSupplier {
  companyName: string;
  companyNumber: string;
  categories: string[];
  minOrder: number;
  reliability: number;
  tiers: [string, number][];
  zones: { region: string; fee: number; freeAbove: number | null }[];
  /** מוצר → [גודל אריזה, מחיר במדרגה הראשונה]; המדרגות הבאות זולות ב-3% כל אחת */
  offers: Record<string, [number, number]>;
}

const SUPPLIERS: DemoSupplier[] = [
  {
    companyName: "ספק דמו: בשרים הגליל",
    companyNumber: "510000001",
    categories: ["בשר ועוף"],
    minOrder: 400,
    reliability: 0.96,
    tiers: [["רגיל", 0], ["עסקי", 10000], ["היקף גבוה", 25000]],
    zones: [{ region: "מרכז", fee: 60, freeAbove: 800 }, { region: "שרון", fee: 80, freeAbove: 1200 }],
    offers: {
      "חזה עוף טרי": [5, 31.9],
      "שוקיים עוף": [5, 21.5],
      "בקר טחון": [2, 62],
      "אנטריקוט": [1, 139],
    },
  },
  {
    companyName: "ספק דמו: הירקן הסיטונאי",
    companyNumber: "510000002",
    categories: ["פירות וירקות", "ביצים"],
    minOrder: 120,
    reliability: 0.9,
    tiers: [["רגיל", 0], ["עסקי", 5000]],
    zones: [{ region: "מרכז", fee: 45, freeAbove: 150 }],
    offers: {
      "עגבניות": [10, 6.2],
      "בצל יבש": [10, 4.1],
      "תפוחי אדמה": [10, 3.9],
      "מלפפונים": [10, 5.5],
      "חסה ערבית": [12, 4.5],
      "לימונים": [5, 7.9],
      "ביצים L": [30, 0.95],
    },
  },
  {
    companyName: "ספק דמו: מרכז המזון",
    companyNumber: "510000003",
    categories: ["בשר ועוף", "פירות וירקות", "מוצרי חלב", "מוצרים יבשים", "משקאות", "חד-פעמי", "ביצים"],
    minOrder: 600,
    reliability: 0.88,
    tiers: [["רגיל", 0], ["עסקי", 10000], ["היקף גבוה", 25000], ["ארגוני", 50000]],
    zones: [
      { region: "מרכז", fee: 0, freeAbove: null },
      { region: "שרון", fee: 50, freeAbove: 1500 },
      { region: "ירושלים", fee: 90, freeAbove: 2500 },
    ],
    offers: {
      "חזה עוף טרי": [5, 33.5],
      "בקר טחון": [2, 64.9],
      "עגבניות": [10, 6.9],
      "בצל יבש": [10, 4.4],
      "תפוחי אדמה": [10, 4.2],
      "גבינה צהובה 28%": [1, 44],
      "גבינה לבנה 5%": [1, 19.9],
      "שמנת מתוקה 32%": [1, 17.5],
      "חלב 3%": [1, 6.4],
      "ביצים L": [30, 1.05],
      "קמח לבן": [25, 3.2],
      "אורז פרסי": [5, 9.8],
      "שמן קנולה": [18, 9.5],
      "סוכר לבן": [25, 4.1],
      "פחית שתייה קלה 330 מ״ל": [24, 2.1],
      "קופסת אלומיניום לטייק-אווי": [100, 0.85],
    },
  },
  {
    companyName: "ספק דמו: מחלבות השרון",
    companyNumber: "510000004",
    categories: ["מוצרי חלב"],
    minOrder: 120,
    reliability: 0.97,
    tiers: [["רגיל", 0], ["עסקי", 3000]],
    zones: [{ region: "מרכז", fee: 40, freeAbove: 150 }, { region: "שרון", fee: 30, freeAbove: 150 }],
    offers: {
      "גבינה צהובה 28%": [1, 41.5],
      "גבינה לבנה 5%": [1, 18.9],
      "שמנת מתוקה 32%": [1, 16.9],
      "חלב 3%": [1, 6.1],
    },
  },
];

/** הסל החודשי מהאפיון (סעיף 7), עם מחיר נוכחי משוער לחישוב חיסכון */
const DEMO_BASKET: [string, number, number][] = [
  ["חזה עוף טרי", 50, 37],
  ["בקר טחון", 30, 66],
  ["עגבניות", 20, 7.5],
  ["בצל יבש", 15, 4.9],
  ["תפוחי אדמה", 10, 4.6],
  ["שמן קנולה", 20, 10.9],
  ["גבינה צהובה 28%", 15, 46],
  ["קמח לבן", 10, 3.9],
  ["פחית שתייה קלה 330 מ״ל", 120, 2.4],
  ["קופסת אלומיניום לטייק-אווי", 1000, 0.95],
];

const DEMO_PASSWORD = "demo1234";

async function main() {
  // הסקריפט מוחק את כל הנתונים; אסור להריץ אותו על סביבת ייצור
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to wipe and seed a production database. Set ALLOW_DEMO_SEED=1 to override.");
  }
  await db.$transaction([
    db.user.deleteMany(),
    db.negotiationRequest.deleteMany(),
    db.priceAlert.deleteMany(),
    db.review.deleteMany(),
    db.basket.deleteMany(),
    db.customer.deleteMany(),
    db.supplier.deleteMany(),
    db.product.deleteMany(),
    db.category.deleteMany(),
    db.region.deleteMany(),
    db.subscription.deleteMany(),
  ]);

  const regions = new Map<string, string>();
  for (const name of REGIONS) regions.set(name, (await db.region.create({ data: { name } })).id);

  const categories = new Map<string, string>();
  for (const name of CATEGORIES) categories.set(name, (await db.category.create({ data: { name } })).id);

  const products = new Map<string, string>();
  for (const p of PRODUCTS) {
    const created = await db.product.create({
      data: { name: p.name, unit: p.unit, spec: p.spec, categoryId: categories.get(p.category)! },
    });
    products.set(p.name, created.id);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  for (const [i, s] of SUPPLIERS.entries()) {
    const supplier = await db.supplier.create({
      data: {
        companyName: s.companyName,
        companyNumber: s.companyNumber,
        status: "APPROVED",
        minOrderAgorot: ils(s.minOrder),
        reliability: s.reliability,
        contactEmail: `supplier${i + 1}@demo.local`,
        categories: { create: s.categories.map((c) => ({ categoryId: categories.get(c)! })) },
        deliveryZones: {
          create: s.zones.map((z) => ({
            regionId: regions.get(z.region)!,
            feeAgorot: ils(z.fee),
            freeAboveAgorot: z.freeAbove === null ? null : ils(z.freeAbove),
            deliveryDays: "א,ג,ה",
          })),
        },
        priceTiers: { create: s.tiers.map(([name, min]) => ({ name, minMonthlyAgorot: ils(min) })) },
      },
      include: { priceTiers: { orderBy: { minMonthlyAgorot: "asc" } } },
    });
    for (const [productName, [packSize, basePrice]] of Object.entries(s.offers)) {
      await db.supplierOffer.create({
        data: {
          supplierId: supplier.id,
          productId: products.get(productName)!,
          packSize,
          prices: {
            create: supplier.priceTiers.map((tier, t) => ({
              tierId: tier.id,
              unitPriceAgorot: ils(basePrice * Math.pow(0.97, t)),
            })),
          },
        },
      });
    }
    await db.user.create({
      data: {
        email: `supplier${i + 1}@demo.local`,
        name: `נציג ${s.companyName.replace("ספק דמו: ", "")}`,
        role: "SUPPLIER",
        passwordHash,
        supplierId: supplier.id,
      },
    });
  }

  const customer = await db.customer.create({
    data: {
      businessName: "מסעדת דמו",
      businessType: "מסעדה",
      city: "תל אביב",
      regionId: regions.get("מרכז")!,
      preference: "BALANCED",
      monthlyBudgetAgorot: ils(30000),
      baskets: {
        create: {
          name: "הסל החודשי",
          deliveriesPerMonth: 4,
          items: {
            create: DEMO_BASKET.map(([name, quantity, currentPrice]) => ({
              productId: products.get(name)!,
              monthlyQuantity: quantity,
              currentUnitPriceAgorot: ils(currentPrice),
            })),
          },
        },
      },
    },
  });
  await db.user.create({
    data: { email: "customer@demo.local", name: "לקוח דמו", role: "CUSTOMER", passwordHash, customerId: customer.id },
  });
  await db.user.create({ data: { email: "admin@demo.local", name: "אדמין", role: "ADMIN", passwordHash } });

  console.log(
    `Seeded ${REGIONS.length} regions, ${CATEGORIES.length} categories, ${PRODUCTS.length} products, ${SUPPLIERS.length} suppliers. Demo password: ${DEMO_PASSWORD}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
