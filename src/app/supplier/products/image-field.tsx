"use client";

import { useEffect, useRef, useState } from "react";
import { downscaleImage } from "@/lib/images/downscale";
import type { ImageSuggestion } from "@/lib/images/suggest";

type Search = { state: "idle" | "loading" | "done"; items: ImageSuggestion[]; message?: string };

/**
 * שדה תמונה בטופס המוצר. התמונה מוקטנת בדפדפן ונשלחת יחד עם הטופס בשדה "image".
 * ספק שאינו יצרן יכול גם לחפש תמונה במאגרים פתוחים ברשת; הבחירה נשלחת בשדה "imageSuggestion"
 * והשרת מוריד אותה בשמירה. לא מוצגות אף פעם תמונות של ספקים אחרים.
 */
export function ImageField({
  currentSrc,
  currentCredit,
  allowSuggestions,
}: {
  currentSrc: string | null;
  currentCredit?: string | null;
  allowSuggestions?: boolean;
}) {
  const picker = useRef<HTMLInputElement>(null);
  const payload = useRef<HTMLInputElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState<Search>({ state: "idle", items: [] });
  const [chosen, setChosen] = useState<ImageSuggestion | null>(null);

  const findImages = async () => {
    const form = root.current?.closest("form");
    const field = (n: string) => (form?.elements.namedItem(n) as HTMLInputElement | null)?.value?.trim() ?? "";
    const name = field("productName");
    const barcode = field("barcode");
    if (name.length < 2 && !barcode) {
      setSearch({ state: "done", items: [], message: "כתבו קודם את שם המוצר (או ברקוד), ואז חפשו." });
      return;
    }
    setSearch({ state: "loading", items: [] });
    try {
      const res = await fetch(`/api/supplier/image-suggestions?${new URLSearchParams({ name, barcode })}`);
      const body = (await res.json()) as { suggestions?: ImageSuggestion[]; error?: string; manufacturer?: boolean };
      const items = body.suggestions ?? [];
      setSearch({
        state: "done",
        items,
        message:
          body.error ??
          (body.manufacturer
            ? "אתם רשומים כיצרן, לכן העלו את התמונות שלכם."
            : items.length
              ? undefined
              : "לא מצאנו תמונה מתאימה במאגרים הפתוחים. אפשר לנסות שם קצר יותר או להעלות תמונה משלכם."),
      });
    } catch {
      setSearch({ state: "done", items: [], message: "החיפוש לא הצליח כרגע. נסו שוב בעוד רגע." });
    }
  };

  const choose = (s: ImageSuggestion) => {
    setChosen(s);
    setPreview(null);
    if (payload.current) payload.current.value = "";
  };

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const onFile = async (file: File | undefined) => {
    if (!file || !payload.current) return;
    setError(null);
    setBusy(true);
    try {
      const small = await downscaleImage(file);
      const files = new DataTransfer();
      files.items.add(small);
      payload.current.files = files.files;
      setPreview(URL.createObjectURL(small));
      setChosen(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא הצלחנו לעבד את התמונה");
    } finally {
      setBusy(false);
    }
  };

  const shown = preview ?? chosen?.url ?? currentSrc;
  const credit = preview ? null : chosen ? chosen.credit : currentCredit;
  return (
    <div ref={root} className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background text-xs text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {shown ? <img src={shown} alt="תמונת המוצר" className="size-full object-cover" /> : "אין תמונה"}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => picker.current?.click()}
            disabled={busy}
            className="self-start rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-background"
          >
            {busy ? "מעבד…" : shown ? "החלפת תמונה" : "בחירת תמונה"}
          </button>
          <p className="text-xs text-muted">JPG, PNG או WEBP. תמונה גדולה תוקטן אוטומטית.</p>
          {credit && <p className="text-xs text-muted">קרדיט: {credit}</p>}
          {error && (
            <p role="alert" className="text-xs text-danger">
              {error}
            </p>
          )}
        </div>
        <input
          ref={picker}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/*"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <input ref={payload} type="file" name="image" className="hidden" tabIndex={-1} aria-hidden="true" />
      </div>
      {allowSuggestions && (
        <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={findImages}
              disabled={search.state === "loading"}
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-background"
            >
              {search.state === "loading" ? "מחפש…" : "אין לכם תמונה? חיפוש במאגרים פתוחים ברשת"}
            </button>
            <p className="text-xs text-muted">
              רק תמונות ברישיון חופשי מוויקישיתוף ו-Open Food Facts. לעולם לא תמונות של ספקים אחרים.
            </p>
          </div>
          {search.message && (
            <p role="status" className="text-sm text-muted">
              {search.message}
            </p>
          )}
          {search.items.length > 0 && (
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="תמונות מוצעות">
              {search.items.map((s) => {
                const on = chosen?.url === s.url;
                return (
                  <li key={s.url}>
                    <button
                      type="button"
                      onClick={() => choose(s)}
                      aria-pressed={on}
                      className={`flex w-full flex-col gap-1 rounded-md border bg-surface p-1 text-start ${
                        on ? "border-accent ring-2 ring-accent" : "border-border hover:border-accent"
                      }`}
                    >
                      <span className="block aspect-square w-full overflow-hidden rounded bg-background">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.url} alt="" loading="lazy" className="size-full object-contain" />
                      </span>
                      <span className="line-clamp-2 text-[11px] leading-tight text-muted">{s.credit}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {chosen && (
            <p className="text-sm">
              נבחרה תמונה. היא תישמר יחד עם המוצר כשתלחצו על שמירה.{" "}
              <a href={chosen.pageUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                לדף התמונה במאגר
              </a>{" "}
              <button type="button" onClick={() => setChosen(null)} className="text-accent underline">
                ביטול הבחירה
              </button>
            </p>
          )}
          <input type="hidden" name="imageSuggestion" value={chosen ? JSON.stringify(chosen) : ""} />
        </div>
      )}
    </div>
  );
}
