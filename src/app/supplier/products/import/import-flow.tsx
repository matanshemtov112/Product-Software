"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { shekels } from "@/lib/format";
import type { PreviewRow } from "@/lib/supplier/price-sheet";
import { applyImport, previewImport, type ImportState } from "./actions";

const price = (agorot: number | null) => (agorot === null ? "אין" : shekels(agorot, 2));

/** "שורה אחת" / "3 שורות" */
const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

function pctChange(from: number | null, to: number) {
  if (!from) return null;
  const pct = Math.round(((to - from) / from) * 100);
  if (pct === 0) return null;
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

/** הורדה, העלאה, תצוגה מקדימה ושמירה של מחירון מקובץ */
export function ImportFlow({ multiTier }: { multiTier: boolean }) {
  const [state, upload, uploading] = useActionState(previewImport, {} as ImportState);
  const [saved, save, saving] = useActionState(applyImport, {} as ImportState);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const preview = state.preview;
  const rows = useMemo(() => preview?.rows ?? [], [preview]);
  const ok = rows.filter((r) => !r.error && r.offerId);
  const errors = rows.filter((r) => r.error);
  const chosen = ok.filter((r) => !skip.has(r.line));
  const payload = JSON.stringify(
    chosen.map((r) => ({
      offerId: r.offerId,
      ...(r.available !== undefined ? { available: r.available } : {}),
      changes: r.changes.map((c) => ({ tierId: c.tierId, fromAgorot: c.fromAgorot, toAgorot: c.toAgorot })),
    })),
  );
  const toggle = (line: number) =>
    setSkip((s) => {
      const next = new Set(s);
      if (next.has(line)) next.delete(line);
      else next.add(line);
      return next;
    });

  if (saved.done) {
    const d = saved.done;
    return (
      <section className="flex flex-col gap-3 rounded-lg border border-border bg-good-soft p-5" role="status">
        <h2 className="text-lg font-semibold text-good">המחירון עודכן</h2>
        <ul className="list-inside list-disc text-sm">
          <li>{count(d.prices, "מחיר אחד עודכן", "מחירים עודכנו")} ונכנסו לתוקף עכשיו</li>
          {d.held > 0 && (
            <li>
              {count(d.held, "שינוי אחד", "שינויים")} של יותר מ-30% {d.held === 1 ? "ממתין" : "ממתינים"} לאישור צוות
              הפלטפורמה
            </li>
          )}
          {d.availability > 0 && <li>{count(d.availability, "מוצר אחד שינה", "מוצרים שינו")} זמינות</li>}
          {d.skipped > 0 && (
            <li>
              {count(d.skipped, "שורה אחת לא נשמרה", "שורות לא נשמרו")}, כי המחיר השתנה בינתיים במקום אחר. העלו את הקובץ
              שוב כדי לראות אותן.
            </li>
          )}
        </ul>
        <p className="text-sm">לקוחות שהמוצרים האלה בסל שלהם יקבלו התראה על השינוי, כמו בעדכון רגיל.</p>
        <div className="flex gap-3">
          <Link href="/supplier" className="rounded-full bg-accent px-4 py-2 text-sm font-medium text-white">
            לרשימת המוצרים
          </Link>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full border border-border px-4 py-2 text-sm"
          >
            עדכון נוסף
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">המחירון שלכם</h2>
          <a
            href="/api/supplier/price-list"
            className="self-start rounded-full border border-accent px-4 py-2 text-sm font-medium text-accent hover:bg-accent-soft"
            download
          >
            ⬇ הורדת המחירון (אקסל / CSV)
          </a>
          <p className="text-xs text-muted">
            המחירים ללא מע״מ{multiTier ? ", עמודה לכל מדרגת מחיר" : ""}. בעמודה &quot;המחיר הוא ל&quot; כתוב אם המחיר
            לק״ג, לליטר, ליחידה או לאריזה, כמו שהגדרתם במוצר.
          </p>
        </div>
        <ActionForm action={upload} className="flex flex-col gap-2 sm:items-end">
          <label className="text-sm font-medium" htmlFor="pricelist-file">
            העלאת הקובץ המעודכן
          </label>
          <input
            id="pricelist-file"
            type="file"
            name="file"
            accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            required
            className="text-sm file:me-3 file:rounded-full file:border-0 file:bg-sand file:px-4 file:py-2"
          />
          <SubmitButton pending={uploading}>בדיקת הקובץ</SubmitButton>
        </ActionForm>
      </section>
      <FormError message={state.error} />

      {preview && (
        <section className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
          <div>
            <h2 className="text-lg font-semibold">מה משתנה{state.fileName ? ` לפי ${state.fileName}` : ""}</h2>
            <p className="text-sm text-muted">
              {count(ok.length, "מוצר אחד משתנה", "מוצרים משתנים")} · {preview.unchanged} בלי שינוי
              {preview.missing > 0
                ? ` · ${count(preview.missing, "מוצר אחד שלכם לא הופיע בקובץ ונשאר כמו שהוא", "מוצרים שלכם לא הופיעו בקובץ ונשארים כמו שהם")}`
                : ""}
              {errors.length > 0 ? ` · ${count(errors.length, "שורה אחת", "שורות")} עם בעיה` : ""}
            </p>
          </div>

          {ok.length === 0 && errors.length === 0 && (
            <p className="rounded-2xl bg-sand px-3 py-2 text-sm">
              לא מצאנו שינויים: כל המחירים בקובץ זהים למחירים שלכם היום.
            </p>
          )}

          {ok.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="text-start text-xs text-muted">
                  <tr className="border-b border-border">
                    <th className="w-8 py-2" />
                    <th className="py-2 text-start font-medium">מוצר</th>
                    <th className="py-2 text-start font-medium">שינוי</th>
                  </tr>
                </thead>
                <tbody>
                  {ok.map((r) => (
                    <ChangeRow
                      key={r.line}
                      row={r}
                      on={!skip.has(r.line)}
                      toggle={() => toggle(r.line)}
                      multiTier={multiTier}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errors.length > 0 && (
            <details open={ok.length === 0} className="rounded-2xl border border-border p-3 text-sm">
              <summary className="cursor-pointer font-medium text-danger">
                {count(errors.length, "שורה אחת", "שורות")} שלא נשמור
              </summary>
              <ul className="mt-2 flex flex-col gap-1">
                {errors.map((r) => (
                  <li key={r.line}>
                    <span className="text-muted">שורה {r.line}:</span> {r.label} · {r.error}
                  </li>
                ))}
              </ul>
            </details>
          )}

          {ok.length > 0 && (
            <ActionForm
              action={save}
              className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center"
            >
              <input type="hidden" name="rows" value={payload} />
              <input type="hidden" name="fileName" value={state.fileName ?? ""} />
              <SubmitButton pending={saving}>
                {chosen.length === ok.length
                  ? `שמירת כל ${ok.length} השינויים`
                  : `שמירת ${chosen.length} שינויים שנבחרו`}
              </SubmitButton>
              <p className="text-xs text-muted">
                שינוי של יותר מ-30% ממתין לאישור, כמו בעריכה רגילה. כל מחיר קודם נשמר בהיסטוריה של המוצר.
              </p>
            </ActionForm>
          )}
          <FormError message={saved.error} />
        </section>
      )}
    </div>
  );
}

function ChangeRow({
  row,
  on,
  toggle,
  multiTier,
}: {
  row: PreviewRow;
  on: boolean;
  toggle: () => void;
  multiTier: boolean;
}) {
  return (
    <tr className={`border-b border-border align-top last:border-0 ${on ? "" : "opacity-50"}`}>
      <td className="py-2">
        <input
          type="checkbox"
          checked={on}
          onChange={toggle}
          aria-label={`לשמור את ${row.label}`}
          className="accent-accent"
        />
      </td>
      <td className="py-2">
        <span className="font-medium">{row.label}</span>
        <span className="block text-xs text-muted">שורה {row.line}</span>
      </td>
      <td className="py-2">
        <ul className="flex flex-col gap-0.5">
          {row.changes.map((c) => {
            const pct = pctChange(c.fromSheet, c.toSheet);
            return (
              <li key={c.tierId}>
                {multiTier && <span className="text-muted">{c.tierName}: </span>}
                <span className="text-muted line-through">{price(c.fromSheet)}</span> ← <b>{price(c.toSheet)}</b>
                <span className="text-muted"> / {row.per}</span>
                {pct && (
                  <span className={c.toSheet > (c.fromSheet ?? 0) ? " text-danger" : " text-good"}> ({pct})</span>
                )}
                {c.needsApproval && (
                  <span className="ms-1 rounded-full bg-highlight/30 px-2 py-0.5 text-xs">ימתין לאישור</span>
                )}
              </li>
            );
          })}
          {row.available !== undefined && (
            <li>{row.available ? "יחזור להיות זמין" : <span className="text-danger">יסומן כלא זמין</span>}</li>
          )}
        </ul>
      </td>
    </tr>
  );
}
