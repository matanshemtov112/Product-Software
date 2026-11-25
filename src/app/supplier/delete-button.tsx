"use client";

import { deleteOffer } from "./actions";

/** "מחיקה" מעבירה לארכיון. stay: מתוך הרשימה נשארת באותו מקום בדף, בלי לחזור לראש הרשימה */
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
        if (!confirm(`להעביר את "${productName}" לארכיון? הוא ייצא מההשוואות, וההיסטוריה שלו תישמר.`))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="offerId" value={offerId} />
      {stay && <input type="hidden" name="stay" value="1" />}
      <button className="text-sm text-danger hover:underline">לארכיון</button>
    </form>
  );
}
