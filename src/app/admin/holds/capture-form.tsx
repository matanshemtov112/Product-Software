"use client";

import { captureHoldFee } from "./actions";

/** גביית דמי אי-הזמנה: חיוב אמיתי של הלקוח, ולכן עם אישור לפני השליחה */
export function CaptureFeeForm({ id, maxShekels }: { id: string; maxShekels: number }) {
  return (
    <form
      action={captureHoldFee}
      onSubmit={(e) => {
        const amount = new FormData(e.currentTarget).get("amount");
        if (!window.confirm(`לגבות מהלקוח ₪${amount} דמי אי-הזמנה? אי אפשר לבטל את הגבייה מכאן.`)) e.preventDefault();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="id" value={id} />
      <label className="flex items-center gap-1 text-xs">
        דמי אי-הזמנה ₪
        <input
          name="amount"
          type="number"
          min="1"
          max={maxShekels}
          step="0.01"
          required
          className="w-24 rounded-md border border-border bg-surface px-2 py-1"
          dir="ltr"
        />
      </label>
      <button type="submit" className="text-sm text-danger hover:underline">
        גבייה
      </button>
    </form>
  );
}
