"use client";

import { useId, useMemo, useState } from "react";
import { normalize, searchItems } from "@/lib/search";

export interface PickerOption {
  id: string;
  name: string;
  unit: string;
  category: string;
  aliases?: string[];
}

const MAX_RESULTS = 8;

/**
 * בחירת מוצר מהקטלוג לשורה בחשבונית: מקלידים חלק מהשם (גם שם נרדף או קטגוריה) ובוחרים מהרשימה,
 * או פותחים את כל הקטלוג לפי קטגוריות.
 */
export function ProductPicker({
  name,
  value,
  options,
  onChange,
}: {
  name: string;
  value: string;
  options: PickerOption[];
  onChange: (id: string) => void;
}) {
  const listId = useId();
  const selected = options.find((o) => o.id === value);
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const text = query ?? selected?.name ?? "";
  const results = useMemo(
    () =>
      normalize(query ?? "")
        ? searchItems(options, query ?? "", (o) => ({
            name: o.name,
            aliases: o.aliases,
            categories: [o.category],
          })).slice(0, MAX_RESULTS)
        : [],
    [options, query],
  );
  const groups = useMemo(() => {
    const map = new Map<string, PickerOption[]>();
    for (const o of options) map.set(o.category, [...(map.get(o.category) ?? []), o]);
    return [...map];
  }, [options]);

  const pick = (id: string) => {
    onChange(id);
    setQuery(null);
    setOpen(false);
    setShowAll(false);
  };

  return (
    <div className="relative flex flex-col gap-1">
      <input type="hidden" name={name} value={value} />
      <input
        type="search"
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="חיפוש מוצר בקטלוג"
        value={text}
        placeholder="הקלידו שם מוצר, למשל ״שמן״"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => e.target.select()}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && results[0]) {
            e.preventDefault();
            pick(results[0].id);
          }
          if (e.key === "Escape") {
            setQuery(null);
            setOpen(false);
          }
        }}
        className={`rounded-md border bg-surface px-3 py-2 ${value || query ? "border-border" : "border-[#e0b400]"}`}
      />
      {open && normalize(query ?? "") && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg"
        >
          {results.length === 0 && <li className="px-3 py-2 text-sm text-muted">לא מצאנו מוצר כזה בקטלוג</li>}
          {results.map((o) => (
            <li
              key={o.id}
              role="option"
              aria-selected={o.id === value}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(o.id)}
              className="cursor-pointer px-3 py-2 text-sm hover:bg-accent-soft"
            >
              {o.name} <span className="text-xs text-muted">· {o.category}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={() => setShowAll((v) => !v)} className="self-start text-xs text-accent underline">
        {showAll ? "סגירת הרשימה" : "או בחירה מכל הקטלוג"}
      </button>
      {showAll && (
        <select
          aria-label="בחירה מכל הקטלוג"
          value={value}
          onChange={(e) => pick(e.target.value)}
          className="rounded-md border border-border bg-surface px-3 py-2"
        >
          <option value="">בחרו מוצר…</option>
          {groups.map(([category, items]) => (
            <optgroup key={category} label={category}>
              {items.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}
    </div>
  );
}
