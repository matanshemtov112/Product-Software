"use client";

import { deleteOffer } from "./actions";

export function DeleteOfferButton({ offerId, productName }: { offerId: string; productName: string }) {
  return (
    <form
      action={deleteOffer}
      onSubmit={(e) => {
        if (!confirm(`למחוק את "${productName}" מהרשימה?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="offerId" value={offerId} />
      <button className="text-sm text-danger hover:underline">מחיקה</button>
    </form>
  );
}
