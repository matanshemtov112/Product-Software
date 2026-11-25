/**
 * המשך בוואטסאפ אחרי שהלקוח קיבל הצעה: קישור רגיל של וואטסאפ (wa.me) עם הודעה מוכנה.
 * בלי חשבון עסקי ובלי מספר של האתר; ההגנה על המחיר היא העסקה הנעולה באתר, שהקישור אליה נמצא בהודעה.
 */

/** מספר ישראלי בפורמט בינלאומי בלי סימנים (972501234567); null למספר לא תקין */
export function internationalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "972" + digits.slice(1);
  digits = digits.replace(/\D/g, "");
  // ישראל: 972 + 8-9 ספרות; מספרים מחו״ל: 8 עד 15 ספרות
  if (digits.startsWith("972")) return /^972\d{8,9}$/.test(digits) ? digits : null;
  return /^\d{8,15}$/.test(digits) ? digits : null;
}

/** בדיקת מספר שהספק הזין למספר הוואטסאפ */
export function validWhatsappPhone(raw: string): boolean {
  return internationalPhone(raw) !== null;
}

export function whatsappUrl(phone: string, text: string): string | null {
  const intl = internationalPhone(phone);
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** המספר שאליו פונים בוואטסאפ לספק; null כשהספק כיבה וואטסאפ או שאין לו מספר */
export function supplierWhatsapp(s: {
  whatsappEnabled: boolean;
  whatsappPhone: string | null;
  contactPhone: string | null;
}): string | null {
  if (!s.whatsappEnabled) return null;
  return internationalPhone(s.whatsappPhone) ?? internationalPhone(s.contactPhone);
}

/** ההודעה המוכנה: מספר העסקה, עד מתי המחיר מובטח, וקישור לעמוד העסקה */
export function dealMessage(opts: {
  side: "CUSTOMER" | "SUPPLIER";
  number: string;
  otherName: string;
  myName: string;
  until: string;
  url: string;
}): string {
  const hello = `שלום ${opts.otherName}, כאן ${opts.myName}.`;
  const about =
    opts.side === "CUSTOMER"
      ? `לגבי ההצעה שקיבלנו מכם באתר, עסקה ${opts.number}.`
      : `לגבי ההצעה שלנו שקיבלתם באתר, עסקה ${opts.number}.`;
  return `${hello}\n${about}\nהמחירים מובטחים עד ${opts.until}.\nפרטי העסקה: ${opts.url}`;
}
