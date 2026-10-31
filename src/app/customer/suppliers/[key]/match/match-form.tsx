"use client";

import { useActionState, useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import { FormError } from "@/components/form";
import { SendToSupplierButton } from "@/components/send-to-supplier";
import { shekels, UNIT_LABEL } from "@/lib/format";
import { matchRequestText, type MatchCandidate } from "@/lib/matches";
import { sendMatchRequest } from "../../../matches/actions";

const unitLabel = (u: string) => UNIT_LABEL[u as keyof typeof UNIT_LABEL] ?? u;

function CandidateList({
  candidates,
  chosen,
  toggle,
}: {
  candidates: MatchCandidate[];
  chosen: Set<string>;
  toggle: (id: string) => void;
}) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {candidates.map((c) => (
        <li key={c.productId}>
          <label className="flex cursor-pointer items-start gap-3 p-3">
            <input
              type="checkbox"
              name="product"
              value={c.productId}
              checked={chosen.has(c.productId)}
              onChange={() => toggle(c.productId)}
              className="mt-1 size-4 shrink-0 accent-accent"
            />
            <span className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="min-w-0">
                <span className="block font-medium">{c.productName}</span>
                <span className="block text-xs text-muted">
                  {c.monthlyQuantity} {unitLabel(c.unit)} בחודש
                </span>
              </span>
              <span className="text-sm sm:text-end">
                <span className="block">
                  {shekels(c.currentPriceAgorot, 2)} ←{" "}
                  <strong className="text-accent">{shekels(c.targetPriceAgorot, 2)}</strong> ל{unitLabel(c.unit)}
                </span>
                <span className="block text-xs text-muted">חיסכון של {shekels(c.monthlySavingAgorot)} בחודש</span>
              </span>
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}

function useChosen(candidates: MatchCandidate[]) {
  const [chosen, setChosen] = useState(() => new Set(candidates.map((c) => c.productId)));
  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const saving = candidates.filter((c) => chosen.has(c.productId)).reduce((s, c) => s + c.monthlySavingAgorot, 0);
  return { chosen, toggle, saving };
}

/** ספק רשום: הבקשה נשלחת אליו במערכת, והוא עונה על כל מוצר */
export function MatchForm({
  supplierKey,
  supplierName,
  candidates,
}: {
  supplierKey: string;
  supplierName: string;
  candidates: MatchCandidate[];
}) {
  const [state, action, pending] = useActionState(sendMatchRequest, {});
  const { chosen, toggle, saving } = useChosen(candidates);
  return (
    <ActionForm action={action} className="flex flex-col gap-4">
      <input type="hidden" name="key" value={supplierKey} />
      <CandidateList candidates={candidates} chosen={chosen} toggle={toggle} />
      <p className="text-sm">
        אם {supplierName} ישווה את כל המוצרים שסימנתם, תחסכו עד{" "}
        <strong className="text-accent">{shekels(saving)}</strong> בחודש.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">הודעה לספק (לא חובה)</span>
        <textarea
          name="message"
          rows={3}
          maxLength={1000}
          placeholder="למשל: אנחנו מרוצים מהשירות ורוצים להמשיך לעבוד איתכם, אם המחירים יתאימו."
          className="rounded-md border border-border bg-surface px-3 py-2 text-base outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
      </label>
      <FormError message={state.error} />
      <div>
        <SendToSupplierButton pending={pending} label="שליחת הבקשה לספק" />
      </div>
    </ActionForm>
  );
}

/** ספק שלא רשום במערכת: הודעה מוכנה לשליחה בוואטסאפ או להעתקה */
export function MatchMessage({ businessName, candidates }: { businessName: string; candidates: MatchCandidate[] }) {
  const { chosen, toggle, saving } = useChosen(candidates);
  const [copied, setCopied] = useState(false);
  const text = useMemo(
    () =>
      matchRequestText(
        businessName,
        candidates.filter((c) => chosen.has(c.productId)),
        unitLabel,
      ),
    [businessName, candidates, chosen],
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <CandidateList candidates={candidates} chosen={chosen} toggle={toggle} />
      <p className="text-sm">
        חיסכון של עד <strong className="text-accent">{shekels(saving)}</strong> בחודש אם הספק ישווה את כל המוצרים
        שסימנתם.
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">ההודעה לספק</span>
        <textarea
          readOnly
          value={text}
          rows={Math.min(12, 4 + chosen.size)}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(text)}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={chosen.size === 0}
          className="inline-flex items-center gap-2 rounded-md bg-[#ffd400] px-4 py-2 text-sm font-semibold whitespace-nowrap text-black shadow-sm ring-1 ring-black/10 hover:bg-[#ffc400] aria-disabled:pointer-events-none aria-disabled:opacity-60"
        >
          שליחה בוואטסאפ
        </a>
        <button
          type="button"
          onClick={copy}
          disabled={chosen.size === 0}
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm disabled:opacity-60"
        >
          {copied ? "הועתק ✓" : "העתקת ההודעה"}
        </button>
      </div>
    </div>
  );
}
