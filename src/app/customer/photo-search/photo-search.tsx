"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { downscaleImage } from "@/lib/images/downscale";
import type { ProductSuppliers } from "@/lib/photo-search/match";
import { searchByPhoto } from "./actions";

function ProductResult({ product }: { product: ProductSuppliers }) {
  const unit = UNIT_LABEL[product.unit as keyof typeof UNIT_LABEL];
  return (
    <li className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{product.productName}</p>
        <p className="text-xs text-muted">{product.category}</p>
      </div>
      <ul className="mt-2 divide-y divide-border text-sm">
        {product.suppliers.map((s, i) => (
          <li key={s.id} className="flex items-center justify-between gap-2 py-1.5">
            <span>
              {s.name}
              {i === 0 && product.suppliers.length > 1 && s.priceAgorot != null && (
                <span className="ms-2 rounded bg-accent-soft px-1.5 py-0.5 text-xs text-accent">הכי זול</span>
              )}
            </span>
            <span className="text-muted">{s.priceAgorot != null ? `${shekels(s.priceAgorot, 2)} / ${unit}` : "אין מחיר"}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

export function PhotoSearch() {
  const [state, action, pending] = useActionState(searchByPhoto, {});
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const payload = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const onFile = async (file: File | undefined) => {
    if (!file || !payload.current) return;
    setError(null);
    setBusy(true);
    try {
      const small = await downscaleImage(file, 1024);
      const files = new DataTransfer();
      files.items.add(small);
      payload.current.files = files.files;
      setPreview(URL.createObjectURL(small));
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא הצלחנו לעבד את התמונה");
    } finally {
      setBusy(false);
    }
  };

  const matches = state.matches;
  const nothing = matches && matches.exact.length === 0 && matches.similar.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <ActionForm action={action} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5 sm:flex-row sm:items-center">
        <div className="flex aspect-square w-full max-w-48 shrink-0 items-center justify-center overflow-hidden rounded-md border border-dashed border-border bg-background text-sm text-muted">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview ? <img src={preview} alt="התמונה שנבחרה" className="size-full object-cover" /> : "אין תמונה"}
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => camera.current?.click()}
              disabled={busy || pending}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
            >
              צילום
            </button>
            <button
              type="button"
              onClick={() => gallery.current?.click()}
              disabled={busy || pending}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
            >
              בחירת תמונה
            </button>
          </div>
          <p className="text-xs text-muted">צלמו את המוצר עצמו או את האריזה שלו, באור טוב ומקרוב.</p>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <FormError message={state.error} />
          <div>
            <SubmitButton pending={pending || busy}>{pending ? "מזהה את המוצר…" : "חיפוש ספקים"}</SubmitButton>
          </div>
        </div>
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <input ref={gallery} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={payload} type="file" name="photo" className="hidden" tabIndex={-1} aria-hidden="true" />
      </ActionForm>

      {matches && (
        <div className="flex flex-col gap-4">
          {state.description && (
            <p className="text-sm">
              <span className="text-muted">מה זיהינו בתמונה: </span>
              {state.description}
            </p>
          )}
          {nothing && (
            <p className="rounded-lg border border-dashed border-border bg-surface p-6 text-sm text-muted">
              לא מצאנו ספק באזור שלכם שמוכר את המוצר הזה או מוצר דומה.
            </p>
          )}
          {matches.exact.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">ספקים שמוכרים את המוצר</h2>
              <ul className="flex flex-col gap-3">
                {matches.exact.map((p) => (
                  <ProductResult key={p.productId} product={p} />
                ))}
              </ul>
            </section>
          )}
          {matches.similar.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold">{matches.exact.length ? "מוצרים דומים" : "לא מצאנו את המוצר עצמו, אבל יש מוצרים דומים"}</h2>
              <ul className="flex flex-col gap-3">
                {matches.similar.map((p) => (
                  <ProductResult key={p.productId} product={p} />
                ))}
              </ul>
            </section>
          )}
          {!nothing && (
            <p className="text-xs text-muted">
              המחירים הם במדרגה הבסיסית, ללא מע״מ. להשוואה לפי הכמויות שלכם{" "}
              <Link href="/customer/baskets/new?mode=manual" className="text-accent">
                בנו סל עם המוצר
              </Link>
              .
            </p>
          )}
        </div>
      )}
    </div>
  );
}
