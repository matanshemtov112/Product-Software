import { db } from "@/lib/db";
import { UNIT_LABEL } from "@/lib/format";
import { isDealSnapshot } from "@/lib/customer/deals";
import { isQuoteSnapshot } from "@/lib/inquiries";
import { MATCH_RESPONSE_LABEL, supplierFacing, revealText } from "@/lib/matches";
import { MAX_REPLIES } from "@/lib/notify/limits";
import { inquiryStage, matchStage, OFFER_STAGE_LABEL } from "@/lib/offer-status";
import { packLabel } from "@/lib/pack";
import { lastValidDay, shortDate, VERIFIED_DAYS } from "@/lib/price-status";
import { LOCK_DAYS } from "@/lib/quote-validity";
import { listOffers, pricesByTier, type OfferWithPrices } from "@/lib/supplier/catalog";
import { MARKET_BAND_LABEL, MIN_SUPPLIERS } from "@/lib/supplier/market";
import { supplierMarket } from "@/lib/supplier/market-load";
import { supplierStats } from "@/lib/supplier/stats";
import { areaTermsText } from "@/lib/terms";

/**
 * מה עוזר ה-AI של הספק יכול לקרוא. הכול מסונן לספק המחובר בלבד, ובאותם כללים כמו המסכים:
 * בלי מחירים של מתחרים (רק מיקום, טווח וחציון כשיש לפחות 3 ספקים), ובלי פרטי קשר של לקוחות.
 * הערכים הם טקסט ומספרים פשוטים, מוכנים להעברה למודל כ-JSON.
 */

const DAY = 86_400_000;
const nis = (agorot: number | null | undefined) => (agorot == null ? null : Math.round(agorot) / 100);
const day = (d: Date | null | undefined) => (d ? shortDate(d) : null);

export interface SupplierRef {
  id: string;
  companyName: string;
}

/** מוצר של הספק עם המחירים בכל מדרגה, כפי שמוצג לעוזר */
export function describeOffer(offer: OfferWithPrices, tiers: { id: string; name: string }[], now = new Date()) {
  const byTier = pricesByTier(offer, now);
  const unit = offer.product.unit;
  const prices = tiers.map((t) => {
    const p = byTier.get(t.id);
    return {
      tierId: t.id,
      tier: t.name,
      regular: nis(p?.live),
      regularUntil: p?.liveValidTo ? day(lastValidDay(p.liveValidTo)) : null,
      regularSince: day(p?.liveSince),
      promotion: nis(p?.promo),
      promotionUntil: p?.promoValidTo ? day(lastValidDay(p.promoValidTo)) : null,
      pendingApproval: nis(p?.pending),
      expired: p?.expired ? { price: nis(p.expired.price), endedOn: day(lastValidDay(p.expired.validTo)) } : null,
    };
  });
  const newest = Math.max(0, ...[...byTier.values()].map((p) => p.liveSince?.getTime() ?? 0));
  return {
    offerId: offer.id,
    product: offer.product.name,
    supplierName: offer.supplierProductName,
    category: offer.product.category.name,
    brand: offer.brand,
    sku: offer.supplierSku,
    unit: UNIT_LABEL[unit],
    pack: packLabel({ ...offer, unit }),
    priceEnteredPerPack: offer.pricePerPack,
    available: offer.available,
    pricesPerUnit: prices,
    daysSincePriceUpdate: newest ? Math.floor((now.getTime() - newest) / DAY) : null,
    quantityDeal: offer.quantityDeal
      ? {
          fromQuantity: offer.quantityDeal.minPerOrder,
          discountPct: offer.quantityDeal.discountPct,
          price: nis(offer.quantityDeal.priceAgorot),
          until: offer.quantityDeal.validTo ? day(lastValidDay(offer.quantityDeal.validTo)) : null,
        }
      : null,
    link: `/supplier/products/${offer.id}`,
  };
}

async function tiersOf(supplierId: string) {
  return db.priceTier.findMany({
    where: { supplierId },
    orderBy: { minMonthlyAgorot: "asc" },
    select: { id: true, name: true, minMonthlyAgorot: true },
  });
}

export async function searchProducts(supplier: SupplierRef, query: string, limit = 15) {
  const [offers, tiers] = await Promise.all([listOffers(supplier.id, { q: query }), tiersOf(supplier.id)]);
  return {
    total: offers.length,
    shown: Math.min(offers.length, limit),
    tiers: tiers.map((t) => ({ tierId: t.id, name: t.name, fromMonthlyShekels: nis(t.minMonthlyAgorot) })),
    products: offers.slice(0, limit).map((o) => describeOffer(o, tiers)),
  };
}

