"use client";

import { type FormEvent, startTransition, useActionState, useEffect, useRef, useState } from "react";
import { FormError, SubmitButton } from "@/components/form";
import { downscaleImage } from "@/lib/images/downscale";
import { MAX_INVOICE_FILE_BYTES, MAX_INVOICE_FILES } from "@/lib/invoices/files";
import { readInvoice } from "../actions";

interface Page {
  file: File;
  preview: string | null;
}

export function InvoiceUpload() {
  const [state, action, pending] = useActionState(readInvoice, {});
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<Page[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previews = useRef<string[]>([]);

  useEffect(() => () => previews.current.forEach((p) => URL.revokeObjectURL(p)), []);

  const addFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setError(null);
    setBusy(true);
    try {
      const added: Page[] = [];
      for (const file of [...list]) {
        if (file.type === "application/pdf") {
          if (file.size > MAX_INVOICE_FILE_BYTES) throw new Error(`הקובץ ${file.name} גדול מדי (עד 4MB)`);
          added.push({ file, preview: null });
        } else {
          // רזולוציה גבוהה יותר מבחיפוש בצילום, כדי שאפשר יהיה לקרוא את הטקסט הקטן בחשבונית
          const small = await downscaleImage(file, 2000);
          const preview = URL.createObjectURL(small);
          previews.current.push(preview);
          added.push({ file: small, preview });
        }
      }
      setPages((current) => {
        const next = [...current, ...added];
        if (next.length > MAX_INVOICE_FILES) setError(`אפשר להעלות עד ${MAX_INVOICE_FILES} עמודים בכל פעם`);
        return next.slice(0, MAX_INVOICE_FILES);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "לא הצלחנו לעבד את הקובץ");
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData();
    pages.forEach((p) => form.append("pages", p.file));
    startTransition(() => action(form));
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => camera.current?.click()}
          disabled={busy || pending}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
        >
          {pages.length ? "צילום עמוד נוסף" : "צילום החשבונית"}
        </button>
        <button
          type="button"
          onClick={() => picker.current?.click()}
          disabled={busy || pending}
          className="rounded-md border border-border px-4 py-2 text-sm hover:bg-background"
        >
          בחירת קובץ (תמונה או PDF)
        </button>
      </div>
      <p className="text-xs text-muted">
        חשבונית או תעודת משלוח של הספק שלכם. צלמו את כל העמוד באור טוב, בלי צל וישר מלמעלה. חשבונית של כמה עמודים:
        הוסיפו כל עמוד (עד {MAX_INVOICE_FILES}).
      </p>

      {pages.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {pages.map((p, i) => (
            <li
              key={i}
              className="relative flex h-32 w-24 items-center justify-center overflow-hidden rounded-md border border-border bg-background text-xs text-muted"
            >
              {p.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.preview} alt={`עמוד ${i + 1}`} className="size-full object-cover" />
              ) : (
                <span className="p-2 text-center break-all">
                  PDF
                  <br />
                  {p.file.name}
                </span>
              )}
              <button
                type="button"
                onClick={() => setPages((current) => current.filter((_, j) => j !== i))}
                className="absolute top-1 left-1 rounded bg-surface/90 px-1.5 text-xs text-danger"
                aria-label={`הסרת עמוד ${i + 1}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <FormError message={state.error} />
      <div>
        <SubmitButton pending={pending || busy || pages.length === 0}>
          {pending ? "קוראים את החשבונית… (עד דקה)" : "קריאת החשבונית"}
        </SubmitButton>
      </div>

      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={picker}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </form>
  );
}
