"use client";

import { useActionState, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError, SubmitButton } from "@/components/form";
import type { CategoryNode } from "@/lib/categories";
import { saveDomains } from "./actions";

/**
 * בחירת התחומים של הספק: תחום שלם, תתי-תחומים מתוכו (למשל רק ירוקים ועשבי תיבול), או כל התחומים.
 * ככה כל מוצר בסל של לקוח מגיע בדיוק לספקים שמתמחים בו.
 */
export function DomainPicker({
  tree,
  initialIds,
  initialAll,
  submitLabel,
}: {
  tree: CategoryNode[];
  initialIds: string[];
  initialAll: boolean;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveDomains, {});
  const [all, setAll] = useState(initialAll);
  const [selected, setSelected] = useState(new Set(initialIds));
  // תחום עם תתי-תחומים שנבחרו חלקית נפתח מראש
  const [open, setOpen] = useState(
    new Set(tree.filter((c) => c.children.some((x) => initialIds.includes(x.id))).map((c) => c.id)),
  );

  const toggle = (id: string, children: string[] = []) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        next.add(id);
        // תחום שלם מחליף בחירה חלקית של תתי-התחומים שלו
        for (const c of children) next.delete(c);
      }
      return next;
    });
  const chip = (on: boolean, disabled = false) =>
    `flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
      on ? "border-accent bg-accent-soft font-medium text-accent" : "border-border bg-surface hover:bg-background"
    } ${disabled ? "cursor-not-allowed opacity-50" : ""}`;

  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <label className={chip(all)}>
        <input type="checkbox" name="all" checked={all} onChange={(e) => setAll(e.target.checked)} className="size-4 accent-accent" />
        <span>
          כל התחומים
          <span className="block text-xs font-normal text-muted">ספק כללי שמוכר מכל סוגי המוצרים</span>
        </span>
      </label>
      <fieldset disabled={all} className="flex flex-col gap-2">
        <legend className="mb-2 text-sm text-muted">
          או בחירה של תחום אחד או יותר. בתחומים עם חץ אפשר לבחור רק חלק, למשל רק ירקות אדמה או רק ירוקים:
        </legend>
        <ul className="grid gap-2 sm:grid-cols-2">
          {tree.map((c) => {
            const whole = !all && selected.has(c.id);
            const partial = c.children.filter((x) => selected.has(x.id)).length;
            const childIds = c.children.map((x) => x.id);
            const expanded = open.has(c.id);
            return (
              <li key={c.id} className={c.children.length && expanded ? "sm:col-span-2" : ""}>
                <div className="flex items-stretch gap-1">
                  <label className={`${chip(whole, all)} flex-1`}>
                    <input
                      type="checkbox"
                      name="categoryId"
                      value={c.id}
                      checked={whole}
                      onChange={() => toggle(c.id, childIds)}
                      className="size-4 accent-accent"
                    />
                    <span className="flex-1">{c.name}</span>
                    {!whole && partial > 0 && <span className="text-xs text-accent">{partial} נבחרו</span>}
                    {whole && c.children.length > 0 && <span className="text-xs">התחום כולו</span>}
                  </label>
                  {c.children.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setOpen((prev) => {
                          const next = new Set(prev);
                          if (next.has(c.id)) next.delete(c.id);
                          else next.add(c.id);
                          return next;
                        })
                      }
                      aria-expanded={expanded}
                      aria-label={`תתי-תחומים של ${c.name}`}
                      className="rounded-md border border-border bg-surface px-2 text-sm hover:bg-background"
                    >
                      {expanded ? "▴" : "▾"}
                    </button>
                  )}
                </div>
                {c.children.length > 0 && expanded && (
                  <div className="mt-2 grid grid-cols-2 gap-2 ps-6 sm:grid-cols-3">
                    {c.children.map((x) => (
                      <label key={x.id} className={chip(whole || (!all && selected.has(x.id)), all || whole)}>
                        <input
                          type="checkbox"
                          name={whole ? undefined : "categoryId"}
                          value={x.id}
                          checked={whole || (!all && selected.has(x.id))}
                          disabled={whole}
                          onChange={() => toggle(x.id)}
                          className="size-4 accent-accent"
                        />
                        {x.name}
                      </label>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <FormError message={state.error} />
      {state.saved && !state.error && (
        <p role="status" className="text-sm text-accent">
          התחומים נשמרו.
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