/** מצב כללי: מוצרים בלי מחיר, מחירים ישנים, ממתינים לאישור, פניות פתוחות וחשיפה בהשוואות */
export async function overview(supplier: SupplierRef) {
  const offers = await listOffers(supplier.id, {});
  const [stats, openInquiries, openMatches, areas, supplierRow] = await Promise.all([
    supplierStats(supplier.id, offers),
    db.negotiationRequest.count({ where: { supplierId: supplier.id, outcome: null, repliedAt: null } }),
    db.matchRequest.count({ where: { supplierId: supplier.id, outcome: null, answeredAt: null } }),
    db.deliveryArea.count({ where: { supplierId: supplier.id } }),
    db.supplier.findUnique({
      where: { id: supplier.id },
      select: { status: true, verifiedAt: true, verifiedUntil: true },
    }),
  ]);
  const now = new Date();
  return {
    products: offers.length,
    unavailable: offers.filter((o) => !o.available).length,
    withoutPrice: stats.withoutPrice,
    pendingApproval: stats.pendingPrice,
    staleOver30Days: stats.stalePrice,
    unansweredInquiries: openInquiries,
    unansweredMatchRequests: openMatches,
    last30Days: { appearancesInComparisons: stats.views, differentCustomers: stats.customers, requests: stats.leads },
    deliveryCircles: areas,
    verified: Boolean(supplierRow?.verifiedAt && (!supplierRow.verifiedUntil || supplierRow.verifiedUntil > now)),
    suspended: supplierRow?.status === "SUSPENDED",
  };
}

/** מוצרים שדורשים עדכון מחיר: ישנים, שתוקפם פג או עומד לפוג, בלי מחיר, או ממתינים לאישור */
export async function priceAttention(supplier: SupplierRef, now = new Date()) {
  const [offers, tiers] = await Promise.all([listOffers(supplier.id, {}), tiersOf(supplier.id)]);
  const soon = now.getTime() + 7 * DAY;
  const rows = offers.flatMap((o) => {
    const byTier = [...pricesByTier(o, now).values()];
    const live = byTier.filter((t) => t.live !== null);
    const newest = Math.max(0, ...live.map((t) => t.liveSince?.getTime() ?? 0));
    const reasons: string[] = [];
    if (byTier.some((t) => t.expired)) reasons.push("תוקף המחיר פג והמוצר לא מופיע בהשוואות");
    else if (live.length === 0) reasons.push("אין מחיר בתוקף");
    if (live.some((t) => t.liveValidTo && t.liveValidTo.getTime() <= soon)) reasons.push("תוקף המחיר נגמר בשבוע הקרוב");
    if (byTier.some((t) => t.promoValidTo && t.promoValidTo.getTime() <= soon)) reasons.push("המבצע נגמר בשבוע הקרוב");
    if (live.length && now.getTime() - newest > VERIFIED_DAYS * DAY)
      reasons.push(`המחיר לא עודכן ${Math.floor((now.getTime() - newest) / DAY)} ימים, ולקוחות רואים שהוא ישן`);
    if (byTier.some((t) => t.pending !== null)) reasons.push("שינוי מחיר ממתין לאישור מנהל המערכת");
    if (!reasons.length) return [];
    const base = describeOffer(o, tiers, now);
    return [{ offerId: o.id, product: base.product, pack: base.pack, prices: base.pricesPerUnit, reasons, link: base.link }];
  });
  return { count: rows.length, products: rows.slice(0, 30) };
}

/** המיקום מול השוק: דירוג, טווח וחציון בלבד. מוצר עם פחות מ-3 ספקים לא מוצג (אחרת קל לנחש את המתחרה) */
export async function marketPositions(supplier: SupplierRef, query = "") {
  const rows = await supplierMarket(supplier.id);
  const q = query.trim();
  const filtered = q ? rows.filter((r) => r.productName.includes(q) || r.category.includes(q)) : rows;
  return {
    rule: `מוצגים רק מוצרים שלפחות ${MIN_SUPPLIERS} ספקים מוכרים. אין מחירים של ספק מסוים ואין שמות של מתחרים.`,
    products: filtered.slice(0, 30).map((r) => ({
      offerId: r.offerId,
      product: r.productName,
      unit: r.unitLabel,
      myBasePrice: nis(r.ownAgorot),
      position: r.position
        ? {
            rank: r.position.rank,
            suppliers: r.position.suppliers,
            band: MARKET_BAND_LABEL[r.position.band],
            marketMedian: nis(r.position.medianAgorot),
          }
        : "פחות מ-3 ספקים מוכרים את המוצר, ולכן אין נתוני שוק",
    })),
  };
}

