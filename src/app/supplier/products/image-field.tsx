"use client";

import { useEffect, useRef, useState } from "react";
import { downscaleImage } from "@/lib/images/downscale";

/**
 * שדה תמונה בטופס המוצר. התמונה מוקטנת בדפדפן ונשלחת יחד עם הטופס בשדה "image".
 */
export function ImageField({ currentSrc }: { currentSrc: string | null }) {
  const picker = useRef<HTMLInputElement>(null);
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
      const small = await downscaleImage(file);
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

  const shown = preview ?? currentSrc;
  return (
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
  );
}
