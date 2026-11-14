import { Card } from "@/components/form";
import { requireRole } from "@/lib/auth/current";
import { isManager } from "@/lib/auth/team";
import { db } from "@/lib/db";
import { supplierForUser } from "@/lib/supplier/catalog";
import { DOC_LABEL, docState, isVerified, RENEW_WARNING_DAYS, requiredDocs, type DocState } from "@/lib/verification";
import { setManufacturer } from "./actions";
import { UploadForm } from "./upload-form";

const STATE: Record<DocState, { label: string; style: string }> = {
  MISSING: { label: "חסר", style: "bg-background text-muted" },
  PENDING: { label: "ממתין לבדיקה", style: "bg-[#fff4c2] text-[#6b5500]" },
  APPROVED: { label: "אושר", style: "bg-accent-soft text-accent" },
  REJECTED: { label: "נדחה", style: "bg-[#fde2e1] text-danger" },
  EXPIRED: { label: "פג תוקף", style: "bg-[#fde2e1] text-danger" },
};

const HINT: Record<string, string> = {
  BUSINESS_LICENSE: "תעודת עוסק מורשה, או תעודת התאגדות לחברה בע״מ.",
  MANUFACTURER_LICENSE: "רישיון יצרן בתוקף מהרשות המקומית או ממשרד הכלכלה.",
  HEALTH_LICENSE: "אישור יצרן או רישיון ייצור מטעם שירות המזון במשרד הבריאות.",
};

export default async function SupplierVerification() {
  const session = await requireRole("SUPPLIER");
  const base = await supplierForUser(session.userId);
  const [supplier, manager] = await Promise.all([
    db.supplier.findUniqueOrThrow({
      where: { id: base.id },
      include: {
        documents: {
          select: {
            id: true,
            kind: true,
            status: true,
            validUntil: true,
            fileName: true,
            rejectReason: true,
            updatedAt: true,
          },
        },
      },
    }),
    isManager(session.userId),
  ]);
  const now = new Date();
  const verified = isVerified(supplier, now);
  const kinds = requiredDocs(supplier.isManufacturer);
  const soon = new Date(now.getTime() + RENEW_WARNING_DAYS * 86_400_000);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">אימות החשבון</h1>
        <p className="text-sm text-muted">
          ספק מאומת מקבל תגית ״ספק מאומת ✓״ ליד השם, בכל מקום שהלקוחות רואים אותו, גם בהשוואות. ספק שעוד לא אומת מופיע
          עם ״טרם אומת״. המסמכים נשמרים בצורה מאובטחת, ורק צוות הפלטפורמה רואה אותם.
        </p>
      </div>

      <div
        className={`rounded-lg border p-4 text-sm ${verified ? "border-accent bg-accent-soft" : "border-border bg-surface"}`}
      >
        {verified ? (
          <p>
            <strong className="text-accent">החשבון מאומת ✓</strong>
            {supplier.verifiedUntil && ` · בתוקף עד ${supplier.verifiedUntil.toLocaleDateString("he-IL")}`}
          </p>
        ) : (
          <p>
            <strong>החשבון עוד לא מאומת.</strong> העלו את המסמכים הנדרשים. אחרי שצוות הפלטפורמה יאשר את כולם, התגית
            תופיע ללקוחות.
          </p>
        )}
      </div>

      <Card title="סוג העסק">
        <form action={setManufacturer} className="flex flex-col gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="isManufacturer"
              value="no"
              defaultChecked={!supplier.isManufacturer}
              disabled={!manager}
              className="accent-accent"
            />
            ספק או משווק: אנחנו מוכרים מוצרים שאחרים מייצרים
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="isManufacturer"
              value="yes"
              defaultChecked={supplier.isManufacturer}
              disabled={!manager}
              className="accent-accent"
            />
            מפעל: אנחנו מייצרים את המוצרים בעצמנו (נדרשים גם רישיון יצרן ואישור משרד הבריאות)
          </label>
          {manager && (
            <button className="self-start rounded-md border border-border bg-surface px-4 py-2">שמירה</button>
          )}
        </form>
      </Card>

      {kinds.map((kind) => {
        const doc = supplier.documents.find((d) => d.kind === kind);
        const state = docState(doc, now);
        const expiring = doc?.status === "APPROVED" && doc.validUntil && doc.validUntil > now && doc.validUntil <= soon;
        return (
          <Card key={kind} title={DOC_LABEL[kind]}>
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted">{HINT[kind]}</p>
              <p className="flex flex-wrap items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATE[state].style}`}>
                  {STATE[state].label}
                </span>
                {doc && (
                  <>
                    <a
                      href={`/api/supplier-documents/${doc.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent underline"
                    >
                      {doc.fileName}
                    </a>
                    <span className="text-muted">
                      הועלה {doc.updatedAt.toLocaleDateString("he-IL")}
                      {doc.validUntil && ` · בתוקף עד ${doc.validUntil.toLocaleDateString("he-IL")}`}
                    </span>
                  </>
                )}
              </p>
              {state === "REJECTED" && doc?.rejectReason && (
                <p className="rounded-md bg-[#fde2e1] px-3 py-2">סיבת הדחייה: {doc.rejectReason}</p>
              )}
              {expiring && (
                <p className="rounded-md bg-[#fff4c2] px-3 py-2">
                  התוקף מסתיים בקרוב. העלו מסמך מעודכן כדי להישאר מאומתים.
                </p>
              )}
              {manager ? (
                <UploadForm kind={kind} hasFile={Boolean(doc)} askValidity={kind !== "BUSINESS_LICENSE"} />
              ) : (
                <p className="text-muted">רק מנהל יכול להעלות מסמכים.</p>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
