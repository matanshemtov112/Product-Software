"use client";

import { deleteOffer } from "./actions";

/** stay: מחיקה מתוך הרשימה נשארת באותו מקום בדף, בלי לחזור לראש הרשימה */
export function DeleteOfferButton({
  offerId,
  productName,
  stay = false,
}: {
  offerId: string;
  productName: string;
  stay?: boolean;
}) {
  return (
    <form
      action={deleteOffer}
      onSubmit={(e) => {
        if (!confirm(`למחוק את "${productName}" מהרשימה?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="offerId" value={offerId} />
      {stay && <input type="hidden" name="stay" value="1" />}
      <button className="text-sm text-danger hover:underline">מחיקה</button>
    </form>
  );
}
