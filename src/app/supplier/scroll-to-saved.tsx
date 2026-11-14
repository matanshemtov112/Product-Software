"use client";

import { useEffect } from "react";

/** אחרי שמירה גוללים בחזרה למוצר שנערך ומסמנים אותו לרגע, כדי שהספק לא יאבד את המקום ברשימה */
export function ScrollToSaved({ offerId }: { offerId?: string }) {
  useEffect(() => {
    if (!offerId) return;
    const el = document.getElementById(`offer-${offerId}`);
    if (!el) return;
    el.scrollIntoView({ block: "center" });
    el.classList.add("saved-flash");
    const t = setTimeout(() => el.classList.remove("saved-flash"), 2500);
    // הכתובת חוזרת לרגילה, כך שרענון לא יגלול שוב
    const url = new URL(window.location.href);
    url.searchParams.delete("saved");
    url.hash = "";
    window.history.replaceState(window.history.state, "", url);
    return () => clearTimeout(t);
  }, [offerId]);
  return null;
}
