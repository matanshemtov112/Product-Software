"use client";

import { useState } from "react";

/** בחירת דירוג 1 עד 5 בכוכבים; שולח את הערך בשדה name */
export function StarInput({ name, label, defaultValue }: { name: string; label: string; defaultValue?: number }) {
  const [value, setValue] = useState(defaultValue ?? 0);
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className="flex flex-wrap items-center justify-between gap-2">
      <legend className="float-start text-sm">{label}</legend>
      <span className="inline-flex" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer p-0.5" onMouseEnter={() => setHover(n)}>
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => setValue(n)}
              className="peer sr-only"
              required
            />
            <svg
              width={26}
              height={26}
              viewBox="0 0 20 20"
              aria-hidden="true"
              className="rounded peer-focus-visible:ring-2 peer-focus-visible:ring-accent"
            >
              <path
                d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.8l-5.2 2.8 1-5.8L1.5 7.7l5.9-.9z"
                fill={n <= shown ? "#f2a50c" : "var(--border)"}
              />
            </svg>
            <span className="sr-only">{n} כוכבים</span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}
