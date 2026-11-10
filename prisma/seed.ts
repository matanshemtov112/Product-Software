// נתוני דמו לפיתוח: אזורים, 18 קטגוריות, קטלוג קנוני, ארבעה ספקים מומצאים, לקוח דמו ואדמין.
// הספקים והמחירים מומצאים ואינם מייצגים ספקים אמיתיים. כל המחירים ללא מע״מ.
import { type PackType, PrismaClient, type Unit } from "@prisma/client";
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

/** תתי-תחומים: ספק יכול להתמחות רק בחלק מתחום, וכל מוצר משויך לתת-תחום המדויק */
const SUBCATEGORIES: Record<string, string[]> = {
  "פירות וירקות": ["ירקות אדמה ושורש", "ירקות פרי", "ירוקים, עשבי תיבול ופטריות", "פירות"],
  "בשר ועוף": ["עוף והודו", "בקר וטלה"],
  "מוצרים יבשים": ["שמנים", "קמח, אורז וסוכר", "שימורים ורטבים"],
};

/** aliases: שמות נוספים שלקוחות וספקים משתמשים בהם, לחיפוש */
const PRODUCTS: { name: string; category: string; unit: Unit; spec?: string; aliases?: string[] }[] = [
  { name: "חזה עוף טרי", category: "עוף והודו", unit: "KG", spec: "טרי, כשר" },
  { name: "שוקיים עוף", category: "עוף והודו", unit: "KG", spec: "טרי, כשר" },
  { name: "בקר טחון", category: "בקר וטלה", unit: "KG", spec: "טרי, 15% שומן", aliases: ["בשר טחון"] },
  { name: "אנטריקוט", category: "בקר וטלה", unit: "KG", spec: "טרי" },
  { name: "עגבניות", category: "ירקות פרי", unit: "KG" },
  { name: "בצל יבש", category: "ירקות אדמה ושורש", unit: "KG" },
  { name: "תפוחי אדמה", category: "ירקות אדמה ושורש", unit: "KG" },
  { name: "מלפפונים", category: "ירקות פרי", unit: "KG" },
  { name: "חסה ערבית", category: "ירוקים, עשבי תיבול ופטריות", unit: "UNIT" },
  { name: "לימונים", category: "פירות", unit: "KG" },
  { name: "גבינה צהובה 28%", category: "מוצרי חלב", unit: "KG" },
  { name: "גבינה לבנה 5%", category: "מוצרי חלב", unit: "KG" },
  { name: "שמנת מתוקה 32%", category: "מוצרי חלב", unit: "LITER" },
  { name: "חלב 3%", category: "מוצרי חלב", unit: "LITER" },
  { name: "ביצים L", category: "ביצים", unit: "UNIT", spec: "תבנית 30" },
  { name: "קמח לבן", category: "קמח, אורז וסוכר", unit: "KG", aliases: ["קמח חיטה", "קמח רב תכליתי"] },
  { name: "אורז פרסי", category: "קמח, אורז וסוכר", unit: "KG" },
  { name: "שמן קנולה", category: "שמנים", unit: "LITER", aliases: ["שמן לפתית", "שמן צמחי"] },
  { name: "שמן סויה", category: "שמנים", unit: "LITER", aliases: ["שמן צמחי"] },
  { name: "שמן חמניות", category: "שמנים", unit: "LITER", aliases: ["שמן חמנייה"] },
  { name: "שמן זית", category: "שמנים", unit: "LITER", aliases: ["שמן זית כתית"] },
  { name: "סוכר לבן", category: "קמח, אורז וסוכר", unit: "KG" },
  { name: "פחית שתייה קלה 330 מ״ל", category: "משקאות", unit: "UNIT" },
  { name: "קופסת אלומיניום לטייק-אווי", category: "חד-פעמי", unit: "UNIT" },
  { name: "גבינת מוצרלה", category: "מוצרי חלב", unit: "KG", spec: "מגורדת, לפיצה" },
  { name: "רסק עגבניות", category: "שימורים ורטבים", unit: "KG", aliases: ["פסטה עגבניות"] },
  { name: "קפה פולים", category: "קפה", unit: "KG" },
  { name: "צ׳יפס קפוא", category: "קפואים", unit: "KG", aliases: ["תפוחי אדמה קפואים", "פריט"] },
  { name: "לחמניות המבורגר", category: "מאפים", unit: "UNIT" },
  { name: "פילה סלמון", category: "דגים ופירות ים", unit: "KG", spec: "טרי" },
  { name: "בטטה", category: "ירקות אדמה ושורש", unit: "KG" },
  { name: "גזר", category: "ירקות אדמה ושורש", unit: "KG" },
  { name: "כרוב לבן", category: "ירקות אדמה ושורש", unit: "KG" },
  { name: "כוסברה", category: "ירוקים, עשבי תיבול ופטריות", unit: "UNIT", spec: "צרור" },
  { name: "פטרוזיליה", category: "ירוקים, עשבי תיבול ופטריות", unit: "UNIT", spec: "צרור" },
  { name: "נבטי אלפלפא", category: "ירוקים, עשבי תיבול ופטריות", unit: "UNIT", spec: "קופסה 100 גרם" },
  { name: "פטריות שמפיניון", category: "ירוקים, עשבי תיבול ופטריות", unit: "KG" },
];

