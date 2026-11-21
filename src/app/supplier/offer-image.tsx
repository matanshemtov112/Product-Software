"use client";

import { useRef, useState, useTransition } from "react";
import { downscaleImage } from "@/lib/images/downscale";
import { uploadOfferImage } from "./actions";

function CameraIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8h3l1.5-2h7L17 8h3v11H4z M12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * תמונת המוצר ברשימה. לחיצה פותחת בחירת קובץ: מוסיפה תמונה כשאין, ומחליפה כשיש.
 */
export function OfferImage({
  offerId,
  src,
  name,
  variant,
}: {
  offerId: string;
  src: string | null;
  name: string;
  variant: "thumb" | "card";
}) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      try {
        const form = new FormData();
        form.set("offerId", offerId);
        form.set("image", await downscaleImage(file));
        const result = await uploadOfferImage(form);
        if (result.error) setError(result.error);
      } catch (e) {
        setError(e instanceof Error ? e.message : "ההעלאה נכשלה");
      }
      if (input.current) input.current.value = "";
    });
  };

  const box =
    variant === "thumb"
      ? "size-16 shrink-0 rounded-md"
      : "aspect-[4/3] w-full rounded-md";

  return (
    <div className={variant === "card" ? "flex flex-col gap-1" : "flex flex-col items-center gap-1"}>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={pending}
        title={src ? "החלפת תמונה" : "הוספת תמונה"}
        aria-label={src ? `החלפת התמונה של ${name}` : `הוספת תמונה ל${name}`}
        className={`${box} group relative flex items-center justify-center overflow-hidden border ${
          src ? "border-border" : "border-dashed border-border text-muted hover:border-accent hover:text-accent"
        } bg-background`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} className="size-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-0.5 text-xs">
            <CameraIcon size={variant === "card" ? 28 : 20} />
            {variant === "card" ? "הוספת תמונה" : "תמונה"}
          </span>
        )}
        {src && !pending && (
          <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-xs text-white opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
            החלפה
          </span>
        )}
        {pending && (
          <span className="absolute inset-0 flex items-center justify-center bg-surface/80 text-xs">מעלה…</span>
        )}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {error && (
        <p role="alert" className="max-w-40 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