const replyDeadline = (createdAt: Date) => new Date(createdAt.getTime() + LOCK_DAYS * DAY);

/** פניות ובקשות השוואה שעוד לא הסתיימו. בלי פרטי קשר: הם נחשפים רק אחרי שהלקוח מקבל הצעה */
export async function openRequests(supplier: SupplierRef) {
  const [inquiries, matches] = await Promise.all([
    db.negotiationRequest.findMany({
      where: { supplierId: supplier.id, outcome: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { customer: { select: { businessName: true, businessType: true, city: true } } },
    }),
    db.matchRequest.findMany({
      where: { supplierId: supplier.id, outcome: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        customer: { select: { businessName: true, businessType: true, city: true } },
        _count: { select: { lines: true } },
      },
    }),
  ]);
  return {
    inquiries: inquiries.map((i) => ({
      inquiryId: i.id,
      customer: `${i.customer.businessName} (${i.customer.businessType}, ${i.customer.city})`,
      sentOn: day(i.createdAt),
      status: OFFER_STAGE_LABEL[inquiryStage(i)],
      basketTotalPerMonth: nis(i.totalAgorot),
      gapToCheaperOption: nis(i.gapAgorot),
      answered: Boolean(i.repliedAt),
      repliesLeft: Math.max(0, MAX_REPLIES - i.replyCount),
      ...(i.repliedAt ? {} : { closesIfUnansweredOn: day(replyDeadline(i.createdAt)) }),
      link: `/supplier/inquiries/${i.id}`,
    })),
    matchRequests: matches.map((m) => ({
      requestId: m.id,
      customer: `${m.customer.businessName} (${m.customer.businessType}, ${m.customer.city})`,
      sentOn: day(m.createdAt),
      status: OFFER_STAGE_LABEL[matchStage(m)],
      products: m._count.lines,
      answered: Boolean(m.answeredAt),
      repliesLeft: Math.max(0, MAX_REPLIES - m.answerCount),
      link: `/supplier/matches/${m.id}`,
    })),
  };
}

/** פנייה אחת, כפי שהספק רואה אותה בדף הפנייה, בלי פרטי קשר */
export async function inquiryDetails(supplier: SupplierRef, inquiryId: string) {
  const i = await db.negotiationRequest.findFirst({
    where: { id: inquiryId, supplierId: supplier.id },
    include: { customer: { select: { businessName: true, businessType: true, city: true } } },
  });
  if (!i) return null;
  const quote = isQuoteSnapshot(i.quote) ? i.quote : null;
  const deal = isDealSnapshot(i.deal) ? i.deal : null;
  return {
    inquiryId: i.id,
    customer: `${i.customer.businessName} (${i.customer.businessType}, ${i.customer.city})`,
    sentOn: day(i.createdAt),
    status: OFFER_STAGE_LABEL[inquiryStage(i)],
    customerMessage: i.message,
    basketTotalPerMonth: nis(i.totalAgorot),
    gapToCheaperOption: nis(i.gapAgorot),
    pricesLockedForCustomerUntil: day(replyDeadline(i.createdAt)),
    quote: quote
      ? {
          tier: quote.tierName,
          lines: quote.lines.map((l) => ({
            product: l.productName,
            monthlyQuantity: l.quantity,
            unit: UNIT_LABEL[l.unit],
            myUnitPrice: nis(l.unitPriceAgorot),
            lineTotal: nis(l.lineTotalAgorot),
            customerPaysTodayPerUnit: nis(l.customerPaidAgorot ?? null),
          })),
          missingProducts: quote.missingProducts,
        }
      : null,
    deal,
    previousReply: i.reply,
    repliesLeft: Math.max(0, MAX_REPLIES - i.replyCount),
    contact: "פרטי הקשר של הלקוח מוצגים בדף הפנייה רק אחרי שהלקוח מקבל את ההצעה",
    link: `/supplier/inquiries/${i.id}`,
  };
}

/** בקשת השוואה אחת. במצב "מתחת לסף" המחיר שהלקוח מצא לא נחשף, גם לא לעוזר */
export async function matchDetails(supplier: SupplierRef, requestId: string) {
  const m = await db.matchRequest.findFirst({
    where: { id: requestId, supplierId: supplier.id },
    include: { lines: true, customer: { select: { businessName: true, businessType: true, city: true } } },
  });
  if (!m) return null;
  return {
    requestId: m.id,
    customer: `${m.customer.businessName} (${m.customer.businessType}, ${m.customer.city})`,
    sentOn: day(m.createdAt),
    status: OFFER_STAGE_LABEL[matchStage(m)],
    mode: m.reveal === "CEILING" ? "מתחת לסף: אפשר לענות רק במחיר שלכם (לא 'משווה')" : "מחיר מדויק",
    customerMessage: m.message,
    lines: m.lines.map((raw) => {
      const l = supplierFacing(raw, m.reveal);
      const unit = UNIT_LABEL[l.unit as keyof typeof UNIT_LABEL] ?? l.unit;
      return {
        lineId: l.id,
        product: l.productName,
        monthlyQuantity: l.monthlyQuantity,
        unit,
        customerPaysYouToday: nis(l.currentPriceAgorot),
        whatCustomerFound: revealText(m.reveal, l.targetPriceAgorot, unit),
        ...(m.reveal === "EXACT" ? { foundPrice: nis(l.targetPriceAgorot) } : { mustBeBelow: nis(l.targetPriceAgorot) }),
        waitingForAnswer: l.decision === "PENDING",
        myAnswer: l.response === "PENDING" ? null : MATCH_RESPONSE_LABEL[l.response],
        myCounterPrice: nis(l.counterPriceAgorot),
      };
    }),
    previousNote: m.supplierNote,
    repliesLeft: Math.max(0, MAX_REPLIES - m.answerCount),
    link: `/supplier/matches/${m.id}`,
  };
}

/** מבצעים: מבצעי מחיר בתוקף ומבצעי כמות */
export async function deals(supplier: SupplierRef) {
  const now = new Date();
  const [promos, quantity] = await Promise.all([
    db.offerPrice.findMany({
      where: {
        offer: { supplierId: supplier.id, archivedAt: null },
        kind: "PROMOTION",
        status: "LIVE",
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gt: now } }],
      },
      include: { offer: { select: { id: true, product: { select: { name: true } } } }, tier: { select: { name: true } } },
    }),
    db.quantityDeal.findMany({
      where: { offer: { supplierId: supplier.id, archivedAt: null } },
      include: { offer: { select: { id: true, product: { select: { name: true, unit: true } } } } },
    }),
  ]);
  return {
    pricePromotions: promos.map((p) => ({
      product: p.offer.product.name,
      tier: p.tier.name,
      price: nis(p.unitPriceAgorot),
      until: p.validTo ? day(lastValidDay(p.validTo)) : null,
      link: `/supplier/products/${p.offer.id}`,
    })),
    quantityDeals: quantity.map((d) => ({
      product: d.offer.product.name,
      fromQuantity: `${d.minPerOrder} ${UNIT_LABEL[d.offer.product.unit]}${d.minPacks ? ` (${d.minPacks} אריזות)` : ""}`,
      discountPct: d.discountPct,
      price: nis(d.priceAgorot),
      until: d.validTo ? day(lastValidDay(d.validTo)) : null,
      active: !d.validTo || d.validTo > now,
      link: `/supplier/products/${d.offer.id}`,
    })),
    manage: "/supplier/deals",
  };
}

/** אזורי החלוקה ותנאי האספקה */
export async function deliveryAreas(supplier: SupplierRef) {
  const [areas, s] = await Promise.all([
    db.deliveryArea.findMany({ where: { supplierId: supplier.id }, orderBy: { createdAt: "asc" } }),
    db.supplier.findUnique({
      where: { id: supplier.id },
      select: { deliveryTerms: true, deliveryZones: { select: { region: { select: { name: true } } } } },
    }),
  ]);
  return {
    circles: areas.map((a) => ({ name: a.label, radiusKm: a.radiusKm, terms: areaTermsText(a) })),
    generalRegions: s?.deliveryZones.map((z) => z.region.name) ?? [],
    generalTerms: s?.deliveryTerms ?? null,
    rule: areas.length
      ? "לקוחות רואים את הספק רק אם העסק שלהם בתוך אחד העיגולים"
      : "אין עיגולים על המפה, ולכן הספק מוצג לפי האזורים הכלליים",
    manage: "/supplier/areas",
  };
}