interface DemoSupplier {
  companyName: string;
  companyNumber: string;
  /** null: הספק בחר "כל התחומים" */
  categories: string[] | null;
  minOrder: number;
  reliability: number;
  tiers: [string, number][];
  zones: { region: string; fee: number; freeAbove: number | null }[];
  /** מוצר → [גודל אריזה, מחיר במדרגה הראשונה, השם של הספק למוצר]; המדרגות הבאות זולות ב-3% כל אחת */
  offers: Record<string, [number, number] | [number, number, string]>;
}

/** איך כל מוצר מגיע אצל ספקי הדמו: סוג אריזה, משקל משתנה ומינימום באריזות */
const DEMO_PACKS: Record<
  string,
  { packType: PackType; packSize?: number; packSizeMax?: number; minPacks?: number; minQuantity?: number; pricePerPack?: boolean }
> = {
  אנטריקוט: { packType: "CARTON", packSize: 15, packSizeMax: 20, minPacks: 1 },
  "חזה עוף טרי": { packType: "CARTON", packSize: 5, packSizeMax: 6 },
  "שוקיים עוף": { packType: "CARTON", packSize: 5, packSizeMax: 6 },
  "בקר טחון": { packType: "PACK" },
  "צ׳יפס קפוא": { packType: "CARTON" },
  עגבניות: { packType: "CRATE", minPacks: 1 },
  "בצל יבש": { packType: "SACK" },
  "תפוחי אדמה": { packType: "SACK" },
  מלפפונים: { packType: "CRATE" },
  "חסה ערבית": { packType: "CRATE" },
  לימונים: { packType: "CRATE" },
  "ביצים L": { packType: "TRAY", minPacks: 2 },
  בטטה: { packType: "CRATE" },
  גזר: { packType: "SACK" },
  "כרוב לבן": { packType: "CRATE" },
  "קמח לבן": { packType: "SACK" },
  "אורז פרסי": { packType: "SACK" },
  "סוכר לבן": { packType: "SACK" },
  "שמן קנולה": { packType: "TIN", pricePerPack: true },
  "שמן סויה": { packType: "TIN", pricePerPack: true },
  "שמן זית": { packType: "TIN", pricePerPack: true },
  "שמן חמניות": { packType: "BOTTLE" },
  "גבינה צהובה 28%": { packType: "PACK", minQuantity: 5 },
  "חלב 3%": { packType: "CARTON" },
  "פחית שתייה קלה 330 מ״ל": { packType: "CARTON" },
};

const SUPPLIERS: DemoSupplier[] = [
  {
    companyName: "ספק דמו: בשרים הגליל",
    companyNumber: "510000011",
    categories: ["בשר ועוף", "קפואים"],
    minOrder: 400,
    reliability: 0.96,
    tiers: [["רגיל", 0], ["עסקי", 20000], ["היקף גבוה", 100000]],
    zones: [{ region: "מרכז", fee: 0, freeAbove: null }, { region: "שרון", fee: 0, freeAbove: null }],
    offers: {
      "חזה עוף טרי": [5, 31.9],
      "שוקיים עוף": [5, 21.5],
      "בקר טחון": [2, 62],
      "אנטריקוט": [1, 139],
      "צ׳יפס קפוא": [10, 9.4, "צ'יפס חתוך דק"],
    },
  },
  {
    companyName: "ספק דמו: הירקן הסיטונאי",
    companyNumber: "510000029",
    categories: ["פירות וירקות", "ביצים"],
    // ספק ירקות אדמה ופרי: זול שם, יקר בירוקים
    minOrder: 120,
    reliability: 0.9,
    tiers: [["רגיל", 0], ["עסקי", 5000]],
    zones: [{ region: "מרכז", fee: 0, freeAbove: null }],
    offers: {
      "עגבניות": [10, 6.2],
      "בצל יבש": [10, 4.1],
      "תפוחי אדמה": [10, 3.9],
      "מלפפונים": [10, 5.5],
      "חסה ערבית": [12, 4.5],
      "לימונים": [5, 7.9],
      "ביצים L": [30, 0.95],
      "בטטה": [10, 5.2],
      "גזר": [10, 3.6],
      "כרוב לבן": [10, 3.9],
      // ירוקים ופטריות הם לא ההתמחות שלו, והמחיר בהתאם
      "כוסברה": [10, 3.9],
      "פטרוזיליה": [10, 3.9],
      "פטריות שמפיניון": [2, 24],
    },
  },
  {
    companyName: "ספק דמו: מרכז המזון",
    companyNumber: "510000037",
    categories: null,
    minOrder: 600,
    reliability: 0.88,
    tiers: [["רגיל", 0], ["עסקי", 20000], ["היקף גבוה", 50000], ["ארגוני", 100000]],
    zones: [
      { region: "מרכז", fee: 0, freeAbove: null },
      { region: "שרון", fee: 0, freeAbove: null },
      { region: "ירושלים", fee: 0, freeAbove: null },
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
      // לכל ספק שם משלו למוצר; הלקוח מוצא אותו גם בשם הקנוני וגם בשם של הספק
      "שמן קנולה": [18, 9.5, "קנולה פח 18 ל׳"],
      "שמן סויה": [18, 8.9, "סויה פח 18 ל׳"],
      "שמן חמניות": [5, 11.2, "חמניות בקבוק 5 ל׳"],
      "שמן זית": [4, 32, "זית כתית מעולה 4 ל׳"],
      "סוכר לבן": [25, 4.1],
      "פחית שתייה קלה 330 מ״ל": [24, 2.1],
      "קופסת אלומיניום לטייק-אווי": [100, 0.85],
      "גבינת מוצרלה": [2, 36],
      "רסק עגבניות": [5, 8.9],
      "קפה פולים": [1, 72],
      "צ׳יפס קפוא": [10, 8.9, "פריט 9 מ״מ"],
      "לחמניות המבורגר": [40, 1.35],
      "פילה סלמון": [1, 98],
    },
  },
  {
    companyName: "ספק דמו: מחלבות השרון",
    companyNumber: "510000045",
    categories: ["מוצרי חלב"],
    minOrder: 120,
    reliability: 0.97,
    tiers: [["רגיל", 0], ["עסקי", 10000]],
    zones: [{ region: "מרכז", fee: 0, freeAbove: null }, { region: "שרון", fee: 0, freeAbove: null }],
    offers: {
      "גבינה צהובה 28%": [1, 41.5],
      "גבינה לבנה 5%": [1, 18.9],
      "שמנת מתוקה 32%": [1, 16.9],
      "חלב 3%": [1, 6.1],
      "גבינת מוצרלה": [2, 34.5],
    },
  },
  {
    companyName: "ספק דמו: ירוקי השדה",
    companyNumber: "510000052",
    categories: ["ירוקים, עשבי תיבול ופטריות"],
    minOrder: 60,
    reliability: 0.94,
    tiers: [["רגיל", 0], ["עסקי", 5000]],
    zones: [{ region: "מרכז", fee: 0, freeAbove: null }, { region: "שרון", fee: 0, freeAbove: null }],
    offers: {
      "חסה ערבית": [12, 3.4],
      "כוסברה": [10, 2.3],
      "פטרוזיליה": [10, 2.3],
      "נבטי אלפלפא": [6, 4.5],
      "פטריות שמפיניון": [2, 16.5],
    },
  },
  {
    // ספק בדרום בלבד: לא משנה את ההשוואות של לקוחות הדמו במרכז, אבל נותן לספקים "מיקום מול השוק"
    companyName: "ספק דמו: סיטונאות הנגב",
    companyNumber: "510000060",
    categories: ["בשר ועוף", "קפואים", "פירות וירקות", "מוצרי חלב", "ביצים"],
    minOrder: 500,
    reliability: 0.9,
    tiers: [["רגיל", 0], ["עסקי", 20000]],
    zones: [{ region: "דרום", fee: 0, freeAbove: null }],
    offers: {
      "חזה עוף טרי": [5, 32.9],
      "בקר טחון": [2, 66],
      "צ׳יפס קפוא": [10, 9.9],
      "עגבניות": [10, 6.5],
      "בצל יבש": [10, 4.3],
      "תפוחי אדמה": [10, 3.8],
      "גבינה צהובה 28%": [1, 43],
      "חלב 3%": [1, 6.3],
      "שמנת מתוקה 32%": [1, 17.2],
      "ביצים L": [30, 0.99],
      "גבינת מוצרלה": [2, 35.5],
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
  ["אורז פרסי", 40, 10.5],
  ["פחית שתייה קלה 330 מ״ל", 120, 2.4],
  ["קופסת אלומיניום לטייק-אווי", 1000, 0.95],
];

/** עסקים מומצאים נוספים שכותבים ביקורות ופניות, בלי חשבון משתמש */
const DEMO_BUSINESSES = [
  { businessName: "קפה דמו", businessType: "בית קפה", city: "רמת גן" },
  { businessName: "פיצריה דמו", businessType: "פיצריה", city: "חולון" },
  { businessName: "מטבח קייטרינג דמו", businessType: "קייטרינג", city: "ראשון לציון" },
  { businessName: "ביסטרו דמו", businessType: "מסעדה", city: "תל אביב" },
  { businessName: "מאפיית דמו", businessType: "מאפייה", city: "בת ים" },
  { businessName: "דיינר דמו", businessType: "מסעדה", city: "הרצליה" },
];

/** ביקורות לפי מספר ספק: [עסק, כוכבים, הערה]; שאר הנושאים נגזרים מהכוכבים */
const DEMO_REVIEWS: Record<number, [number, number, string | null][]> = {
  0: [
    [0, 5, "בשר איכותי ומגיע תמיד בזמן. הנהג אדיב."],
    [1, 4, "מחירים טובים, פעם אחת הייתה החלפה במוצר בלי לעדכן."],
    [2, 5, "עובדים איתם שנתיים, אמינים מאוד."],
    [3, 4, null],
    [4, 3, "האיכות טובה אבל קשה להשיג אותם בטלפון."],
    [5, 5, "שירות מעולה, מתקנים טעויות מהר."],
  ],
  1: [
    [0, 4, "ירקות טריים, לפעמים מאחרים בבוקר."],
    [3, 5, "הכי טריים שעבדנו איתם."],
    [5, 3, null],
  ],
  2: [
    [1, 4, "נוח לקבל הכל מספק אחד."],
    [2, 3, "מגוון גדול, האיכות משתנה בין מוצרים."],
    [3, 4, null],
    [4, 4, "מחירים הוגנים ומשלוח חינם."],
    [5, 3, "חסרו מוצרים פעמיים בחודש האחרון."],
  ],
  3: [
    [0, 5, "מוצרי חלב טריים תמיד."],
    [4, 5, null],
  ],
};

const DEMO_PASSWORD = "demo1234";

async function main() {
  // הסקריפט מוחק את כל הנתונים; אסור להריץ אותו על סביבת ייצור
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_SEED !== "1") {
    throw new Error("Refusing to wipe and seed a production database. Set ALLOW_DEMO_SEED=1 to override.");
  }
  await db.$transaction([
    db.user.deleteMany(),
    db.abuseReport.deleteMany(),
    db.auditLog.deleteMany(),
    db.negotiationRequest.deleteMany(),
    db.matchRequest.deleteMany(),
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
  for (const [parent, children] of Object.entries(SUBCATEGORIES)) {
    for (const name of children) {
      categories.set(name, (await db.category.create({ data: { name, parentId: categories.get(parent)! } })).id);
    }
  }

  const products = new Map<string, string>();
  for (const p of PRODUCTS) {
    const created = await db.product.create({
      data: { name: p.name, unit: p.unit, spec: p.spec, aliases: p.aliases ?? [], categoryId: categories.get(p.category)! },
    });
    products.set(p.name, created.id);
  }

  const passwordHash = await hashPassword(DEMO_PASSWORD);

  const businesses = [];
  for (const b of DEMO_BUSINESSES) {
    businesses.push(await db.customer.create({ data: { ...b, regionId: regions.get("מרכז")! } }));
  }

  for (const [i, s] of SUPPLIERS.entries()) {
    const supplier = await db.supplier.create({
      data: {
        companyName: s.companyName,
        companyNumber: s.companyNumber,
        status: "APPROVED",
        minOrderAgorot: ils(s.minOrder),
        reliability: s.reliability,
        contactEmail: `supplier${i + 1}@demo.local`,
        allCategories: s.categories === null,
        categoriesSetAt: new Date(),
        description: `ספק דמו בתחומי ${(s.categories ?? ["מזון"]).join(", ")}. משרתים מסעדות ובתי קפה.`,
        openingHours: "ימים א׳ עד ה׳ משש בבוקר עד שלוש, ו׳ עד 11",
        deliveryTerms: "הזמנה עד 14:00 מגיעה למחרת בבוקר, בימים א, ג, ה.",
        categories: { create: (s.categories ?? []).map((c) => ({ categoryId: categories.get(c)! })) },
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
    for (const [productName, [packSize, basePrice, supplierProductName]] of Object.entries(s.offers)) {
      const pack = DEMO_PACKS[productName];
      await db.supplierOffer.create({
        data: {
          supplierId: supplier.id,
          productId: products.get(productName)!,
          supplierProductName,
          packSize,
          ...pack,
          prices: {
            create: supplier.priceTiers.map((tier, t) => ({
              tierId: tier.id,
              unitPriceAgorot: ils(basePrice * Math.pow(0.97, t)),
            })),
          },
        },
      });
    }
    for (const [k, [business, stars, text]] of (DEMO_REVIEWS[i] ?? []).entries()) {
      const near = (d: number) => Math.max(1, Math.min(5, stars + d));
      await db.review.create({
        data: {
          customerId: businesses[business].id,
          supplierId: supplier.id,
          overall: stars,
          quality: near(k % 2 ? 0 : 1),
          price: near(-1 + (k % 2)),
          reliability: near(0),
          service: near(k % 3 ? 0 : -1),
          responsiveness: near(-(k % 2)),
          accuracy: near(0),
          resolution: near(k % 3 ? -1 : 0),
          text,
          status: "PUBLISHED",
          createdAt: new Date(Date.now() - (k + 1) * 9 * 86_400_000),
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

  // אותו מוצר בשתי אריזות אצל אותו ספק: שק 5 ק״ג ושק 25 ק״ג, זול יותר לק״ג
  const center = await db.supplier.findFirstOrThrow({
    where: { companyNumber: "510000037" },
    include: { priceTiers: { orderBy: { minMonthlyAgorot: "asc" } } },
  });
  await db.supplierOffer.create({
    data: {
      supplierId: center.id,
      productId: products.get("אורז פרסי")!,
      packType: "SACK",
      packSize: 25,
      prices: {
        create: center.priceTiers.map((tier, t) => ({
          tierId: tier.id,
          unitPriceAgorot: ils(8.9 * Math.pow(0.97, t)),
        })),
      },
    },
  });

  const customer = await db.customer.create({
    data: {
      businessName: "מסעדת דמו",
      businessType: "מסעדה",
      city: "תל אביב",
      address: "רחוב הדמו 1",
      regionId: regions.get("מרכז")!,
      totalVolumeMinAgorot: ils(30000),
      totalVolumeMaxAgorot: ils(50000),
      preference: "BALANCED",
      cuisine: "מסעדה בשרית",
      monthlyBudgetAgorot: ils(30000),
      baskets: {
        create: {
          name: "הסל החודשי",
          deliveriesPerMonth: 4,
          currentSupplierName: "סיטונאות דמו (לא רשום במערכת)",
          savedAt: new Date(Date.now() - 31 * 86_400_000),
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
  // סל שני, שהספק הנוכחי שלו רשום במערכת: כך אפשר לנסות "בקש מהספק שלי להשוות"
  const foodCenter = await db.supplier.findFirstOrThrow({ where: { companyNumber: "510000037" } });
  await db.basket.create({
    data: {
      customerId: customer.id,
      name: "בשר ושמן",
      source: "INVOICE",
      deliveriesPerMonth: 4,
      currentSupplierId: foodCenter.id,
      currentSupplierName: foodCenter.companyName,
      savedAt: new Date(Date.now() - 7 * 86_400_000),
      items: {
        create: (
          [
            ["חזה עוף טרי", 50, 34.5],
            ["בקר טחון", 30, 65],
            ["שמן קנולה", 20, 9.9],
          ] as const
        ).map(([name, quantity, currentPrice]) => ({
          productId: products.get(name)!,
          monthlyQuantity: quantity,
          currentUnitPriceAgorot: ils(currentPrice),
        })),
      },
    },
  });
  // בדיקה מלפני חודש, כדי שבכניסה לסל השמור יוצג מה השתנה מאז אצל כל ספק
  const basket = await db.basket.findFirstOrThrow({ where: { customerId: customer.id, name: "הסל החודשי" } });
  const supplierIds = Object.fromEntries(
    (await db.supplier.findMany({ select: { id: true, companyNumber: true, companyName: true } })).map((s) => [
      s.companyNumber,
      s,
    ]),
  );
  const lastMonth: [string, number, number][] = [
    ["510000011", 3575, 2],
    ["510000037", 6020, 10],
    ["510000045", 623, 1],
  ];
  await db.optimizationRun.create({
    data: {
      basketId: basket.id,
      preference: "BALANCED",
      bestCostAgorot: ils(6010),
      result: {
        lowestCostAgorot: ils(6010),
        recommendedAgorot: ils(6010),
        suppliers: Object.fromEntries(
          lastMonth.map(([number, total, items]) => [
            supplierIds[number].id,
            { name: supplierIds[number].companyName, totalAgorot: ils(total), items },
          ]),
        ),
      },
      createdAt: new Date(Date.now() - 31 * 86_400_000),
    },
  });

  await db.user.create({
    data: { email: "customer@demo.local", name: "לקוח דמו", role: "CUSTOMER", passwordHash, customerId: customer.id },
  });
  await db.user.create({ data: { email: "admin@demo.local", name: "אדמין", role: "ADMIN", passwordHash } });

  // פנייה לדוגמה אצל ספק הבשר: בית קפה שמעדיף אותו למרות פער קטן
  const meat = await db.supplier.findUniqueOrThrow({ where: { companyNumber: "510000011" } });
  const quoteLines = [
    { productName: "חזה עוף טרי", unit: "KG", quantity: 40, billedQuantity: 40, unitPrice: 31.9 },
    { productName: "שוקיים עוף", unit: "KG", quantity: 20, billedQuantity: 20, unitPrice: 21.5 },
  ];
  const lines = quoteLines.map(({ unitPrice, ...l }) => ({
    ...l,
    unitPriceAgorot: ils(unitPrice),
    lineTotalAgorot: Math.round(ils(unitPrice) * l.billedQuantity),
  }));
  const productsAgorot = lines.reduce((sum, l) => sum + l.lineTotalAgorot, 0);
  await db.negotiationRequest.create({
    data: {
      customerId: businesses[0].id,
      supplierId: meat.id,
      gapAgorot: ils(64),
      totalAgorot: productsAgorot,
      quote: { tierName: "רגיל", lines, productsAgorot, deliveryAgorot: 0, totalAgorot: productsAgorot, missingProducts: [] },
      customerProfile: {
        businessName: "קפה דמו",
        businessType: "בית קפה",
        cuisine: "בית קפה",
        city: "רמת גן",
        region: "מרכז",
        contactName: "נועה (דמו)",
        phone: "050-0000000",
        email: "cafe@demo.local",
        monthlyVolume: "₪10,000–30,000",
        deliveriesPerMonth: 4,
        basketName: "עוף לבית הקפה",
        itemCount: 2,
        customerSince: new Date().toLocaleDateString("he-IL"),
      },
      message:
        "שלום, אנחנו קפה דמו ומעוניינים לעבוד איתכם. קיבלנו דרך המערכת את ההצעה שלכם, אבל יש פער של ₪64 בחודש מול ספק מתחרה. נשמח לשמוע אם תוכלו להתאים את המחיר.",
      createdAt: new Date(Date.now() - 2 * 3_600_000),
    },
  });

  // מסעדת הדמו פנתה בעבר לשני ספקים, והם כתבו עליה ביקורת
  const pastInquiries: [string, string, string, number, number, number, string][] = [
    ["510000011", "נשמח לשמוע על מחיר קבוע לחזה עוף.", "נוכל לתת ₪33 לק״ג בהתחייבות חודשית.", 5, 5, 4, "לקוח מסודר, משלמים בזמן ומזמינים יום מראש."],
    ["510000037", "יש אפשרות למשלוח פעמיים בשבוע?", "כן, ללא תוספת מעל ₪1,500 להזמנה.", 4, 4, 5, "תקשורת מצוינת. פעם אחת התשלום התעכב בשבוע."],
  ];
  for (const [number, message, reply, overall, payment, communication, text] of pastInquiries) {
    const supplierId = supplierIds[number].id;
    const at = new Date(Date.now() - 20 * 86_400_000);
    await db.negotiationRequest.create({
      data: { customerId: customer.id, supplierId, gapAgorot: 0, message, reply, status: "OFFERED", repliedAt: at, createdAt: at },
    });
    await db.customerReview.create({ data: { customerId: customer.id, supplierId, overall, payment, communication, text } });
  }

  // התראות לדוגמה, כדי שיהיה מה לראות במסך ההתראות
  const monthly = await db.basket.findFirstOrThrow({ where: { customerId: customer.id, name: "הסל החודשי" } });
  await db.notification.createMany({
    data: [
      {
        customerId: customer.id,
        kind: "CHEAPER_SUPPLIER",
        title: "נמצא מחיר זול יותר לחזה עוף טרי",
        body: "ספק דמו: בשרים הגליל מוכר ב-₪31.90 לק״ג, ואתם משלמים היום ₪37.00 לק״ג.",
        href: `/customer/baskets/${monthly.id}`,
        savingsAgorot: ils(255),
        createdAt: new Date(Date.now() - 2 * 86_400_000),
      },
      {
        customerId: customer.id,
        kind: "PRICE_INCREASE",
        title: "ספק דמו: מרכז המזון העלה את המחיר של שמן קנולה",
        body: "מ-₪9.20 לליטר ל-₪9.50 לליטר במחירון.",
        href: `/customer/baskets/${monthly.id}`,
        createdAt: new Date(Date.now() - 5 * 86_400_000),
      },
      {
        supplierId: supplierIds["510000011"].id,
        kind: "NEW_INQUIRY",
        title: "פנייה חדשה מקפה דמו",
        body: "לקוח מבקש הצעה לסל חודשי של בשר ועוף.",
        href: "/supplier/inquiries",
        createdAt: new Date(Date.now() - 86_400_000),
      },
    ],
  });

  // היסטוריית מחירים לדוח החודשי: המחירון קיים כבר חודשיים, ובאמצע החודש הקודם כמה ספקים שינו מחיר.
  // המחירים של היום לא משתנים: נוספת שורה ישנה עם המחיר שהיה לפני השינוי.
  const now = new Date();
  const longAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const midLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 15);
  await db.offerPrice.updateMany({ data: { validFrom: longAgo, createdAt: longAgo } });
  await db.customer.update({ where: { id: customer.id }, data: { createdAt: longAgo } });
  await db.basket.updateMany({ where: { customerId: customer.id, name: "הסל החודשי" }, data: { createdAt: longAgo } });
  await db.basket.updateMany({
    where: { customerId: customer.id, name: "בשר ושמן" },
    data: { createdAt: new Date(longAgo.getTime() + 86_400_000) },
  });
  const history: [string, string, number][] = [
    ["510000037", "שמן קנולה", 0.95], // מרכז המזון העלה ב-5%
    ["510000037", "בקר טחון", 1.04], // מרכז המזון הוריד ב-4%
    ["510000011", "חזה עוף טרי", 1.06], // בשרים הגליל הוריד ב-6%
  ];
  for (const [number, productName, factor] of history) {
    const offer = await db.supplierOffer.findFirst({
      where: { supplierId: supplierIds[number].id, productId: products.get(productName)! },
      include: { prices: true },
    });
    if (!offer) continue;
    for (const p of offer.prices) {
      await db.offerPrice.update({ where: { id: p.id }, data: { validFrom: midLastMonth, createdAt: midLastMonth } });
      await db.offerPrice.create({
        data: {
          offerId: offer.id,
          tierId: p.tierId,
          unitPriceAgorot: Math.round(p.unitPriceAgorot * factor),
          validFrom: longAgo,
          createdAt: longAgo,
        },
      });
    }
  }
  // סוגי מחיר לדמו: מחיר עם תוקף (מרכז המזון, שמן קנולה) ומבצע (בשרים הגליל, בקר טחון)
  const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const canola = await db.supplierOffer.findFirst({
    where: { supplierId: supplierIds["510000037"].id, productId: products.get("שמן קנולה")! },
  });
  if (canola) {
    await db.offerPrice.updateMany({
      where: { offerId: canola.id, validFrom: midLastMonth },
      data: { validTo: endOfNextMonth, termEndsAt: endOfNextMonth },
    });
  }
  const beefPromo = await db.supplierOffer.findFirst({
    where: { supplierId: supplierIds["510000011"].id, productId: products.get("בקר טחון")! },
    include: { prices: { where: { validTo: null } }, supplier: { include: { priceTiers: true } } },
  });
  if (beefPromo) {
    const baseTier = [...beefPromo.supplier.priceTiers].sort((a, b) => a.minMonthlyAgorot - b.minMonthlyAgorot)[0];
    const regular = beefPromo.prices.find((p) => p.tierId === baseTier.id);
    const promoEnds = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 11);
    if (regular) {
      await db.offerPrice.create({
        data: {
          offerId: beefPromo.id,
          tierId: baseTier.id,
          unitPriceAgorot: Math.round(regular.unitPriceAgorot * 0.93),
          kind: "PROMOTION",
          validFrom: new Date(now.getTime() - 2 * 86_400_000),
          createdAt: new Date(now.getTime() - 2 * 86_400_000),
          validTo: promoEnds,
          termEndsAt: promoEnds,
        },
      });
    }
  }
  // מבצעי כמות לדמו: שמן קנולה מ-5 פחים בהזמנה במחיר מוזל, ופחיות שתייה מ-10 קרטונים בהזמנה 10% הנחה
  if (canola) {
    await db.quantityDeal.create({
      data: { offerId: canola.id, minPerOrder: 90, minPacks: 5, priceAgorot: ils(8.9), validTo: endOfNextMonth },
    });
  }
  const cans = await db.supplierOffer.findFirst({
    where: { supplierId: supplierIds["510000037"].id, productId: products.get("פחית שתייה קלה 330 מ״ל")! },
  });
  if (cans) {
    await db.quantityDeal.create({ data: { offerId: cans.id, minPerOrder: 240, minPacks: 10, discountPct: 10 } });
  }
  // בקשת השוואה מהחודש הקודם: מרכז המזון השווה את מחיר חזה העוף והלקוח אישר
  const decided = new Date(now.getFullYear(), now.getMonth() - 1, 20);
  const meatAndOil = await db.basket.findFirstOrThrow({ where: { customerId: customer.id, name: "בשר ושמן" } });
  await db.matchRequest.create({
    data: {
      customerId: customer.id,
      supplierId: supplierIds["510000037"].id,
      basketId: meatAndOil.id,
      status: "CLOSED",
      supplierNote: "בשמחה, המחיר בתוקף מההזמנה הבאה.",
      validUntil: new Date(decided.getTime() + 30 * 86_400_000),
      answeredAt: new Date(decided.getTime() - 86_400_000),
      createdAt: new Date(decided.getTime() - 2 * 86_400_000),
      lines: {
        create: {
          productId: products.get("חזה עוף טרי")!,
          productName: "חזה עוף טרי",
          unit: "KG",
          monthlyQuantity: 50,
          currentPriceAgorot: ils(36),
          targetPriceAgorot: ils(34.5),
          response: "MATCHED",
          decision: "ACCEPTED",
          decidedAt: decided,
        },
      },
    },
  });

  // דברים שממתינים לאדמין, כדי שיהיה מה לראות בממשק הניהול
  const pendingSupplier = await db.supplier.create({
    data: {
      companyName: "ספק דמו: דגי הים התיכון",
      companyNumber: "510000078",
      status: "PENDING",
      minOrderAgorot: ils(300),
      contactEmail: "supplier7@demo.local",
      allCategories: false,
      categoriesSetAt: new Date(),
      categories: { create: [{ categoryId: categories.get("דגים ופירות ים")! }] },
      deliveryZones: { create: [{ regionId: regions.get("מרכז")!, deliveryDays: "ב,ה" }] },
      priceTiers: { create: [{ name: "רגיל", minMonthlyAgorot: 0 }] },
    },
  });
  await db.user.create({
    data: {
      email: "supplier7@demo.local",
      name: "נציג דגי הים התיכון",
      phone: "050-0000007",
      role: "SUPPLIER",
      passwordHash,
      supplierId: pendingSupplier.id,
    },
  });
  // מחיר קפה שקפץ ביותר מ-30%: כנראה מחיר לשק במקום לק״ג
  const coffee = await db.supplierOffer.findFirstOrThrow({
    where: { supplierId: supplierIds["510000037"].id, productId: products.get("קפה פולים")! },
    include: { supplier: { include: { priceTiers: { orderBy: { minMonthlyAgorot: "asc" }, take: 1 } } } },
  });
  await db.offerPrice.create({
    data: {
      offerId: coffee.id,
      tierId: coffee.supplier.priceTiers[0].id,
      unitPriceAgorot: ils(99),
      status: "PENDING_APPROVAL",
    },
  });
  // ספק הוסיף מוצר שכבר קיים בקטלוג בשם אחר
  const duplicate = await db.product.create({
    data: {
      name: "עגבניה",
      unit: "KG",
      categoryId: (await db.product.findUniqueOrThrow({ where: { name: "עגבניות" } })).categoryId,
      pendingReview: true,
    },
  });
  const greens = await db.supplier.findUniqueOrThrow({
    where: { companyNumber: "510000052" },
    include: { priceTiers: true },
  });
  await db.supplierOffer.create({
    data: {
      supplierId: greens.id,
      productId: duplicate.id,
      supplierProductName: "עגבניה טריה",
      packSize: 10,
      prices: { create: greens.priceTiers.map((t) => ({ tierId: t.id, unitPriceAgorot: ils(5.9) })) },
    },
  });
  await db.review.create({
    data: {
      customerId: businesses[1].id,
      supplierId: greens.id,
      overall: 2,
      quality: 3,
      price: 2,
      reliability: 2,
      service: 2,
      responsiveness: 2,
      accuracy: 2,
      resolution: 2,
      text: "המשלוח הגיע באיחור פעמיים החודש, והכוסברה הייתה נבולה.",
      status: "PENDING",
    },
  });

  // דיווח פתוח לדוגמה: מסעדת הדמו חושבת שמחיר אצל מרכז המזון לא נכון
  const demoUser = await db.user.findUniqueOrThrow({ where: { email: "customer@demo.local" } });
  await db.abuseReport.create({
    data: {
      reporterUserId: demoUser.id,
      reporterName: demoUser.name,
      targetType: "SUPPLIER",
      targetId: supplierIds["510000037"].id,
      targetName: supplierIds["510000037"].companyName,
      reason: "WRONG_PRICE",
      text: "המחיר של בקר טחון במערכת נמוך ממה שהם גובים בפועל בחשבונית.",
      path: "/customer/suppliers",
    },
  });

  // משתמשי הדמו הם מנהלי העסק או הספק שלהם
  await db.user.updateMany({ where: { role: { in: ["CUSTOMER", "SUPPLIER"] } }, data: { isManager: true } });

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
